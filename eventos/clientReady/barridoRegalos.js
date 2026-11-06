const { iniciarBarrido } = require("../../functions/Regalos/regalos");

// Regalos: devuelve los vencidos, completa pasos a medias y purga lo viejo. Al arrancar
// y cada N horas (config/regalos.js → BARRIDO_CADA_MS). Va en diferido para no retrasar clientReady.
module.exports = () => {
    setTimeout(() => iniciarBarrido(), 20_000);
};
