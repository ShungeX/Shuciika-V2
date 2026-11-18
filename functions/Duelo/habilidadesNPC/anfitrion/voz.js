// ─── El Anfitrión: voz (VII) ─────────────────────────────────────────────────
// En solitario te responde con tu propia voz, en primera persona. En grupo nunca habla.
// Antes de la Ruptura no hay voz: solo la acción del disfraz ("Te observa" y sus variantes).
// La voz se construye con datos del personaje, nunca del usuario real.

const { CATEGORIAS, rasgos } = require("./perfil")

const azar = (lista) => lista[Math.floor(Math.random() * lista.length)]

/** Fase I: la única acción del disfraz, en el log de "Últimas acciones". */
const OBSERVA = Object.freeze([
    "Te observa.",
    "Eres tú.",
    "Te reflejas a ti mismo.",
    "Te mira sin parpadear.",
    "Imita tu postura.",
])
const observa = () => azar(OBSERVA)

/** Frase con la voz del personaje según el momento. `datos.huidas` y `datos.heraldo` vienen de la cuenta/alma. */
function frase(momento, pj, datos = {}) {
    const { masUsada, evitada } = rasgos(pj)
    const hacer = (c) => CATEGORIAS[c] || "eso"
    const lineas = {
        ruptura: [
            "Gracias por enseñarme cómo te mueves. Ahora me toca a mí.",
            masUsada ? `Te pasaste todo este rato sin dejar de ${hacer(masUsada)}. Ya sé dónde vas a pararte.` : null,
        ],
        fase2: [masUsada ? `Siempre eliges ${hacer(masUsada)}. Yo también. Por eso sé dónde vas a pararte.` : "Bienvenido. Siéntate. Ya sé dónde."],
        fase3: ["¿Cuál de nosotros soy yo? Tú tampoco lo sabes."],
        fase4: [evitada ? `Nunca quise ${hacer(evitada)}. ¿Qué te hace pensar que hoy no?` : "Ahora te enseño lo que nunca fuiste."],
        vidaBaja: ["Estás cansado. Yo no. Soy tú, sin cansancio."],
        repite: [masUsada ? `Otra vez ${hacer(masUsada)}. Lo sabía antes que tú.` : "Otra vez lo mismo."],
        duda: ["Tú... no. Eso no... era.", "Espera. ¿Qué... eres?", "No... te leo."],
        huidas: [datos.huidas > 0 ? `Ya te fuiste ${datos.huidas === 1 ? "una vez" : `${datos.huidas} veces`}. Aquí sigo.` : null],
        heraldo: [datos.heraldo ? `¿Le rezas a ${datos.heraldo}? Yo también. Mira de qué nos sirvió.` : null],
        final: ["..."],
    }
    let opciones = (lineas[momento] || []).filter(Boolean)
    // La Ruptura y la Fase II mezclan huidas y Heraldo cuando existen
    if (momento === "ruptura" || momento === "fase2") opciones.push(...lineas.huidas.filter(Boolean), ...lineas.heraldo.filter(Boolean))
    // Lo que ya dijo en este combate no lo repite
    if (datos.dichos) opciones = opciones.filter(o => !datos.dichos.has(`«${o}»`))
    return opciones.length ? `«${azar(opciones)}»` : null
}

/** Narración del sistema (sin voz): cambio de perspectiva, final... */
const NARRACION = Object.freeze({
    perspectiva: (nombre) => `Inclina la cabeza. Ahora tiene la forma de ${nombre}.`,
    ruptura: "El espejo se resquebraja. Lo que había detrás nunca fue un Sosias.",
    reflejos: "El espejo se rompe en seis reflejos. Todos te sonríen igual.",
    despedida: "Los reflejos se recogen en uno solo. Ya no copia lo que haces: copia lo que evitas.",
    final: (nombre) => `${nombre} se desvanece sin ruido, como los Kurayami. Durante un rato, el espejo del Salón muestra tu reflejo con medio segundo de retraso.`,
    sinHuida: "Aquí ya no se puede huir.",
    robo: (nombre, quien) => `Algo se te escapa de las manos: El Anfitrión tiene ahora tu ${nombre}${quien ? ` (${quien})` : ""}.`,
    devolucion: (nombre, quien) => (quien ? `Lo usó. ${nombre} vuelve a ${quien}.` : `Lo usó. Tu ${nombre} vuelve a ti.`),
    recompone: (nombre) => `${nombre} se recompone en el cristal.`,
    solar: (a, b) => `Tus ojos solares notan que la luz no se dobla igual en ${a} y ${b}.`,
})

module.exports = { OBSERVA, observa, frase, NARRACION }
