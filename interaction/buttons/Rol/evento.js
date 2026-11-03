const fs = require('fs');
const path = require('path');
const { crearBoton } = require('../../../utils/constructores/crearComponente');
const { responderEfimero } = require('../../eventos/_comun');

// Cada evento vive en su propio archivo de interaction/eventos (fuera de buttons/, para que el loader no lo tome por un botón):
//   module.exports = { id: "campana_resonancia", acciones: { tocar: async (ctx) => {}, observar: async (ctx) => {} } }
// customId: evento-<userId>-<characterId>-<idEvento>-<accion>-<extras...>
// Si el customId no trae acción se ejecuta acciones.default. Los archivos que empiezan por "_" son utilidades, no eventos.
const EVENTOS_DIR = path.join(__dirname, '..', '..', 'eventos');

function cargarEventos() {
    const eventos = new Map();
    for (const archivo of fs.readdirSync(EVENTOS_DIR)) {
        if (!archivo.endsWith('.js') || archivo.startsWith('_')) continue;
        try {
            const evento = require(path.join(EVENTOS_DIR, archivo));
            if (!evento?.id || typeof evento.acciones !== 'object') {
                console.error(`⚠️ [evento] '${archivo}' no exporta { id, acciones }`);
                continue;
            }
            if (eventos.has(evento.id)) console.error(`⚠️ [evento] id duplicado '${evento.id}' en '${archivo}'`);
            eventos.set(evento.id, evento);
        } catch (err) {
            console.error(`⚠️ [evento] Error al cargar '${archivo}':`, err.message);
        }
    }
    return eventos;
}

const eventos = cargarEventos();

module.exports = crearBoton({
    customId: "evento",
    // Los botones de evento enviados a un canal no llevan userId: manejarComponente solo aplica soloAutor si lo llevan
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: false },
        soul: { obtener: true, required: false },
        cachepj: { obtener: true, required: false }
    },

    ejecutar: async (ctx) => {
        const [idEvento, accion, ...extras] = ctx.componentData.extras || [];
        const acciones = eventos.get(idEvento)?.acciones || {};
        const nombreAccion = accion || 'default';
        const ejecutarAccion = Object.hasOwn(acciones, nombreAccion) ? acciones[nombreAccion] : null;

        if (typeof ejecutarAccion !== 'function') {
            return responderEfimero(ctx.interaction, "Este evento ya no se encuentra disponible 〒▽〒");
        }

        await ejecutarAccion({ ...ctx, evento: { id: idEvento, accion, extras } });
    }
});
