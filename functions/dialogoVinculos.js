// functions/dialogoVinculos.js
// Vínculos de variables: una variable del evento puede llevar su valor final al
// documento del jugador cuando termina el diálogo (p. ej. {resonancia} se suma a
// Soul.sendero.resonancia).
//
// Como escriben directamente en la ficha del jugador, solo los APROBADORES pueden
// crearlos o cambiarlos desde el dashboard, y solo hacia los DESTINOS de este
// catálogo. El servidor lo impone al guardar y el bot lo vuelve a comprobar al
// aplicarlos, por si alguien edita el documento a mano en la base de datos.
//
// Server.js también carga este módulo: getDataCharacters se pide dentro de
// aplicarVinculos para no requerir Server.js antes de que termine de exportar.

/** IDs de Discord que pueden aprobar vínculos */
const APROBADORES = ['665421882694041630'];

/**
 * Campos del Soul en los que puede escribir un vínculo.
 * `modos`: add (suma), sub (resta), set (reemplaza).
 * `maximo`: tope por defecto del valor que un diálogo puede escribir; el aprobador puede cambiarlo.
 * Las opciones las edita cualquier mod, así que el tope es lo que limita cuánto da un diálogo.
 */
const DESTINOS = {
    'sendero.resonancia': { nombre: 'Resonancia', tipo: 'number', modos: ['add', 'sub', 'set'], maximo: 50 },
    'sendero.disonancia': { nombre: 'Disonancia', tipo: 'number', modos: ['add', 'sub', 'set'], maximo: 50 },
    'sendero.hilosLunares': { nombre: 'Hilos lunares', tipo: 'number', modos: ['add', 'sub', 'set'], maximo: 10 },
};

const esAprobador = (discordId) => APROBADORES.includes(String(discordId));

/**
 * Normaliza un vínculo contra el catálogo y el tipo de su variable.
 * No mira la aprobación: devuelve solo { destino, modo, maximo } o null si no es válido.
 */
function normalizarVinculo(vinculo, tipoVariable) {
    if (!vinculo || typeof vinculo !== 'object') return null;
    const destino = DESTINOS[vinculo.destino];
    if (!destino || destino.tipo !== tipoVariable) return null;

    const modo = destino.modos.includes(vinculo.modo) ? vinculo.modo : destino.modos[0];
    const maximo = Number(vinculo.maximo);
    return { destino: vinculo.destino, modo, maximo: maximo > 0 ? Math.floor(maximo) : destino.maximo };
}

const mismoVinculo = (a, b) => Boolean(a && b) && a.destino === b.destino && a.modo === b.modo && a.maximo === b.maximo;

/** Vínculo válido y aprobado por alguien que sigue siendo aprobador */
function vinculoAprobado(variable) {
    const normalizado = normalizarVinculo(variable?.vinculo, variable?.type);
    if (!normalizado || !esAprobador(variable.vinculo.aprobadoPor)) return null;
    return normalizado;
}

/**
 * Lista lo que el diálogo debe escribir en el jugador con el contexto final.
 * @returns {{ variable: string, destino: string, modo: string, valor: number }[]}
 */
function resolverVinculos(dialogue, context = {}) {
    const variables = Array.isArray(dialogue?.variables) ? dialogue.variables : [];
    const resultado = [];

    for (const variable of variables) {
        const vinculo = vinculoAprobado(variable);
        if (!vinculo) continue;

        const crudo = Number(context[variable.name]);
        if (!Number.isFinite(crudo)) continue;
        // Sumar o restar 0 no cambia nada; un `set` a 0 sí es intencional
        if (vinculo.modo !== 'set' && crudo === 0) continue;

        const valor = Math.max(-vinculo.maximo, Math.min(vinculo.maximo, crudo));
        if (valor !== crudo) {
            console.warn(`[dialogoVinculos] {${variable.name}} = ${crudo} supera el tope de ${vinculo.maximo} en '${dialogue?._id}': se aplica ${valor}.`);
        }

        resultado.push({ variable: variable.name, destino: vinculo.destino, modo: vinculo.modo, valor });
    }

    return resultado;
}

/** Traduce los vínculos a una sola operación de MongoDB */
function construirUpdate(vinculos) {
    const $inc = {};
    const $set = {};

    for (const { destino, modo, valor } of vinculos) {
        if (modo === 'set') $set[destino] = valor;
        else $inc[destino] = ($inc[destino] || 0) + (modo === 'sub' ? -valor : valor);
    }

    const update = {};
    if (Object.keys($inc).length) update.$inc = $inc;
    if (Object.keys($set).length) update.$set = $set;
    return update;
}

/**
 * Escribe los vínculos en el Soul del personaje. Nunca crea un Soul: si no existe,
 * los vínculos se devuelven como pendientes para que el hook decida qué hacer.
 * @returns {Promise<{ aplicados: object[], pendientes: object[] }>}
 */
async function aplicarVinculos(vinculos, characterId) {
    if (!vinculos?.length) return { aplicados: [], pendientes: [] };

    const { buildPjFilter, souls } = require('../utils/getDataCharacters');
    const filtro = buildPjFilter(characterId);
    if (!filtro) return { aplicados: [], pendientes: vinculos };

    const { matchedCount } = await souls.updateOne(filtro, construirUpdate(vinculos));
    if (matchedCount === 0) {
        console.warn(`[dialogoVinculos] El personaje ${characterId} no tiene Soul: ${vinculos.length} vínculo(s) quedan pendientes.`);
        return { aplicados: [], pendientes: vinculos };
    }

    return { aplicados: vinculos, pendientes: [] };
}

/**
 * Para el servidor: decide con qué vínculos se guardan las variables.
 *  - Un aprobador puede crear, cambiar o quitar vínculos; los nuevos o cambiados se firman con su ID.
 *  - Cualquier otro conserva los vínculos ya guardados, mande lo que mande.
 * @param {object[]} saneadas - Variables ya saneadas (sin vínculo)
 * @param {object[]} entrantes - Variables tal cual llegan del dashboard
 * @param {object[]} guardadas - Variables del documento actual en la base de datos
 * @param {string} usuarioId
 * @returns {{ variables: object[], rechazados: string[] }}
 */
function fusionarVinculos(saneadas, entrantes, guardadas, usuarioId) {
    const porNombre = (lista) => new Map((Array.isArray(lista) ? lista : []).filter(v => v?.name).map(v => [v.name, v]));
    const entrantesPorNombre = porNombre(entrantes);
    const guardadasPorNombre = porNombre(guardadas);
    const aprobador = esAprobador(usuarioId);
    const rechazados = [];

    const variables = saneadas.map((variable) => {
        const guardada = guardadasPorNombre.get(variable.name);
        const previo = guardada?.type === variable.type ? guardada.vinculo : null;
        const pedido = normalizarVinculo(entrantesPorNombre.get(variable.name)?.vinculo, variable.type);
        const mismo = mismoVinculo(pedido, normalizarVinculo(previo, variable.type));

        if (!aprobador) {
            // Pedir otro destino/modo, o quitar uno que ya existe, se ignora y se avisa
            const intentaCambiar = pedido ? !mismo : Boolean(previo);
            if (intentaCambiar) rechazados.push(variable.name);
            return previo ? { ...variable, vinculo: previo } : variable;
        }

        if (!pedido) return variable;
        if (mismo) return { ...variable, vinculo: previo };
        return { ...variable, vinculo: { ...pedido, aprobadoPor: String(usuarioId), aprobadoEn: new Date().toISOString() } };
    });

    return { variables, rechazados };
}

/** Catálogo público para el dashboard */
function catalogoPublico(usuarioId) {
    return {
        puedeAprobar: esAprobador(usuarioId),
        destinos: Object.entries(DESTINOS).map(([destino, d]) => ({ destino, ...d })),
    };
}

module.exports = {
    APROBADORES,
    DESTINOS,
    esAprobador,
    resolverVinculos,
    aplicarVinculos,
    fusionarVinculos,
    catalogoPublico,
};
