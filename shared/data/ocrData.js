const utils  = require("../utils/utilities");

const OCR_PDF_URL = process.env.OCR_PDF_URL;
const OCR_IMG_URL = process.env.OCR_IMG_URL;
const OCR_API_KEY = process.env.OCR_API_KEY;
const maxIntentosOcr =  parseInt(process.env.MAX_INTENTOS_OCR);


module.exports = {
    GetOcrPDF: async function(urlPublic, uuid) {
        return await GetOcrPDF(urlPublic, uuid);
    },
    GetOcrImage: async function (urlPublic, uuid) {
        return await GetOcrImage(urlPublic, uuid);
    },
};

async function GetOcrPDF(urlPublic, uuid){

    let ocrDataTextArray = [];
    let ocrData, ocrDataText, uuidLog, idLog;

    try{

        const bodyReq = {pdfUrl: urlPublic};
        const headersReq = {auth: OCR_API_KEY};

        for(let i = 0; i < maxIntentosOcr; i++){

            try{

                uuidLog = uuidv4(), ocrData = "", idLog = "";              
                
                idLog = await SaveRequestOcr(uuidLog, uuid, JSON.stringify(bodyReq), "OcrPDF", OCR_PDF_URL);
            
                console.info("CALLS OCR PDF");
                ocrData =  await utils.POST(OCR_PDF_URL, bodyReq, headersReq);
                ocrDataText = ocrData.recognizedText;    

                ocrDataTextArray = ocrDataText.split("==== ").filter(v=> v !== "");

                await SaveResponseOcr(uuidLog, JSON.stringify(ocrData), "success", "");

                break;
            }
            catch(err){                
                console.log("OCR ERROR intento "+(i + 1));

                await SaveResponseOcr(uuidLog, JSON.stringify(ocrData), "error", JSON.stringify(err));

                if((i + 1) == maxIntentosOcr )
                    throw err;
            }
        }


    }
    catch(error){
        const fullError = {message:"Error al procesar archivo PDF", stack:error};
        console.error("OCR PDF");
        console.error(JSON.stringify(error));        
        throw fullError;
    }
    
    return ocrDataTextArray;

}
async function GetOcrImage(urlPublic, uuid){
    
        let ocrData = null, uuidLog, idLog;
        try{    
            const bodyReq = {imageUrl: urlPublic};
            const headersReq = {auth: OCR_API_KEY};

            for(let i = 0; i < maxIntentosOcr; i++){

    
                try{
                    uuidLog = uuidv4(), ocrData = "", idLog = "";
                    
                    idLog = await SaveRequestOcr(uuidLog, uuid, JSON.stringify(bodyReq), "OcrIMG", OCR_IMG_URL);
            
                    console.info("CALLS OCR IMG");
                    ocrData =  await utils.POST(OCR_IMG_URL, bodyReq, headersReq);   

                    ocrData = ocrData.recognizedTexts;

                    await SaveResponseOcr(uuidLog, JSON.stringify(ocrData), "success", "");

                    break;    
                }
                catch(err){                
                    console.log("OCR ERROR intento "+(i + 1));

                    await SaveResponseOcr(uuidLog, JSON.stringify(ocrData), "error", JSON.stringify(err));

                    if((i + 1) == maxIntentosOcr )
                        throw err;
                } 

            }
        }
        catch(error){
            const fullError = {message:"Error al procesar archivo IMG", stack:error};

            console.error("OCR IMG");
            console.error(JSON.stringify(error));        
            throw fullError;
        }
        
        return ocrData;    
}

async function SaveRequestOcr (uuid, Doc_UUID, request,  typeQuery, url = ""){

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

        const fullError = {func: "SaveRequestOcr", stack:err, uuid: Doc_UUID};
        console.error(fullError, Doc_UUID);

        return console.log(err, uuid)
    });
}

async function SaveResponseOcr (uuid, response, status, error){

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

        const fullError = {func: "SaveResponseOcr", stack:err, QueryUuid: uuid};
        console.error(fullError, uuid);
        
        return console.log(err, uuid)
    
    });
}