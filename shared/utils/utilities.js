const {v1: uuidv4 } = require('uuid'),
moment   = require("moment"),
request  = require('request');
DB       = require("../utils/DB");

module.exports = {
    POST: async function(url, body, headers, timeout = 420000){
        return new Promise((resolve, reject) => {  
            request({
                url:url,
                method:'POST',
                json: body,
                headers:headers,
                timeout: timeout
            },
            (error, response, bodyResponse) =>{
                if(!response || !response.statusCode ||  response.statusCode !== 200) {
                    const errorData = {error: error, bodyResponse: bodyResponse, url: url, bodyRequest: body};
                    return setTimeout(() => { reject(errorData)}, 3000);
                }
                else{
                    resolve(bodyResponse);
                }
            });
        });
    }
}
