const utils  = require("../utils/utilities");

const OCR_PDF_URL = process.env.OCR_PDF_URL;
const OCR_IMG_URL = process.env.OCR_IMG_URL;
const OCR_API_KEY = process.env.OCR_API_KEY;


module.exports = {
    GetOcrPDF: async function(urlPublic) {
        return await GetOcrPDF(urlPublic);
    },
    GetOcrImage: async function (urlPublic) {
        return await GetOcrImage(urlPublic);
    },
};

async function GetOcrPDF(urlPublic){

    let ocrDataTextArray = [];
    try{

        const bodyReq = {pdfUrl: urlPublic};
        const headersReq = {auth: OCR_API_KEY};

        console.info("CALLS OCR");
        const ocrData =  await utils.POST(OCR_PDF_URL, bodyReq, headersReq);
        const ocrDataText = ocrData.recognizedText;

        ocrDataTextArray = ocrDataText.split("==== ").filter(v=> v !== "");


    }
    catch(error){
        const fullError = {message:"Error al procesar archivo PDF", stack:error};
        console.error("OCR PDF");
        console.error(JSON.stringify(error));        
        throw fullError;
    }
    
    return ocrDataTextArray;

}
async function GetOcrImage(urlPublic){
    
        let ocrData = null;
        try{
    
            const bodyReq = {imageUrl: urlPublic};
            const headersReq = {auth: OCR_API_KEY};
    
            console.info("CALLS IMG");
            ocrData =  await utils.POST(OCR_IMG_URL, bodyReq, headersReq);    
        }
        catch(error){
            const fullError = {message:"Error al procesar archivo IMG", stack:error};

            console.error("OCR IMG");
            console.error(JSON.stringify(error));        
            throw fullError;
        }
        
        return ocrData;    
}