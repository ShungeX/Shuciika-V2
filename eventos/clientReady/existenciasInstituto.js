const { iniciarReposicion } = require("../../functions/Aprendizaje/tienda");

// Aprendizaje: cada lunes 00:00 (México) el Instituto repone sus páginas gratuitas y se redibujan los paneles.
module.exports = (client) => {
    try { iniciarReposicion(client); }
    catch (e) { console.error("[Aprendizaje] No se pudo programar la reposición del Instituto:", e.message); }
};
