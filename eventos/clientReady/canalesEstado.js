// Canales de voz con datos vivos (clima/hora, habitantes, cartas, versión). Solo Shuciika.
// Espera a cargaCompleta: necesita Mongo y la configuración (versión) ya cargadas.
module.exports = (client) => {
    const arrancar = () => setTimeout(() => require("../../functions/canalesEstado").iniciar(client), 15_000);
    if (client.listo) arrancar();
    else client.once("cargaCompleta", arrancar);
};
