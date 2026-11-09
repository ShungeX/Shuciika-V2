// ═══ CLIMA-HORARIO: textos del noticiero (climaTextos.json) ═══
// Aquí SÍ se usa Math.random: la frase es decorativa y no afecta a la simulación.

const TEXTOS = require("./climaTextos.json");

const COLOR_POR_DEFECTO = "#5865f2";
const ultimaFrase = new Map();   // regionId → última frase mostrada

const limpias = (lista) => (Array.isArray(lista) ? lista.filter((f) => typeof f === "string" && f.trim()) : []);
const azarDe = (lista) => lista[Math.floor(Math.random() * lista.length)];

function elegirSinRepetir(lista, ultima) {
    const pool = lista.length > 1 ? lista.filter((f) => f !== ultima) : lista;
    return azarDe(pool.length ? pool : lista);
}

/**
 * @param {string} estado
 * @param {string} fase
 * @param {string|null} [previo] solo en el momento del cambio de estado (para el aviso)
 * @param {object} [opciones] { regionId, textos }
 * @returns {{ titulo: string, frase: string, color: string, aviso?: string }}
 */
function getTexto(estado, fase, previo = null, { regionId = "global", textos = TEXTOS } = {}) {
    const entrada = textos.estados?.[estado]?.[fase] || {};

    let frases = limpias(entrada.frases);
    if (!frases.length) frases = limpias(textos.genericos?.porEstado?.[estado]);
    if (!frases.length) frases = limpias(textos.genericos?.porFase?.[fase]);

    const frase = frases.length ? elegirSinRepetir(frases, ultimaFrase.get(regionId)) : "...";
    ultimaFrase.set(regionId, frase);

    const resultado = {
        titulo: (entrada.titulo || "").trim() || `${fase} · ${estado}`,
        frase,
        color: /^#[0-9a-f]{6}$/i.test(entrada.color || "") ? entrada.color : COLOR_POR_DEFECTO
    };

    if (previo && previo !== estado) {
        const avisos = limpias(textos.cambios?.[`${previo}>${estado}`]);
        if (avisos.length) resultado.aviso = azarDe(avisos);
    }
    return resultado;
}

module.exports = { getTexto, TEXTOS };
