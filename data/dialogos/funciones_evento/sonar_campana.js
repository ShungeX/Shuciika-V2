const path = require('path');

const apertura = require(path.join(__dirname, '..', '..', '..', 'functions', 'Apertura', 'apertura.js'));

module.exports = {
    id: "sonar_campana",
    nombre: "Apertura — Sonar la Campana",
    descripcion: "Marca el final de la ceremonia de apertura: desde ahora todas las cartas son la final, se editan las cartas pre-apertura en tandas y se avisa a quien pidió recordatorio. Solo suena una vez.",

    ejecutar: async function () {
        const r = await apertura.sonarCampana({ origen: 'dialogo' });
        if (r.yaSonada) console.log('[Hook: sonar_campana] La Campana ya había sonado; no se repite.');
    }
};
