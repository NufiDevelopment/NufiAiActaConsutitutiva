const sql = require("mssql"),
    dbTimeout = parseInt(process.env.DB_TIMEOUT);
    config = {
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        server: process.env.DB_HOST,
        database: process.env.DB_NAME,
        options: { trustServerCertificate: true},
        connectionTimeout: 16000,
        requestTimeout:dbTimeout
  };

module.exports = {
    query: function(query) {
        return new Promise((resolve, reject) => {
            if(/<script[\s\S]*?>[\s\S]*?<\/script>/gi.test(query)){
                return reject("Error no se puede procesar la petición");
            }

            new sql.ConnectionPool(config)
                .connect()
                .then(pool => {
                    return pool.query(query);
                })
                .then(result => {
                    resolve(result.recordset);
                })
                .catch(err => {
                    reject(`Error al conectar con DB ${err}`);
                });
        });
    },
    insert: function(data, table) {
        if(typeof data != "object") return Promise.reject( "Error al insertar datos, campo data debe ser un objecto valido");
        if(Object.keys(data).length == 0) return Promise.reject("Error al insertar datos, campo data debe tener valores");

        let fields = Object.keys(data).map(function(v) {return `[${v}]`;}).join(","),
          values = Object.values(data)
            .map(function(v) {
              if(typeof v == "number") return v;
              else if(typeof v == "string") return `'${v.replace(/[']+/g, "")}'`;
              else return "''";
            })
            .join(","),
          query = `INSERT INTO ${table}(${fields}) VALUES(${values});SELECT SCOPE_IDENTITY() as id;`.replace(/,+/, ",");
        return new Promise((resolve, reject) => {
            if(/<script[\s\S]*?>[\s\S]*?<\/script>/gi.test(query)){
                return reject("Error no se puede procesar la petición");
            }

            new sql.ConnectionPool(config)
                .connect()
                .then(pool => {
                    return pool.query(query);
                })
                .then(result => {
                    if (result.rowsAffected.length > 0 && result.recordset.length == 1) resolve(result.recordset[0].id);
                    else reject("Error al insertar registro");
                })
                .catch(err => {
                    reject(`Error al conectar con DB ${err}`);
                });
            });
    },
    update: function(data, table, where_clause = "") {
        if(typeof data != "object") return Promise.reject( "Error al actualizar datos, campo data debe ser un objecto valido");
        if (Object.keys(data).length == 0) return Promise.reject("Error al actualizar datos, campo data debe tener valores");

        let set_clause = Object.keys(data).map(function(k) {
                if(typeof data[k] == "number") return `[${k}] = ${data[k]}`;
                else if(typeof data[k] == "string") return `[${k}] = '${data[k].replace(/[']+/g, "")}'`;
            }).join(","),
            query = `UPDATE ${table} SET ${set_clause} ${where_clause != "" ? `WHERE ${where_clause}` : ""}`.replace(/,+/, ",");

        return new Promise((resolve, reject) => {
            new sql.ConnectionPool(config)
                .connect()
                .then(pool => {
                    return pool.query(query);
                })
                .then(result => {
                    if(result.rowsAffected.length > 0) resolve(); //&& result.rowsAffected[0] > 0 
                    else reject("Error al actualizando registro");
                })
                .catch(err => {
                    reject(`Error al conectar con DB ${err}`);
                });
            });
    },
    sanitisize: function(str){
        return typeof str == "string" ? str.replace(/[']+/g, '') : "";
    },
    querySec: function(query, sqlParams) {
        return new Promise((resolve, reject) => {
            if(/<script[\s\S]*?>[\s\S]*?<\/script>/gi.test(query)){
                return reject("Error no se puede procesar la petición");
            }

            new sql.ConnectionPool(config)
                .connect()
                .then(pool => {
                    // return pool.query(query);
                    const req = pool.request();

                    sqlParams.forEach(function(param) {
                        req.input(param.name, param.type, param.value);
                    });

                    return req.query(query);
                })
                .then(result =>{

                    resolve(result.recordset);
                })
                .catch(err => {
                    reject(`Error de conexión ${err}`);
                });
        });
    },
    insertSec: function(data, table) {
        if(typeof data != "object") return Promise.reject( "Error al insertar datos, campo data debe ser un objecto valido");
        if(Object.keys(data).length == 0) return Promise.reject("Error al insertar datos, campo data debe tener valores");

        let sqlParams = [];

        let fields = Object.keys(data).map(function(v) {return `[${v}]`;}).join(","),
            params = Object.keys(data).map(function(v) {return `@${v}`;}).join(","),
            values = Object.values(data)
            .map(function(v) {
              if(typeof v == "number") return v;
              else if(typeof v == "string") return `'${v.replace(/[']+/g, "")}'`;
              else return "''";
            })
            .join(","),
        query = `INSERT INTO ${table}(${fields}) VALUES(${params});SELECT SCOPE_IDENTITY() as id;`.replace(/,+/, ",");

        Object.entries(data).forEach(([key, value]) => {

            let v = '';

            if(typeof value == "number"){ 
                v = value;
                sqlParams.push(this.getParams(key, v, sql.Int));
            }
            else if(typeof value == "string"){
                v = `${value.replace(/[']+/g, "")}`;

                if(v.length > 100)
                    sqlParams.push(this.getParams(key, v, sql.VarChar(sql.MAX)));
                 else
                     sqlParams.push(this.getParams(key, v, sql.VarChar()));
            }
            else if(typeof value === "undefined" || value === null){
                sqlParams.push(this.getParams(key, null, sql.VarChar()));
           }
            else{ 
                v = "''";
                sqlParams.push(this.getParams(key, null, sql.VarChar()));
            }            
        });

        return new Promise((resolve, reject) => {
            if(/<script[\s\S]*?>[\s\S]*?<\/script>/gi.test(query)){
                return reject("Error no se puede procesar la petición");
            }

            new sql.ConnectionPool(config)
                .connect()
                .then(pool => {
                    const req = pool.request();

                    sqlParams.forEach(function(param) {
                        req.input(param.name, param.type, param.value);
                    });

                    return req.query(query);
                })
                .then(result => {
                    if (result.rowsAffected.length > 0 && result.recordset.length == 1) resolve(result.recordset[0].id);
                    else reject("Error al insertar registro");
                })
                .catch(err => {
                    reject(`Error al conectar con DB ${err}`);
                });
            });
    },
    updateSec: function(data, table, where_clause = "", param_where = {}) {
        if(typeof data != "object") return Promise.reject( "Error al actualizar datos, campo data debe ser un objecto valido");
        if (Object.keys(data).length == 0) return Promise.reject("Error al actualizar datos, campo data debe tener valores");
        if (where_clause == "")  return Promise.reject("Error al actualizar datos, Where debe tener valores");

        let sqlParams = [];

        let set_clause = Object.keys(data).map(function(k) {
                return `[${k}] = @${k}`;
                
            }).join(","),
            query = `UPDATE ${table} SET ${set_clause} ${where_clause != "" ? `WHERE ${where_clause}` : ""}`.replace(/,+/, ",");

            Object.entries(data).forEach(([key, value]) => {
                let v = '';
                
                if(typeof value == "number"){
                    v = value;
                    sqlParams.push(this.getParams(key, v, sql.Int));
                   }
                   else if(typeof value == "string"){ 
                       v = `${value.replace(/[']+/g, "")}`;
   
                       if(v.length > 100)
                           sqlParams.push(this.getParams(key, v, sql.VarChar(sql.MAX)));
                        else
                            sqlParams.push(this.getParams(key, v, sql.VarChar()));
                   }
                   else if(typeof value === "undefined" || value === null){
                        sqlParams.push(this.getParams(key, null, sql.VarChar()));
                   }
            });

            Object.entries(param_where).forEach(([key, value]) => {
                let v = '';    
                
                if(typeof value == "number"){
                 v = value;
                 sqlParams.push(this.getParams(key, v, sql.Int));
                }
                else if(typeof value == "string"){ 
                    v = `${value.replace(/[']+/g, "")}`;

                    if(v.length > 100)
                    sqlParams.push(this.getParams(key, v, sql.VarChar(sql.MAX)));
                 else
                     sqlParams.push(this.getParams(key, v, sql.VarChar()));
                }
                
            });

        return new Promise((resolve, reject) => {
            new sql.ConnectionPool(config)
                .connect()
                .then(pool => {
                    const req = pool.request();

                    sqlParams.forEach(function(param) {
                        req.input(param.name, param.type, param.value);
                    });

                    return req.query(query);
                })
                .then(result => {
                    if(result.rowsAffected.length > 0) resolve(); //&& result.rowsAffected[0] > 0 
                    else reject("Error al actualizando registro");
                })
                .catch(err => {
                    reject(`Error al conectar con DB ${err}`);
                });
            });
    },
    getParams: function(paramName, paramVal, paramType = sql.VarChar(100)){
        return {"name": paramName, "type": paramType, "value": paramVal}
    },
    tabla: {        
        actaConstitutiva: 'Nufi_OpenAI_ActaConstitutiva',
        actaConstitutivaQueries: 'Nufi_OpenAI_ActaConstitutiva_Queries',
        tokens: 'Nufi_OpenAI_Tokens'
    }
};
