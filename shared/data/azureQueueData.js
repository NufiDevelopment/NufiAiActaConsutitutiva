const { QueueClient } = require("@azure/storage-queue"),
moment   = require("moment");

const QUEUE_CONN = process.env.STORAGE_CONN;
const QUEUE_NAME = process.env.QUEUE_NAME;

 queueClient = new QueueClient(QUEUE_CONN, QUEUE_NAME);

module.exports = {
    AddQueueItem: async function(fileName, file, container) {
        return await AddQueueItem(fileName, file, container);
    }    
};

async function AddQueueItem(item){
    try{        
        const messageResp = await queueClient.sendMessage(jsonToBase64(item));
        console.info("Item added to Queue");

        return messageResp;
    }
    catch(err){
        const fullError = {message: "Error al procesar documento", stack: err};
        console.eror("Error Adding Item to Queue");
        throw fullError;
    }
}

function jsonToBase64(jsonObj) {
    const jsonString = JSON.stringify(jsonObj)
    return  Buffer.from(jsonString).toString('base64')
}

function encodeBase64ToJson(base64String) {
    const jsonString = Buffer.from(base64String,'base64').toString()
    return JSON.parse(jsonString)
}