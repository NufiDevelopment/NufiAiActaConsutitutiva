const OpenAI  = require('openai'), 
moment = require("moment"), 
{v1: uuidv4 } = require('uuid'), 
OPENAI_KEY = process.env.OPENAI_KEY, 
client = new OpenAI({ apiKey: OPENAI_KEY }); 

const GPT_TEMP = parseFloat(process.env.GPT_TEMPERATURE),
GPT_MODEL = process.env.GPT_MODEL;


module.exports = {
    Chat: async function(uuid, prompt, tipoQuery) {
        return await Chat(uuid, prompt, tipoQuery);
    }
};

async function Chat(uuidDoc, prompt, tipoQuery){
    
    let jsonData = {};
    const uuidQuery = uuidv4();
    let chatConfig = null, chat = null, jsonString = null, completion_tokens = null, prompt_tokens = null, total_tokens = null;

    try{

        chatConfig = {
            messages: [{ role: "user", content: prompt }],
            model: GPT_MODEL,
            temperature: GPT_TEMP,
            response_format: { "type": "json_object" }
        };

        const idQuery = await saveRequestGPT(uuidQuery, uuidDoc, JSON.stringify(chatConfig), tipoQuery);

        chat = await client.chat.completions.create(chatConfig);        

        if(Object.hasOwn(chat, "usage")){
            total_tokens = chat.usage.total_tokens;
            completion_tokens = chat.usage.completion_tokens;
            prompt_tokens = chat.usage.prompt_tokens;
        }

        jsonString = chat.choices[0].message.content; 
        
        jsonData = (jsonString !== null) ? JSON.parse(jsonString): null; 

        if(jsonData !== null){

            jsonData["totalTokens"] = total_tokens;
            jsonData["totalTokensCompletion"] = completion_tokens;
            jsonData["totalTokensPrompt"] = prompt_tokens;

            await saveResponseGPT(uuidQuery, JSON.stringify(chat), jsonString, JSON.stringify(jsonData), prompt_tokens, completion_tokens, total_tokens, "success", "") ;
        }
    }
    catch(error){

        const fullError = {message: "Error al analizar documento", func: "Chat", stack:error, uuidQuery: uuidQuery};

        await saveResponseGPT(
                uuidQuery, 
                (!chat) ? null: JSON.stringify(chat), 
                jsonString, 
                (!jsonData) ? null: JSON.stringify(jsonData), 
                prompt_tokens, 
                completion_tokens, 
                total_tokens, 
                "error", 
                JSON.stringify(error)) ;
        
        console.error(fullError, uuidDoc);
        throw fullError;
    }

    return jsonData;

}

async function saveRequestGPT (uuid, Doc_UUID, prompt, typeQuery, url = ""){

    let reqTime = moment();       

    return DB.insertSec({
        uuid: uuid,
        Doc_UUID: Doc_UUID,
        tipoQuery: typeQuery,
        url: url,
        request: prompt, 
        requestDate: reqTime.format("YYYY-MM-DD HH:mm:ss"),        
        status: `Created`
    }, DB.tabla.actaConstitutivaQueries)
    .then(id => { return ( id);})
    .catch(err => { 

        const fullError = {func: "saveRequestGPT", stack:err, uuid: Doc_UUID};
        console.error(fullError, Doc_UUID);

        return console.log(err, uuid)
    });
}

async function saveResponseGPT (uuid, response, messageResponse, jsonResponse, promptTokens, completionTokens, totalTokens, status, error){

    let resTime = moment(); 

    return DB.updateSec({
        response: response,
        responseDate: resTime.format("YYYY-MM-DD HH:mm:ss"),
        messageResponse: messageResponse,
        jsonResponse: jsonResponse,
        promptTokens: promptTokens,             
        completionTokens: completionTokens,
        totalTokens: totalTokens,
        error: error,
        status: status
    }, DB.tabla.actaConstitutivaQueries, `uuid=@uuid`, {uuid:uuid})
    .catch(err => {

        const fullError = {func: "saveResponseGPT", stack:err, QueryUuid: uuid};
        console.error(fullError, uuid);

        console.error(err, uuid);
        return console.log(err, uuid)
    
    });
}
