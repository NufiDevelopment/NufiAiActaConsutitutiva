const moment = require("moment"),    
azure  = require("../data/azureData"),
azureQueue  = require("../data/azureQueueData"),
ocr  = require("../data/ocrData"),
actaConstitutivaData =  require("../data/actaConstitutivaData"),
{ v4: uuidv4 } = require('uuid');
const utils = require("../utils/utilities");
openAiData = require("../data/openAiData");

let appInsights = require('applicationinsights');

appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING).start();

const AZURE_CONTAINER = process.env.STORAGE_CONTAINER;

const gptDatosGenerales = process.env.CHAT_MSG_DATOS_GENERALES;
const gptObjSocial = process.env.CHAT_MSG_OBJ_SOCIAL;
const gptObjAnalisis = process.env.CHAT_MSG_OBJ_ANALISIS;
const gptOrgInternosAnalisis = process.env.CHAT_MSG_ORG_INTERNOS_ANALISIS;
const gptFacultadesConsejo = process.env.CHAT_MSG_FACULTADES_CONSEJO_ANALISIS;
const gptFacultadesRepresentante = process.env.CHAT_MSG_FACULTADES_REPRESENTANTE_ANALISIS;


const statusWebhook = process.env.STATUS_WEBHOOK;
 

module.exports = {
    GuardaActaConstitutiva: async function(req){
        return await GuardaActaConstitutiva(req);
    },
    ProcessWebhookQueue: async function(item){
        return await ProcessWebhookQueue(item);
    }
}

async function GuardaActaConstitutiva(req){
    
    const data = req.body;
    const uuid = uuidv4();

    let response = { status: "error", message: "", data: null, code: 0 };
    let contextRes = {status: 200, headers: {"content-type": "application/json"},body: response};
    let error="", estatus="", fileBase64 = "", tokens = {}, idActa = null;

    try{
        console.info("INIT PROCESS");
      
  
        const urlWebhook = data.webhook;
        const isWebhook = (urlWebhook) ? true: false;
        const step = (typeof data.paso === "undefined" || data.paso === null || data.paso === "") ? null: data.paso;
        const request_time = moment();

        let idActa =  await actaConstitutivaData.saveRequestActaConstitutiva(
            JSON.stringify(data), 
            uuid, 
            urlWebhook, 
            (isWebhook) ? "webhook" : "sincrono", 
            step,
            request_time
        );        

        const validAuth = ValidateAuth(req);        

        if(validAuth){

            const apiKey = GetApikey(req);

            const validRequest = ValidateRequest(data);

            await actaConstitutivaData.CreateTokensRecord(uuidv4(), "ActaConstitutiva", uuid, apiKey, "Creado", request_time);

            if(validRequest === true && !isWebhook){

                fileBase64 = GetBase64(data.fileB64);

                response = await InitProcessing(uuid, fileBase64, isWebhook, step);
                await actaConstitutivaData.saveResponseActaConstitutiva(uuid, JSON.stringify(response), "Finished");

                tokens = await actaConstitutivaData.GetOpenAiTokens(uuid);

                await actaConstitutivaData.UpdateTokensRecord(uuid, "Finished" , tokens.promptTokens, tokens.completionTokens, tokens.totalTokens, moment());

            }
            else if(validRequest === true && isWebhook){

                fileBase64 = GetBase64(data.fileB64);
                
                response = await InitProcessing(uuid, fileBase64, isWebhook, step);
            }
            else{

                console.error("ERROR VALIDACIÓN");

                response = { status: "error", message: validRequest, data: {uuid: uuid}, code: 400 };
                
                contextRes.status = 400;

                await actaConstitutivaData.saveResponseActaConstitutiva(uuid, JSON.stringify(response), "ErrorValidacion");
                await actaConstitutivaData.UpdateTokensRecord(uuid, "ErrorValidacion", 0, 0, 0, moment());
            }
        }
        else{
            console.error("ERROR AUTH");

            response = { status: "error", message: "unauthorized", data: null, code: 401 };
            
            contextRes.status = 401;

            await actaConstitutivaData.saveResponseActaConstitutiva(uuid, JSON.stringify(response), "unauthorized");
            // await actaConstitutivaData.UpdateTokensRecord(uuid, "unauthorized", 0, 0, 0, moment());
        }

        contextRes.body = response;
    }
    catch(err){        

        // console.error("ERROR GRAL");

        const errorBody = GetResponseError(err, uuid);

        console.error(JSON.stringify(err), uuid);

        contextRes.body = errorBody;

        if(idActa !== null){// only if initial insert worked
            tokens = await actaConstitutivaData.GetOpenAiTokens(uuid);
            await actaConstitutivaData.saveResponseActaConstitutiva(uuid, JSON.stringify(contextRes.body), "error", JSON.stringify(err));
            await actaConstitutivaData.UpdateTokensRecord(uuid, "error", tokens.promptTokens, tokens.completionTokens, tokens.totalTokens, moment());
        }

        contextRes.status = 500;

    }

    return contextRes;
}

async function ProcessWebhookQueue(item){
    try{
        const uuid = item.uuid;
        const actaConstitutiva = await actaConstitutivaData.GetRecord(uuid);

        const resultWH = await ProcessWebhhoksAsync(uuid, actaConstitutiva.urlWebhook, actaConstitutiva.step);

        console.info("Termina ejecución Queue "+ uuid);

    }
    catch(err){
        console.error("Error en procesamiento webhook");
    }
}

async function InitProcessing(uuid, fileBase64, isWebhook, step){
    try{        
        let response = {}, estatus = `Created`;

        const fileName = `${uuid}.pdf`;

        const resultUpload = await azure.UploadFile(fileName, fileBase64, AZURE_CONTAINER);

        estatus = `FileUploaded`;

        console.info("UPLOADS FILE");

        if(isWebhook) {

            await actaConstitutivaData.UpdateEstatus(uuid, statusWebhook);

            const queueResp = await azureQueue.AddQueueItem({uuid:uuid, dateTime : moment().format("YYYY-MM-DD HH:mm:ss")});

            response = GetWebhookResponse(uuid);
        }
        else{

            await actaConstitutivaData.UpdateEstatus(uuid, "SyncProcess");
            response = await ProcessSync(uuid, step);
        }

        return response;
    }
    catch(err){
        throw err;
    }
}

async function ProcessSync(uuid, step){

    try{

        const response = await ProcessActaConstitutiva(uuid, step);
        return response;
    }
    catch(err){
        throw err;
    }
}

async function ProcessWebhhoksAsync(uuid, urlWebhook, step){

    let error="", errorWebhook = "", estatus="", tokens = {}, respWebhook = "";
    let response = { status: "error", message: "", data: {uuid: uuid}, code: 0 }, uuidLog = uuidv4();

    try{
         
        try{

            try{
                response = await ProcessActaConstitutiva(uuid, step);
            }
            catch(errorProceso){
                response = GetResponseError(errorProceso, uuid);
                error = errorProceso;
            }
        
            try{
                let idLogRequest = await actaConstitutivaData.SaveRequestWebhook(uuidLog, uuid, JSON.stringify(response), "webhookResponse", urlWebhook);
                
                respWebhook = await utils.POST(urlWebhook, response, null);

                await actaConstitutivaData.SaveResponseWebhook(uuidLog, JSON.stringify(respWebhook), "success", "");


            }
            catch(errorWH){
                errorWebhook = errorWH;

                await actaConstitutivaData.SaveResponseWebhook(uuidLog, JSON.stringify(respWebhook), "error", JSON.stringify(errorWH));
            }

            tokens = await actaConstitutivaData.GetOpenAiTokens(uuid);
            await actaConstitutivaData.UpdateTokensRecord(uuid, response.status == "error" ? "error":"Finished" , tokens.promptTokens, tokens.completionTokens, tokens.totalTokens, moment());
            await actaConstitutivaData.saveResponseActaConstitutiva(uuid, 
                JSON.stringify(response), 
                response.status == "error" ? "error":"Finished", 
                response.status == "error" ? JSON.stringify(error):"", 
                errorWebhook != ""? JSON.stringify(errorWebhook):"");

        }
        catch(err){
            
            response = GetResponseError(err, uuid);
            
            console.error(JSON.stringify(err), uuid);

            tokens = await actaConstitutivaData.GetOpenAiTokens(uuid);
            await actaConstitutivaData.saveResponseActaConstitutiva(uuid, JSON.stringify(response), "error", JSON.stringify(err), JSON.stringify(errorWebhook));
            await actaConstitutivaData.UpdateTokensRecord(uuid, "error", tokens.promptTokens, tokens.completionTokens, tokens.totalTokens, moment());
        }

        return response;
    }
    catch(errorGral){

        console.error("ERROR Durante guardado response o tokens", uuid);
    }
}

async function ProcessActaConstitutiva(uuid, step){
    try{


        let totalTokensCompletion = 0, totalTokensPrompt = 0, totalTokens = 0;
        let response = { status: "success", message: "", data: {uuid:uuid}, code: 200 };
        let objSocialData = null;

        const fileName = `${uuid}.pdf`;
       
        const publicUrl = await azure.GetUrlFile(fileName, AZURE_CONTAINER);       

        console.info("GETS URL");

        const pagesData = await ocr.GetOcrPDF(publicUrl);

        await actaConstitutivaData.UpdateOcr(uuid, (pagesData.join("\n")));

        await actaConstitutivaData.UpdateEstatus(uuid, "GetDocumentInfo");


        const allInfoData = await GetDocumentInfo(uuid, pagesData.join("\n"), step);

        allInfoData.forEach(async (item, index)=>{

            totalTokensCompletion += item.totalTokensCompletion;
            totalTokensPrompt += item.totalTokensPrompt;
            totalTokens += item.totalTokens;
            
            delete item.totalTokensCompletion;
            delete item.totalTokensPrompt;
            delete item.totalTokens;

            response.data[item.type] =  item;

            delete response.data[item.type].type;
        });

        const hasObjSocial = (Object.hasOwn(response.data, "ObjetoSocial") && Object.hasOwn(response.data.ObjetoSocial, "objeto_social"));


        if(step != null && step > 2){
            objSocialData =  await GetDocumentInfoSteps34(uuid, pagesData.join("\n"), step, response.data.ObjetoSocial.objeto_social, hasObjSocial);

            objSocialData.forEach(async (item, index)=>{

                totalTokensCompletion += item.totalTokensCompletion;
                totalTokensPrompt += item.totalTokensPrompt;
                totalTokens += item.totalTokens;
                
                delete item.totalTokensCompletion;
                delete item.totalTokensPrompt;
                delete item.totalTokens;
    
                response.data[item.type] =  item;

                delete response.data[item.type].type;
            });            
        }


        response.data["totalTokensCompletion"] = totalTokensCompletion
        response.data["totalTokensPrompt"] = totalTokensPrompt
        response.data["totalTokens"] = totalTokens;
        response.data["uuid"] = uuid;                

        await actaConstitutivaData.UpdateTokensDoc(uuid, `GPT_QUERIES_COMPLETED`, totalTokensCompletion, totalTokensPrompt, totalTokens);

        console.info("END GetDocumentInfo");

        return response;
        
    }
    catch(err){        
        throw err;
    }
}

async function GetGralInfoText(jsonAnalisis, pagesData){

    try{

        const arrayInit = parseInt(jsonAnalisis.customer_information_pages[0]);
        const arrayEnd = parseInt(jsonAnalisis.customer_information_pages[jsonAnalisis.customer_information_pages.length - 1]) + 1;
        
        const gralInfoArray = pagesData.slice(arrayInit, arrayEnd);
        const gralInfoStr = gralInfoArray.join("\n");

        return gralInfoStr;
    }
    catch(err){
    
        console.error("GetGralInfoText");
        console.error(JSON.stringify(err));

        throw err;
    }
}

async function GetMovementsArray(jsonAnalisis, pagesData){

    try{

        const arrayInit = parseInt(jsonAnalisis.account_movements_pages[0]);
        const arrayEnd = parseInt(jsonAnalisis.account_movements_pages[jsonAnalisis.account_movements_pages.length - 1]) + 1;

        const movsArray = pagesData.slice(arrayInit, arrayEnd);

        return movsArray;
    }
    catch(err){
    
        console.error("GetMovementsArray");
        console.error(JSON.stringify(err));

        throw err;
    }
}

async function GetAnalisInfo(uuid, ocrDataText){

    let jsonAnalisis = {};

    try{
        console.info("GPT GetAnalisInfo CALL", uuid);

        const prompt = `${gptDatosGenerales} ${ocrDataText}`;

        jsonAnalisis = await openAiData.Chat(uuid, prompt, "Analisis_Datos_Generales");

        jsonAnalisis["type"] = "AnalisisGeneral";

        console.info("GPT GetAnalisInfo RESPONSE", uuid);

        await actaConstitutivaData.UpdateEstatus(uuid, "AnalisisGeneral");
        
    }
    catch(error){
        console.error("ERROR GET ANALYSIS INFO");
        console.error(JSON.stringify(error));

        throw error;
    }

    return jsonAnalisis;

}

async function GetObjetoSocial(uuid, ocrDataText){

    let jsonAnalisis = {};

    try{
        console.info("GPT GetObjetoSocial CALL", uuid);

        const prompt = `${gptObjSocial} ${ocrDataText}`;

        jsonAnalisis = await openAiData.Chat(uuid, prompt, "Analisis_Objeto_Social");

        jsonAnalisis["type"] = "ObjetoSocial";

        console.info("GPT GetObjetoSocial RESPONSE", uuid);

        await actaConstitutivaData.UpdateEstatus(uuid, "ObjetoSocial");
        
    }
    catch(error){
        console.error("ERROR GetObjetoSocial");
        console.error(JSON.stringify(error));

        throw error;
    }

    return jsonAnalisis;

}

async function GetObjetoSocialAnalisis(uuid, ocrDataText){

    let jsonAnalisis = {};

    try{
        console.info("GPT GetObjetoSocialAnalisis CALL", uuid);

        const prompt = `${gptObjAnalisis} ${ocrDataText}`;

        jsonAnalisis = await openAiData.Chat(uuid, prompt, "Analisis_Objeto_Social_Analsis");

        jsonAnalisis["type"] = "ObjetoSocialAnalisis";

        console.info("GPT GetObjetoSocialAnalisis RESPONSE", uuid);

        await actaConstitutivaData.UpdateEstatus(uuid, "ObjetoSocialAnalisis");
        
    }
    catch(error){
        console.error("ERROR GetObjetoSocialAnalisis");
        console.error(JSON.stringify(error));

        throw error;
    }

    return jsonAnalisis;

}

async function GetOrganosInternos(uuid, ocrDataText){

    let jsonAnalisis = {};

    try{
        console.info("GPT GetOrganosInternos CALL", uuid);

        const prompt = `${gptOrgInternosAnalisis} ${ocrDataText}`;

        jsonAnalisis = await openAiData.Chat(uuid, prompt, "Analisis_Organos_Internos");

        jsonAnalisis["type"] = "OrganosInternos";

        console.info("GPT GetOrganosInternos RESPONSE", uuid);

        await actaConstitutivaData.UpdateEstatus(uuid, "OrganosInternos");
        
    }
    catch(error){
        console.error("ERROR GET ANALYSIS INFO");
        console.error(JSON.stringify(error));

        throw error;
    }

    return jsonAnalisis;

}

async function GetFacultadesConsejo(uuid, ocrDataText){

    let jsonAnalisis = {};

    try{
        console.info("GPT ANALYSIS CALL");

        const prompt = `${gptFacultadesConsejo} ${ocrDataText}`;

        jsonAnalisis = await openAiData.Chat(uuid, prompt, "Analisis_FacultadesConsejo");

        jsonAnalisis["type"] = "FacultadesConsejo";

        console.info("GPT ANALYSIS RESPONSE");

        await actaConstitutivaData.UpdateEstatus(uuid, "FacultadesConsejo");
        
    }
    catch(error){
        console.error("ERROR GET ANALYSIS INFO");
        console.error(JSON.stringify(error));

        throw error;
    }

    return jsonAnalisis;

}

async function GetFacultadesRepresentante(uuid, ocrDataText){

    let jsonAnalisis = {};

    try{
        console.info("GPT ANALYSIS CALL");

        const prompt = `${gptFacultadesRepresentante} ${ocrDataText}`;

        jsonAnalisis = await openAiData.Chat(uuid, prompt, "Analisis_FacultadesRepresentante");

        jsonAnalisis["type"] = "FacultadesRepresentante";

        console.info("GPT ANALYSIS RESPONSE");

        await actaConstitutivaData.UpdateEstatus(uuid, "FacultadesRepresentante");
        
    }
    catch(error){
        console.error("ERROR GET ANALYSIS INFO");
        console.error(JSON.stringify(error));

        throw error;
    }

    return jsonAnalisis;

}

async function GetDocumentInfo(uuid, gralInfoStr, step){

    let allDocumentData = [];

    try{

        let allDocumentInfo = [];

        allDocumentInfo.push(GetAnalisInfo(uuid, gralInfoStr));
        
        if(step !== null && step > 1)
            allDocumentInfo.push(GetObjetoSocial(uuid, gralInfoStr));
        // allDocumentInfo.push(GetObjetoSocialAnalisis(uuid, gralInfoStr));
        // allDocumentInfo.push(GetOrganosInternos(uuid, gralInfoStr));
        // allDocumentInfo.push(GetFacultadesConsejo(uuid, gralInfoStr));
        // allDocumentInfo.push(GetFacultadesRepresentante(uuid, gralInfoStr));

        allDocumentData = Promise.all(allDocumentInfo);

    }
    catch(error){
        console.error("ERROR GetDocumentInfo");
        console.error(JSON.stringify(error));

        throw error;
    }
    finally{
        console.info("Termina GPT_Info");
                // await actaConstitutivaData.UpdateEstatus(uuid, "GPT_Info");
    }

    return allDocumentData;
}

async function GetDocumentInfoSteps34(uuid, gralInfoStr, step, objSocialText, hasObjSocial){

    let allDocumentData = [];

    try{

        let allDocumentInfo = [];
        
        if(step !== null && step > 2 && hasObjSocial)
            allDocumentInfo.push(GetObjetoSocialAnalisis(uuid, objSocialText));

        if(step !== null && step > 3)
            allDocumentInfo.push(GetOrganosInternos(uuid, gralInfoStr));


        allDocumentData = Promise.all(allDocumentInfo);

    }
    catch(error){
        console.error("ERROR GetDocumentInfoSteps34");
        console.error(JSON.stringify(error));

        throw error;
    }
    finally{
        console.info("Termina GPT_Info");
                // await actaConstitutivaData.UpdateEstatus(uuid, "GPT_Info");
    }

    return allDocumentData;
}

async function GetGeneralInfo(uuid, gralInfoStr){
    
    let jsonInfoGral = {};

    try{
        console.info("GPT GENERAL INFO CALL");
        
        const prompt = `${gptDocGral} the text to analyze is the following ${gralInfoStr}`;

        jsonInfoGral = await openAiData.Chat(uuid, prompt, "General_Info");

        console.info("GPT GENERAL INFO RESPONSE");
    }
    catch(error){
        console.error("error GetGeneralInfo");
        console.error(JSON.stringify(error));

        throw error;
    }

    return jsonInfoGral;
}

async function awaitAllMovements(uuid, movsArray){

    let promisesResult

    try{

        let arrayMovesDoc = [];        

        const quantityRecords = parseInt(process.env.MAX_MOVEMENTS_QUERY);

        console.info("GPT MOVEMENTS INFO LOOP");

        movsArray.forEach(async (item, index)=>{
            arrayMovesDoc.push(GetEdoCtaMovements(uuid, item, 1, quantityRecords, index));
        });

        promisesResult = Promise.all(arrayMovesDoc);

        console.info("GPT MOVEMENTS LOOP END");

    }
    catch(error){
        console.error("ERROR awaitAllMovements");
        console.error(JSON.stringify(error));

        throw error;
    }

    return promisesResult;

}

async function GetEdoCtaMovements(uuid, docPage, initMovement, quantRecords, pageNumber, lastRow = ``){

    let jsonInfoMovs = {};
    let jsonInfoMovs2 = {};
    
    try{

        console.info("CALL TO GPT MOVEMENTS - PAGE "+ pageNumber + " INIT MOV = "+initMovement);

        const remainingRowsPrompt = (initMovement == 1) ? ``: `\nSince init_record is not 1 this search it's a continuation from a previous query,help identify the first row to retrieve this is the last row obtained in a previous query:\n${lastRow}\nRecord ${initMovement} should be the one after this sample.`;

        const prompt = `${gptDocMovs}\nVar init_record = ${initMovement}\nVar quant_records = ${quantRecords}\nThe text to process is the following\n${docPage}${remainingRowsPrompt}`;

        jsonInfoMovs = await openAiData.Chat(uuid, prompt, "Movements");

        if(jsonInfoMovs !== null){
            jsonInfoMovs.data.detalle_movimientos = jsonInfoMovs.data.detalle_movimientos.filter(x=> x.fecha_operacion !== "" && ( x.cargo !== "" || x.abono !== "" || x.saldo_operacion !== ""));

            console.log("GPT RESULT PAGE "+ pageNumber + " TOT = "+(jsonInfoMovs.data.detalle_movimientos.length + 1))
        }

        if(jsonInfoMovs.data.detalle_movimientos.length == quantRecords && (quantRecords + initMovement) < quantRecords * 3){

            console.log("GPT REMAINING MOVEMENTS PAGE "+ pageNumber )
            
            jsonInfoMovs2 = await GetEdoCtaMovements(uuid, docPage, jsonInfoMovs.data.detalle_movimientos.length + 1, quantRecords, pageNumber, JSON.stringify(jsonInfoMovs.data.detalle_movimientos[jsonInfoMovs.data.detalle_movimientos.length-1]));

            if(jsonInfoMovs2 !== null && jsonInfoMovs2.data !== null && jsonInfoMovs2.data.detalle_movimientos !== null && jsonInfoMovs2.data.detalle_movimientos.length > 0){                

                jsonInfoMovs2.data.detalle_movimientos = await RemoveDuplicatesMovements(jsonInfoMovs.data.detalle_movimientos, jsonInfoMovs2.data.detalle_movimientos);

                console.log("GPT FINISH REMAINING MOVEMENTS PAGE "+ pageNumber );
                
                jsonInfoMovs.totalTokens += jsonInfoMovs2.totalTokens;
                jsonInfoMovs.totalTokensCompletion+= jsonInfoMovs2.totalTokensCompletion;
                jsonInfoMovs.totalTokensPrompt+= jsonInfoMovs2.totalTokensPrompt;

                jsonInfoMovs.data.detalle_movimientos = jsonInfoMovs.data.detalle_movimientos.concat(jsonInfoMovs2.data.detalle_movimientos);
            }
        }
    }
    catch(error){
        console.error("ERROR EN MOVS");
        console.error(JSON.stringify(error) );

        throw error;
    }    
    
    return jsonInfoMovs;
}

function RemoveDuplicatesMovements(array1, array2){

    try{

        array2 = array2.filter( function( item ) {
            for( let i=0, len=array1.length; i<len; i++ ){
                if( array1[i].fecha_operacion == item.fecha_operacion 
                    && array1[i].fecha_liquidacion == item.fecha_liquidacion
                    && array1[i].descripcion == item.descripcion
                    && array1[i].referencia == item.referencia
                    && array1[i].cargo == item.cargo
                    && array1[i].abono == item.abono
                    && array1[i].saldo_operacion == item.saldo_operacion) {
                    return false;
                }
            }
            return true;
        });

        return array2;

    }
    catch(err){
        console.error("error MovementsMerge");
        throw err;
    }
}

function MovementsMerge(allPagesArray){
    try{

        let arrayPages = [];
        let jsonMovs = {
            totalTokens : 0,
            totalTokensPrompt : 0,
            totalTokensCompletion : 0
        }

        allPagesArray.forEach((item, index)=>{
            arrayPages = arrayPages.concat(item.data.detalle_movimientos);
            jsonMovs.totalTokens += item.totalTokens;
            jsonMovs.totalTokensPrompt += item.totalTokensPrompt;
            jsonMovs.totalTokensCompletion += item.totalTokensCompletion;
        });

        jsonMovs["detalle_movimientos"] = arrayPages;

        return jsonMovs;
    }
    catch(err){
        const fullError = 
        console.error("error MovementsMerge");
        console.error(JSON.stringify(err));
        
        throw err;
    }
}

function GetWebhookResponse(uuid){
    try{
        return { status: "success", message: "Petición recibida", data: {uuid: uuid}, code: 200 };
    }
    catch(err){
        throw err;
    }
}

function ValidateAuth(req){
    try{
        return (Object.hasOwn(req.headers, "nufi-api-key") && req.headers["nufi-api-key"] !== "" ) || (Object.hasOwn(req.headers, "NUFI-API-KEY") && req.headers["NUFI-API-KEY"] !== "" );
    }
    catch(err){
        console.log(JSON.stringify(err));
        return false;
    }
}

function ValidateRequest(data){
    
    let result = true;

    try{

        if (typeof data.fileB64 === "undefined" || data.fileB64 === null || data.fileB64 === "")
            result = "Campo fileB64 requerido";
        else if(typeof data.webhook === "undefined" || data.webhook === null || data.webhook === "")
            result = "Campo webhook requerido";
        
        if(result === true && typeof data.fileB64 !== "undefined" && data.fileB64 !== null && data.fileB64 !== ""){
            try{
                const onlyB64 = GetBase64(data.fileB64);
            }
            catch(errorB64){
                result = "Error al decodificar base64";
            }
        }

        if(result === true && Object.hasOwn(data, "paso")){
            if(!Number.isInteger(data.paso)){
                result = "Error campo paso debe ser Int";
            }
            else if(data.paso <1 || data.paso > 4 )
                result = "Error campo paso debe ser Int con valor enre 1 y 4";
        }            

        return result;
    }
    catch(err){
        const fullError = {message: "Error de validación: ", stack:err};
        console.error("Error de validación");
        throw fullError;        
    }
}

function GetApikey(req){
    try{
        const apiKeyOrig = req.headers["nufi-api-key"];

        const isOdd = (apiKeyOrig.length % 2) === 1;

        const indexEnd = (isOdd) ? apiKeyOrig.length - 1 / 2 : apiKeyOrig.length / 2;
        
        const apiKey = apiKeyOrig.substring(0, indexEnd);

        return apiKey;
    }
    catch(err){
        const fullError = {message: "Error al procesar documento", stack:err};
        throw fullError;
    }
}

function GetResponseError(err, uuid){
    
    let resp = {status : "error", message : "", code : 500, data: {uuid: uuid}};

    try{
        const message  = (Object.hasOwn(err, "message")) ? err.message: "Error durante procesamiento de documento";
        resp.message = message;
        
    }
    catch(ex){
        resp.message = "Error durante procesamiento de documento";
    }

    return resp;
}

function JsonCleaning(uuid, allInfoArray, jsonAnalisis){
    try{
        let gralInfoJSon,  movsJson;

        if(Object.hasOwn(allInfoArray[0].data, "entidad_financiera")){
            gralInfoJSon = allInfoArray[0];            
            movsJson = allInfoArray[1];
        }
        else{
            gralInfoJSon = allInfoArray[1];            
            movsJson = allInfoArray[0];
        }

        gralInfoJSon.data["detalle_movimientos"] = [];
        gralInfoJSon.data["uuid"] = uuid;

        movsJson = MovementsMerge(movsJson);

        estatus = `MovementsCleaned`;

        gralInfoJSon.data["totalTokens"] = gralInfoJSon.totalTokens + jsonAnalisis.totalTokens + movsJson.totalTokens;
        gralInfoJSon.data["totalTokensPrompt"] = gralInfoJSon.totalTokensPrompt + jsonAnalisis.totalTokensPrompt + movsJson.totalTokensPrompt;
        gralInfoJSon.data["totalTokensCompletion"] = gralInfoJSon.totalTokensCompletion + jsonAnalisis.totalTokensCompletion + movsJson.totalTokensCompletion;      

        gralInfoJSon.data.detalle_movimientos = movsJson.detalle_movimientos;


        
        return gralInfoJSon;

    }
    catch(err){
        throw err;
    }
}

function GetBase64(base64){
    try{
            const arrayData = base64.split(",");
            let onlyB64 = "";

            if(arrayData.length !== 2 ){
                onlyB64 = arrayData[0];
            }
            else{
                onlyB64 = arrayData[1];
            }

            return onlyB64;
    }
    catch(err){
        const fullError = {message:"Error al decodificar base64", stack:err};

        throw fullError;
    }
}