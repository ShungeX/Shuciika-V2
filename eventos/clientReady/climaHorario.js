// Arranca el módulo clima-horario cuando el bot terminó de cargar (Mongo y Cloudinary listos).
// No espera: clientReady ejecuta sus archivos en serie.
module.exports = (client) => {
    const arrancar = () => {
        require("../../functions/Clima").iniciar(client)
            .catch((err) => console.error("[Clima] Error al iniciar el módulo clima-horario:", err));
    };
    if (client.listo) arrancar();
    else client.once("cargaCompleta", arrancar);
};
