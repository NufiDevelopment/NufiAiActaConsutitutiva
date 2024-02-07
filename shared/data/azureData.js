const fs = require('fs'),
{BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require("@azure/storage-blob");

const AZURE_STORAGE_CONNECTION_STRING = process.env.STORAGE_CONN;
const STORAGE_ACCT_NAME = process.env.STORAGE_ACCT_NAME;
const STORAGE_ACCT_KEY = process.env.STORAGE_ACCT_KEY;


module.exports = {
    UploadFile: async function(fileName, file, container) {
        return await UploadFileAzure(fileName, file, container);
    },
    GetUrlFile: async function(blobName, container) {
        return await GetPublicUrl(blobName, container);
    }    
};

async function UploadFileAzure(fileName, file, container){
    
    let success = false;

    try{        

        const blobServiceClient = BlobServiceClient.fromConnectionString(
            AZURE_STORAGE_CONNECTION_STRING
        );

        const containerClient = await blobServiceClient.getContainerClient(container);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);        
        const buffer = Buffer.from(file, 'base64');

        const uploadBlobResponse = await blockBlobClient.upload(buffer, buffer.byteLength );

        console.info(
            `Blob was uploaded successfully. requestId: ${uploadBlobResponse.requestId}`
        );

        success = blockBlobClient.url;        
    }
    catch(error){
        const fullError = {message:"Error al procesar documento", stack:error};

        console.error(error);
        success = false;

        throw fullError;
    }

    return success;

}
async function GetPublicUrl(blob, container){

    let publicUrl = "";

    try{

        const accountname = STORAGE_ACCT_NAME;
        const key = STORAGE_ACCT_KEY;
        const cerds = new StorageSharedKeyCredential(accountname, key);
        const blobServiceClient = new BlobServiceClient(`https://${accountname}.blob.core.windows.net`, cerds);
        const containerName = container;
        const containerClient = await blobServiceClient.getContainerClient(containerName)
        const blobName = blob;
        const blobClient = await containerClient.getBlobClient(blobName);

        const blobSAS = generateBlobSASQueryParameters({
            containerName, 
            blobName, 
            permissions: BlobSASPermissions.parse("racwd"),
            startsOn: new Date(),
            expiresOn: new Date(new Date().valueOf() + 86400)
          },
          cerds 
        ).toString();

        publicUrl = blobClient. url+"?"+blobSAS;
        console.log(publicUrl);
        
    }
    catch(error){
        const fullError = {message:"Error al procesar documento", stack:error};

        console.error(error);
        publicUrl = false;

        throw fullError;
    }

    return publicUrl;
}