const moment   = require("moment"),
DB       = require("../utils/DB");

module.exports = {
    saveRequestActaConstitutiva: async function(body, uuid, urlWebhook, type, step, reqTime){
        return DB.insertSec({
            UUID: uuid,
            urlWebhook: urlWebhook,
            request: body, 
            requestDate: reqTime.format("YYYY-MM-DD HH:mm:ss"),
            type: type,
            step: step,
            status: `Created`
        }, DB.tabla.actaConstitutiva)    
        .then(id => { 
            return ( id);
        })
        .catch(err => {
            const error = {func: "saveRequestActaConstitutiva", uuid: uuid, err: err};            
            const fullError = {message:"Error durante procesamiento", stack:error};

            console.error(error, uuid);
            // console.log(error, uuid);

            throw fullError;
        });
    },
    saveResponseActaConstitutiva: async function(uuid, response, status, error = null, errorWebhook = null){

        let response_time = moment();        
    
        return DB.updateSec({
            modified:response_time.format("YYYY-MM-DD HH:mm:ss"),
            response: JSON.stringify(response),
            responseDate: response_time.format("YYYY-MM-DD HH:mm:ss"),
            status: status,
            error: error,
            errorWebhook : errorWebhook
        }, DB.tabla.actaConstitutiva, `uuid=@uuid`, {uuid:uuid})        
        .catch(err => { 

            const error = {func: "saveResponseActaConstitutiva", uuid: uuid, err: err};            
            console.error(error, uuid);

            return console.log(err, uuid)
        });
    },
    UpdateEstatus: async function(uuid, status){
        let response_time = moment();        

        console.log(`Actualiza status ${uuid} . ${status}`);
    
        return DB.updateSec({
            modified:response_time.format("YYYY-MM-DD HH:mm:ss"), 
            status: status, 
        }, DB.tabla.actaConstitutiva, `uuid=@uuid`, {uuid:uuid})
        .catch(err => { 
            const error = {func: "UpdateEstatus", uuid: uuid, err: err};            
            console.error(error, uuid);

            return console.log(err, uuid)
        });
    },
    GetRecord: async function(uuid){

        try{
        let sqlParams = [];
        sqlParams.push(DB.getParams("uuid", uuid));

        let record = await DB.querySec(`SELECT urlWebhook, status, intentos, ocrText, requestDate, step FROM ${DB.tabla.actaConstitutiva} WHERE uuid = @uuid`,  sqlParams);

        if(record.length == 0) 
            throw("Error al obtener registro");
        else
            return record[0];
        }
        catch(err){

            const error = {func: "GetRecord", uuid: uuid, err: err};            
            console.error(error, uuid);

            throw err;
        }
    },
    GetOpenAiTokens: async function(uuid){

        try{
        let sqlParams = [];
        sqlParams.push(DB.getParams("uuid", uuid));

        let record = await DB.querySec(`select Doc_uuid, sum(promptTokens) as promptTokens, sum(completionTokens) as completionTokens, sum(totalTokens) as totalTokens  
            FROM ${DB.tabla.actaConstitutivaQueries}  
            WHERE Doc_uuid = @uuid 
            group by Doc_uuid`,  sqlParams);

        if(record.length == 0) 
            return {Doc_uuid: uuid, promptTokens: 0, completionTokens : 0, totalTokens : 0};
        else
            return record[0];
        }
        catch(err){

            const error = {func: "GetOpenAiTokens", uuid: uuid, err: err};            
            console.error(error, uuid);

            throw err;
        }
    },
    GetWebhookProcesses: async function(maxWebhookProcesses, statusWebhook){
        try{
            let sqlParams = [];
            sqlParams.push(DB.getParams("status", statusWebhook));
            // sqlParams.push(DB.getParams("maxProcesses", maxWebhookProcesses));
    
            let records = await DB.querySec(`SELECT TOP ${maxWebhookProcesses} id, uuid, urlWebhook, status, intentos, ocrText, requestDate FROM ${DB.tabla.actaConstitutiva} WHERE status = @status ORDER BY ID `,  sqlParams);
    
            if(records.length == 0) 
                throw("No se encontraron registros");
            else
                return records;
            }
            catch(err){
                        
                const error = {func: "GetWebhookProcesses", err: err};
                console.error(error);

                throw err;
            }
    },
    UpdateOcr: async function(uuid, ocrText){
        let response_time = moment();        

        console.log(`Actualiza OCR ${uuid} . OCR`);
    
        return DB.updateSec({
            modified:response_time.format("YYYY-MM-DD HH:mm:ss"), 
            ocrText: ocrText, 
            status: "OCR", 
        }, DB.tabla.actaConstitutiva, `uuid=@uuid`, {uuid:uuid})
        .catch(err => { 
        
            const error = {func: "UpdateOcr", uuid: uuid, err: err};            
            console.error(error, uuid);

            return console.log(err, uuid)
        });
    },
    UpdateTokensDoc: async function(uuid, status, tokensCompletion, tokensPrompt, tokensTotal){
        let response_time = moment();        

        console.log(`Actualiza ${uuid} Tokens`);
    
        return DB.updateSec({
            modified:response_time.format("YYYY-MM-DD HH:mm:ss"), 
            promptTokens: tokensPrompt, 
            completionTokens: tokensCompletion, 
            totalTokens: tokensTotal, 
            status: status, 
        }, DB.tabla.actaConstitutiva, `uuid=@uuid`, {uuid:uuid})
        .catch(err => { 

            const error = {func: "UpdateTokensDoc", uuid: uuid, err: err};            
            console.error(error, uuid);

            return console.log(err, uuid)
        });
    },
    CreateTokensRecord: async function(uuid, typeDoc, docUuid, apikey, status,  requestDate){        
            
        return DB.insertSec({
            uuid: uuid,
            TIpoDoc: typeDoc,
            Doc_UUID: docUuid,
            apikey, apikey,
            status: status,
            requestDate: requestDate.format("YYYY-MM-DD HH:mm:ss")            
        }, DB.tabla.tokens)
        .then(id => { 
            return ( id);
        })
        .catch(err => {
            const error = {func: "CreateTokensRecord", uuid: uuid, err: err};            
            const fullError = {message:"Error durante procesamiento", stack:error};

            console.error(error, uuid);

            throw fullError;
        });
    },
    UpdateTokensRecord: async function(docUuid, status, promptTokens, completionTokens, totalTokens, responseDate){
        let curtime = moment();

        console.log(`Actualiza ${docUuid} Token Record`);
    
        return DB.updateSec({
            modified: curtime.format("YYYY-MM-DD HH:mm:ss"), 
            promptTokens: promptTokens, 
            completionTokens: completionTokens, 
            totalTokens: totalTokens, 
            status: status, 
            responseDate: responseDate.format("YYYY-MM-DD HH:mm:ss")
        }, DB.tabla.tokens, `doc_Uuid=@docUuid`, {docUuid:docUuid})
        .catch(err => { 
            const error = {func: "UpdateTokensRecord", uuid: docUuid, err: err};            
            console.error(error, uuid);

            return console.log(err, docUuid)
        });
    },
    SaveRequestWebhook: async function (uuid, Doc_UUID, request,  typeQuery, url = ""){

        let reqTime = moment();       
    
        return DB.insertSec({
            uuid: uuid, 
            Doc_UUID: Doc_UUID, 
            tipoQuery: typeQuery, 
            url: url, 
            request: request,
            requestDate: reqTime.format("YYYY-MM-DD HH:mm:ss"),        
            status: `Created`,
            promptTokens: "0",             
            completionTokens: "0",
            totalTokens: "0",
        }, DB.tabla.actaConstitutivaQueries)
        .then(id => { return ( id);})
        .catch(err => { 
    
            const fullError = {func: "SaveRequestWebhook", stack:err, uuid: Doc_UUID};
            console.error(fullError, Doc_UUID);
    
            return console.log(err, uuid)
        });
    },    
    SaveResponseWebhook: async function  (uuid, response, status, error){
    
        let resTime = moment(); 
    
        return DB.updateSec({
            response: response,
            responseDate: resTime.format("YYYY-MM-DD HH:mm:ss"),
            messageResponse: "",
            jsonResponse: "",
            error: error,
            status: status
        }, DB.tabla.actaConstitutivaQueries, `uuid=@uuid`, {uuid:uuid})
        .catch(err => {
    
            const fullError = {func: "SaveResponseWebhook", stack:err, QueryUuid: uuid};
            console.error(fullError, uuid);
            
            return console.log(err, uuid)
        
        });
    }
}