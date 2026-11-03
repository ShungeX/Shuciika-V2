// functions/dialogoCondiciones.js
// Condiciones, variantes y plantillas de respuesta de los diálogos del dashboard.
//
// IMPORTANTE: el editor web (webDiscord/js/dashboard.js) tiene una copia de esta
// misma lógica para la vista previa ("evaluador de condiciones"). Si cambias las
// reglas aquí, cámbialas también allí: ambas copias se prueban con la misma tabla
// de casos, y una divergencia haría que la previa mienta sobre lo que verá Discord.
//
// Árbol de condición:
//   { tipo: 'grupo', op: 'Y' | 'O', items: [nodos] }
//   { tipo: 'cond', variable, operador, valor }
//
// Variante (de un paso o de una plantilla):
//   { condicion: nodo, content?, embedTitle?, embedDescription?, nextStep? }

const OPERADORES = ['=', '!=', '>', '>=', '<', '<=', 'contiene'];
const OPERADORES_ORDEN = ['>', '>=', '<', '<='];
const PROFUNDIDAD_MAX = 3;
const MAX_ITEMS_GRUPO = 10;
const MAX_VARIANTES = 10;

function valorPorDefecto(tipo) {
    if (tipo === 'number') return 0;
    if (tipo === 'boolean') return false;
    return '';
}

function castear(valor, tipo) {
    if (tipo === 'number') {
        const n = Number(valor);
        return Number.isFinite(n) ? n : 0;
    }
    if (tipo === 'boolean') return valor === true || valor === 'true';
    return valor === null || valor === undefined ? '' : String(valor);
}

/**
 * Valor actual de una variable, casteado a su tipo declarado. Una variable que
 * nunca se asignó vale su valor por defecto (0, false o ''), igual que hace
 * aplicarSetVar al sumar sobre una variable vacía.
 */
function valorDeVariable(nombre, context, variables) {
    const declarada = (variables || []).find(v => v && v.name === nombre);
    const tipo = declarada?.type || 'string';
    const crudo = context ? context[nombre] : undefined;
    if (crudo === undefined || crudo === null || crudo === '') {
        return { tipo, valor: valorPorDefecto(tipo) };
    }
    return { tipo, valor: castear(crudo, tipo) };
}

function compararCondicion(cond, context, variables) {
    if (!cond || !cond.variable || !OPERADORES.includes(cond.operador)) return false;

    const { tipo, valor: izq } = valorDeVariable(cond.variable, context, variables);
    const der = castear(cond.valor, tipo);

    // Mayor/menor solo tienen sentido sobre números
    if (OPERADORES_ORDEN.includes(cond.operador) && tipo !== 'number') return false;

    switch (cond.operador) {
        case '=': return izq === der;
        case '!=': return izq !== der;
        case '>': return izq > der;
        case '>=': return izq >= der;
        case '<': return izq < der;
        case '<=': return izq <= der;
        case 'contiene': return String(izq).toLowerCase().includes(String(der).toLowerCase());
        default: return false;
    }
}

/**
 * Devuelve true, false, o null si el nodo está vacío (un grupo sin condiciones
 * no restringe nada y se ignora dentro de su grupo padre).
 */
function evaluarNodo(nodo, context, variables, profundidad) {
    if (!nodo || typeof nodo !== 'object') return null;

    if (nodo.tipo === 'cond') return compararCondicion(nodo, context, variables);

    if (nodo.tipo === 'grupo') {
        if (profundidad > PROFUNDIDAD_MAX) return null;
        const resultados = (Array.isArray(nodo.items) ? nodo.items.slice(0, MAX_ITEMS_GRUPO) : [])
            .map(item => evaluarNodo(item, context, variables, profundidad + 1))
            .filter(r => r !== null);
        if (resultados.length === 0) return null;
        return nodo.op === 'O' ? resultados.some(Boolean) : resultados.every(Boolean);
    }

    return null;
}

/**
 * ¿Se cumple la condición? Una condición sin ninguna regla real NO se cumple:
 * así una variante recién creada, todavía sin condiciones, no eclipsa al resto
 * ni al contenido por defecto.
 */
function evaluarCondicion(nodo, context, variables) {
    return evaluarNodo(nodo, context, variables, 1) === true;
}

/** Índice de la primera variante cuya condición se cumple, o -1. */
function resolverVariante(variantes, context, variables) {
    if (!Array.isArray(variantes)) return -1;
    const lista = variantes.slice(0, MAX_VARIANTES);
    for (let i = 0; i < lista.length; i++) {
        if (lista[i] && evaluarCondicion(lista[i].condicion, context, variables)) return i;
    }
    return -1;
}

const tieneTexto = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * Paso efectivo con los textos de la variante aplicados.
 *
 * NUNCA muta `paso`: el diálogo está cacheado en memoria por dialogoManager y lo
 * comparten todos los usuarios, así que modificarlo cambiaría el paso para todos.
 * Solo se sobrescribe lo que la variante rellena; color, imágenes y componentes
 * son siempre los del paso.
 */
function aplicarVariante(paso, variante) {
    if (!paso || !variante) return paso;

    const efectivo = { ...paso };
    if (tieneTexto(variante.content)) efectivo.content = variante.content;

    const tocaEmbed = tieneTexto(variante.embedTitle) || tieneTexto(variante.embedDescription);
    if (tocaEmbed && Array.isArray(paso.embeds) && paso.embeds.length > 0) {
        const primero = { ...paso.embeds[0] };
        if (tieneTexto(variante.embedTitle)) primero.title = variante.embedTitle;
        if (tieneTexto(variante.embedDescription)) primero.description = variante.embedDescription;
        efectivo.embeds = [primero, ...paso.embeds.slice(1)];
    }

    const salto = Number(variante.nextStep);
    if (variante.nextStep !== undefined && variante.nextStep !== null && variante.nextStep !== '' && Number.isInteger(salto) && salto >= 0) {
        efectivo.nextStep = salto;
    }

    return efectivo;
}

/** Paso efectivo para un índice de variante concreto (-1 = el paso tal cual). */
function pasoConVariante(paso, indice) {
    if (!paso || !Number.isInteger(indice) || indice < 0) return paso;
    const variante = Array.isArray(paso.variantes) ? paso.variantes[indice] : null;
    return variante ? aplicarVariante(paso, variante) : paso;
}

/**
 * Construye un paso sintético a partir de una plantilla de respuesta, listo para
 * dialogoManager.buildMessageOptions / sendEditMessage.
 *
 * El texto sale de la primera variante que encaja, o del texto por defecto. Si la
 * plantilla usa un Diseño guardado, el texto va en la descripción del embed (los
 * Diseños solo aportan el estilo: no tienen título ni descripción propios).
 */
function construirPasoDePlantilla(plantilla, dialogue, context) {
    if (!plantilla) return null;

    const variables = Array.isArray(dialogue?.variables) ? dialogue.variables : [];
    const idx = resolverVariante(plantilla.variantes, context, variables);
    const varianteTexto = idx >= 0 ? plantilla.variantes[idx]?.content : '';
    const texto = tieneTexto(varianteTexto) ? varianteTexto : (plantilla.content || '');

    const presets = Array.isArray(dialogue?.embedPresets) ? dialogue.embedPresets : [];
    const preset = plantilla.embedPreset ? presets.find(p => p && p.id === plantilla.embedPreset) : null;

    if (preset) {
        const { id, name, ...estilo } = preset;
        return { type: 'send', content: '', embeds: [{ ...estilo, description: texto }], varianteUsada: idx };
    }

    return { type: 'send', content: texto, varianteUsada: idx };
}

function obtenerPlantilla(dialogue, plantillaId) {
    if (!plantillaId) return null;
    const lista = Array.isArray(dialogue?.plantillas) ? dialogue.plantillas : [];
    return lista.find(p => p && p.id === plantillaId) || null;
}

module.exports = {
    OPERADORES,
    OPERADORES_ORDEN,
    PROFUNDIDAD_MAX,
    MAX_ITEMS_GRUPO,
    MAX_VARIANTES,
    valorDeVariable,
    evaluarCondicion,
    resolverVariante,
    aplicarVariante,
    pasoConVariante,
    construirPasoDePlantilla,
    obtenerPlantilla
};
