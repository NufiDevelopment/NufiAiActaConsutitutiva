
const actaConstitutivaService = require("../shared/service/actaConstitutivaService");

module.exports = async function (context, req) {

    context.res = await actaConstitutivaService.GuardaActaConstitutiva(req);

    console.log("Termina Request");

}