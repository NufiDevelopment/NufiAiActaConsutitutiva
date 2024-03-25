const utils  = require("../utils/utilities");

const OCR_PDF_URL = process.env.OCR_PDF_URL;
const OCR_IMG_URL = process.env.OCR_IMG_URL;
const OCR_API_KEY = process.env.OCR_API_KEY;
const maxIntentosOcr =  parseInt(process.env.MAX_INTENTOS_OCR);


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
    let ocrData, ocrDataText;

    try{

        const bodyReq = {pdfUrl: urlPublic};
        const headersReq = {auth: OCR_API_KEY};

        for(let i = 0; i < maxIntentosOcr; i++){

            try{
            
                console.info("CALLS OCR PDF");
                ocrData =  await utils.POST(OCR_PDF_URL, bodyReq, headersReq);
                ocrDataText = ocrData.recognizedText;    

                ocrDataTextArray = ocrDataText.split("==== ").filter(v=> v !== "");

                break;
            }
            catch(err){                
                console.log("OCR ERROR intento "+(i + 1));

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
async function GetOcrImage(urlPublic){
    
        let ocrData = null, ocrDataText = "";;
        try{    
            const bodyReq = {imageUrl: urlPublic};
            const headersReq = {auth: OCR_API_KEY};

            for(let i = 0; i < maxIntentosOcr; i++){

    
                try{
            
                    console.info("CALLS OCR IMG");
                    ocrData =  await utils.POST(OCR_IMG_URL, bodyReq, headersReq);   

                    ocrData = ocrData.recognizedTexts;
                    break;    
                }
                catch(err){                
                    console.log("OCR ERROR intento "+(i + 1));

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