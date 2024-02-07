const actaConstitutivaService = require("../shared/service/actaConstitutivaService");

module.exports = async function (context, message) {

    console.log("Queue Item Received");
    await actaConstitutivaService.ProcessWebhookQueue(message);
    
};