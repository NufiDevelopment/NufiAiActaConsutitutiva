const moment   = require("moment"),
DB       = require("../utils/DB");

module.exports = {
    saveRequestActaConstitutiva: async function(body, uuid, urlWebhook, type, reqTime){
        return DB.insert({
            UUID: uuid,
            urlWebhook: urlWebhook,
            request: body, 
            requestDate: reqTime.format("YYYY-MM-DD HH:mm:ss"),
            type: type,
            status: `Created`
        }, DB.tabla.actaConstitutiva)    
        .then(id => { 
            return ( id);
        })
        .catch(err => {
            const error = {func: "saveRequestActaConstitutiva", uuid: uuid, err: err};            
            const fullError = {message:"Error durante procesamiento", stack:error};

            console.log(err, uuid);

            throw fullError;
        });
    },
    saveResponseActaConstitutiva: async function(uuid, response, status, error = null, errorWebhook = null){

        let response_time = moment();        
    
        return DB.update({
            modified:response_time.format("YYYY-MM-DD HH:mm:ss"),
            response: JSON.stringify(response),
            responseDate: response_time.format("YYYY-MM-DD HH:mm:ss"),
            status: status,
            error: error,
            errorWebhook : errorWebhook
        }, DB.tabla.actaConstitutiva, `uuid='${uuid}'`)        
        .catch(err => { return console.log(err, uuid)});
    },
    UpdateEstatus: async function(uuid, status){
        let response_time = moment();        

        console.log(`Actualiza status ${uuid} . ${status}`);
    
        return DB.update({
            modified:response_time.format("YYYY-MM-DD HH:mm:ss"), 
            status: status, 
        }, DB.tabla.actaConstitutiva, `uuid='${uuid}'`)
        .catch(err => { return console.log(err, uuid)});
    },
    GetRecord: async function(uuid){

        try{
        let sqlParams = [];
        sqlParams.push(DB.getParams("uuid", uuid));

        let record = await DB.querySec(`SELECT urlWebhook, status, intentos, ocrText, requestDate FROM ${DB.tabla.actaConstitutiva} WHERE uuid = @uuid`,  sqlParams);

        if(record.length == 0) 
            throw("Error al obtener registro");
        else
            return record[0];
        }
        catch(err){
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
                throw err;
            }
    },
    UpdateOcr: async function(uuid, ocrText){
        let response_time = moment();        

        console.log(`Actualiza OCR ${uuid} . OCR`);
    
        return DB.update({
            modified:response_time.format("YYYY-MM-DD HH:mm:ss"), 
            ocrText: ocrText, 
            status: "OCR", 
        }, DB.tabla.actaConstitutiva, `uuid='${uuid}'`)
        .catch(err => { return console.log(err, uuid)});
    },
    UpdateTokensDoc: async function(uuid, status, tokensCompletion, tokensPrompt, tokensTotal){
        let response_time = moment();        

        console.log(`Actualiza ${uuid} Tokens`);
    
        return DB.update({
            modified:response_time.format("YYYY-MM-DD HH:mm:ss"), 
            promptTokens: tokensPrompt, 
            completionTokens: tokensCompletion, 
            totalTokens: tokensTotal, 
            status: status, 
        }, DB.tabla.actaConstitutiva, `uuid='${uuid}'`)
        .catch(err => { return console.log(err, uuid)});
    },
    CreateTokensRecord: async function(uuid, typeDoc, docUuid, apikey, status,  requestDate){        
            
        return DB.insert({
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

            console.log(err, uuid);

            throw fullError;
        });
    },
    UpdateTokensRecord: async function(docUuid, status, promptTokens, completionTokens, totalTokens, responseDate){
        let curtime = moment();

        console.log(`Actualiza ${docUuid} Token Record`);
    
        return DB.update({
            modified: curtime.format("YYYY-MM-DD HH:mm:ss"), 
            promptTokens: promptTokens, 
            completionTokens: completionTokens, 
            totalTokens: totalTokens, 
            status: status, 
            responseDate: responseDate.format("YYYY-MM-DD HH:mm:ss")            
        }, DB.tabla.tokens, `doc_Uuid='${docUuid}'`)
        .catch(err => { return console.log(err, docUuid)});
    }
}