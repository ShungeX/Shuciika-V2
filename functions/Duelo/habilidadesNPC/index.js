// ─── Habilidades únicas de NPCs ──────────────────────────────────────────────
// Un NPC con `habilidadUnica` ejecuta aquí su lógica propia antes de su IA normal. Cada habilidad
// devuelve true si usó el turno.
//   sosias          → NPC-004 (campo de la colección NPCs, elegible en el dashboard)
//   anfitrion       → el jefe oculto que a veces está detrás de Sosias (lo pone encuentros.js)
//   anfitrion_eco   → los señuelos de su Fase III (los crea el propio Anfitrión)
// Imports diferidos: las habilidades arrastran el sistema de combate.

/** Habilidades que se pueden guardar en un NPC desde el dashboard. */
const HABILIDADES = Object.freeze(["sosias", "anfitrion"])

const MODULOS = {
    sosias: () => require("./sosias"),
    anfitrion: () => require("./anfitrion"),
    anfitrion_eco: () => require("./anfitrion"),
}

/** Turno de la habilidad única del NPC. true = el turno ya se usó. */
async function turnoHabilidad(session, npc) {
    const cargar = MODULOS[npc?.habilidadUnica]
    if (!cargar) return false
    if (npc.habilidadUnica === "anfitrion_eco") return cargar().turnoSenuelo(session, npc)
    return cargar().turno(session, npc)
}

/** Vida por debajo de la cual el NPC no puede bajar (0 = sin piso). */
function pisoVida(npc) {
    return npc?.habilidadUnica === "anfitrion" ? MODULOS.anfitrion().pisoVida(npc) : 0
}

/** Daño efectivo recibido por un NPC con habilidad (rupturas, cambios de fase...). */
function alRecibirDanio(npc, efectivo, origen) {
    if (npc?.habilidadUnica === "anfitrion") MODULOS.anfitrion().alRecibirDanio(npc, efectivo, origen)
}

/** Un jugador acaba de actuar (antes de aplicar su daño): las habilidades que leen hábitos lo miran. */
function alActuarJugador(session, pj, categoria) {
    if (session?.anfitrion?.realId == null) return
    MODULOS.anfitrion().alActuarJugador(session, pj, categoria)
}

/** Multiplicador del daño que recibe un NPC por el combo de quien le pega (1 = sin bonus). */
function bonusCombo(npc, caster) {
    if (npc?.habilidadUnica !== "anfitrion" || !caster || caster.isNPC) return 1
    return MODULOS.anfitrion().bonusCombo(npc, caster)
}

/** Un NPC con habilidad acaba de bloquear el golpe que esperaba. */
function trasBloquear(session, npc, pj) {
    if (npc?.habilidadUnica === "anfitrion") MODULOS.anfitrion().trasBloquear(session, npc, pj)
}

module.exports = { HABILIDADES, turnoHabilidad, pisoVida, alRecibirDanio, alActuarJugador, trasBloquear, bonusCombo }
