// ─── Catálogo: 24 hechizos elementales + 5 universales (III.C / III.D) ──────
// Formato final (XI.D). Es la semilla que escribe scripts/migrarHechizosVias.js.
// Los números son PUNTO DE PARTIDA para INT = 10 y T = 15: se calibran con calibracion.js.

const { VIAS, ESTADOS_VALORES, BUFFS, ADQUISICION } = require("./config")
const { ESTADOS } = require("./estados")

const { HABLADO: H, MOVIMIENTO: Mo, ESCRITURA: E, MENTAL: Me } = VIAS
const CANTICO = [H, Mo, E, Me]
const INT = "inteligencia"

const RESPLANDOR_POR_ESCALON = { 1: null, 2: 3, 3: 5 }

function adquisicion(escalon) {
    if (escalon === 2) return { via: "tratado", precio: ADQUISICION.PRECIO_TRATADO }
    if (escalon === 3) return { via: "evento" }
    return { via: "inicio" }
}

const dmg = (base, multi, objetivo = "enemigos", alcance = "single") => ({ base, scaling: { stats: INT, multi }, objetivo, alcance })
const heal = (base, multi, objetivo = "aliados", alcance = "single") => ({ base, scaling: { stats: INT, multi }, objetivo, alcance })
const control = (estado, duracion, probabilidad, alcance = "single") => ({
    tipo: "control", nombre: ESTADOS[estado].nombre, duracion, probabilidad, objetivo: "enemigos", alcance,
    bloquea: [...ESTADOS[estado].bloquea],
    ...(ESTADOS[estado].rompeConDanio ? { rompeConDanio: true } : {}),
})
const lentitud = (duracion, alcance = "single") => ({ tipo: "degradacion", nombre: "Lentitud", duracion, objetivo: "enemigos", alcance })

function hechizo({ id, nombre, desc, elemento, escalon, rol, vias, mana, vida = 0, dinero = 0, cd, tiempo = 1, prob, damage, healing, efectos = [], mental, interruptible = true }) {
    const doc = {
        _id: id,
        Nombre: nombre,
        Descripcion: desc,
        Elemento: elemento,
        Escalon: escalon,
        Rol: rol,
        isActive: true,
        Req: { fe_min: 1, fe_max: null, resplandor_min: RESPLANDOR_POR_ESCALON[escalon] ?? null, resplandor_max: null, clase: null, stats: null },
        Adquisicion: adquisicion(escalon),
        Mecanicas: {
            Efectos: efectos,
            cast: {
                vias,
                mental: mental ?? { permitido: escalon <= 2 },
                tiempo, probabilidad: prob, interruptible,
            },
        },
        Costos: { mana, Vida: vida, Dinero: dinero, Cooldown: cd },
        Creado: "",
        uso: "combate",
    }
    if (damage) doc.Mecanicas.damage = damage
    if (healing) doc.Mecanicas.healing = healing
    return doc
}

const ELEMENTALES = [
    // ── Pyrós: DPS, paga con Vida ────────────────────────────────────────────
    hechizo({ id: "Pyro-001", nombre: "Chispa Ígnea", elemento: "Pyrós", escalon: 1, rol: "daño", vias: [E], mana: 5, cd: 1, prob: 1.0,
        desc: "Traza un sello de chispa que daña al enemigo y lo deja ardiendo durante 3 turnos.",
        damage: dmg(10, 1.1), efectos: [{ tipo: "dot", nombre: "Quemadura", base: 4, duracion: 3, objetivo: "enemigos", alcance: "single" }] }),
    hechizo({ id: "Pyro-002", nombre: "Brasa Penitente", elemento: "Pyrós", escalon: 2, rol: "daño", vias: [E, Mo], mana: 8, vida: 12, cd: 2, prob: 0.9,
        desc: "Quema parte de tu propia vida para descargar una brasa devastadora sobre un enemigo.",
        damage: dmg(80, 3.2) }),
    hechizo({ id: "Pyro-003", nombre: "Pira del Juicio", elemento: "Pyrós", escalon: 3, rol: "daño", vias: CANTICO, mana: 14, vida: 20, cd: 3, prob: 0.7,
        desc: "Una pira que alcanza a todos los enemigos y los deja ardiendo.",
        damage: dmg(70, 4.5, "enemigos", "todos"),
        efectos: [{ tipo: "dot", nombre: "Quemadura", base: 15, duracion: 3, objetivo: "enemigos", alcance: "todos" }] }),

    // ── Aqua: sustain y limpieza ─────────────────────────────────────────────
    hechizo({ id: "Aqua-001", nombre: "Ola Curativa", elemento: "Aqua", escalon: 1, rol: "curación", vias: [H], mana: 5, cd: 1, prob: 0.8,
        desc: "Invoca una suave ola de agua que restaura vida a un aliado o a ti.",
        healing: heal(16, 1.5) }),
    hechizo({ id: "Aqua-002", nombre: "Aguas Mansas", elemento: "Aqua", escalon: 2, rol: "curación", vias: [H, Mo], mana: 10, cd: 2, prob: 0.85,
        desc: "Cura a un aliado y lava uno de sus males.",
        healing: heal(45, 3), efectos: [{ tipo: "cleanse", nombre: "Purificación", cantidad: 1, objetivo: "aliados", alcance: "single" }] }),
    hechizo({ id: "Aqua-003", nombre: "Marea Serena", elemento: "Aqua", escalon: 3, rol: "curación", vias: CANTICO, mana: 22, cd: 3, prob: 0.7,
        desc: "Una marea que regenera a todos los aliados durante tres turnos.",
        efectos: [{ tipo: "hot", nombre: "Marea Serena", base: 30, multi: 2.5, duracion: 3, objetivo: "aliados", alcance: "todos" }] }),

    // ── Lux: soporte de grupo, protección ────────────────────────────────────
    hechizo({ id: "Lux-001", nombre: "Brillo de esperanza", elemento: "Lux", escalon: 1, rol: "curación", vias: [H], mana: 10, cd: 1, prob: 0.7,
        desc: "Emite un destello radiante que cura a todos los aliados y a ti.",
        healing: heal(26, 1.5, "aliados", "todos") }),
    hechizo({ id: "Lux-002", nombre: "Fulgor Bendito", elemento: "Lux", escalon: 2, rol: "soporte", vias: [H, Mo], mana: 12, cd: 2, prob: 0.85,
        desc: "Bendice al grupo: más daño y más defensa durante cuatro turnos.",
        healing: heal(5, 0.5, "aliados", "todos"),
        efectos: [
            { tipo: "buff", nombre: "Fulgor (daño)", stat: "daño", valor: BUFFS.daño, duracion: 4, objetivo: "aliados", alcance: "todos" },
            { tipo: "buff", nombre: "Fulgor (defensa)", stat: "defensa", valor: BUFFS.defensa, duracion: 4, objetivo: "aliados", alcance: "todos" },
        ] }),
    hechizo({ id: "Lux-003", nombre: "Gracia del Firmamento", elemento: "Lux", escalon: 3, rol: "curación", vias: CANTICO, mana: 24, dinero: 50, cd: 4, prob: 0.7,
        desc: "Una ofrenda al Firmamento devuelve a la vida a un aliado caído. Una vez por combate.",
        efectos: [{ tipo: "revive", nombre: "Gracia del Firmamento", porcentaje: 0.4, vecesPorCombate: 1, objetivo: "aliados", alcance: "single" }] }),

    // ── Rakau: híbrido, aguante ──────────────────────────────────────────────
    hechizo({ id: "Rakau-001", nombre: "Bendición de la naturaleza", elemento: "Rakau", escalon: 1, rol: "híbrido", vias: [Mo], mana: 7, cd: 1, prob: 0.6,
        desc: "Un golpe con la esencia del árbol que daña y revitaliza levemente al conjurador.",
        damage: dmg(10, 2), healing: heal(5, 2, "mismo") }),
    hechizo({ id: "Rakau-002", nombre: "Corteza Viva", elemento: "Rakau", escalon: 2, rol: "defensa", vias: [Mo, H], mana: 10, cd: 2, prob: 0.9,
        desc: "Te cubres de corteza: más defensa y regeneración durante tres turnos.",
        efectos: [
            { tipo: "buff", nombre: "Corteza Viva", stat: "defensa", valor: 0.25, duracion: 3, objetivo: "mismo", alcance: "single" },
            { tipo: "hot", nombre: "Savia", base: 10, multi: 1.5, duracion: 3, objetivo: "mismo", alcance: "single" },
        ] }),
    hechizo({ id: "Rakau-003", nombre: "Raíz del Mundo", elemento: "Rakau", escalon: 3, rol: "control", vias: CANTICO, mana: 22, cd: 3, prob: 0.7,
        desc: "Raíces brotan bajo todos los enemigos: los dañan, los inmovilizan y les impiden esquivar.",
        damage: dmg(60, 5, "enemigos", "todos"),
        efectos: [
            control("inmovilizado", 2, 0.85, "todos"),
            { tipo: "debuff", nombre: "Enraizado", stat: "esquive", valor: 0, cero: true, duracion: 2, objetivo: "enemigos", alcance: "todos" },
        ] }),

    // ── Lapis: solidez, escudos, aturdir ─────────────────────────────────────
    hechizo({ id: "Lapis-001", nombre: "Golpe Terrestre", elemento: "Lapis", escalon: 1, rol: "control", vias: [Mo], mana: 5, cd: 1, prob: 0.8,
        desc: "Conjura la fuerza de la tierra para golpear a un enemigo, causando daño y aturdimiento.",
        damage: dmg(10, 1.5), efectos: [control("aturdimiento", 2, 0.5)] }),
    hechizo({ id: "Lapis-002", nombre: "Bastión de Piedra", elemento: "Lapis", escalon: 2, rol: "defensa", vias: [Mo, E], mana: 10, cd: 2, prob: 0.9,
        desc: "Levanta un escudo de piedra sobre un aliado durante tres turnos.",
        efectos: [{ tipo: "escudo", nombre: "Bastión de Piedra", base: 35, multi: 3.5, defensa: BUFFS.defensa, duracion: 3, objetivo: "aliados", alcance: "single" }] }),
    hechizo({ id: "Lapis-003", nombre: "Derrumbe", elemento: "Lapis", escalon: 3, rol: "daño", vias: CANTICO, mana: 24, cd: 3, prob: 0.7,
        desc: "La tierra se desploma sobre todos los enemigos.",
        damage: dmg(80, 6, "enemigos", "todos"), efectos: [control("aturdimiento", 2, 0.4, "todos")] }),

    // ── Electro: burst e iniciativa ──────────────────────────────────────────
    hechizo({ id: "Electro-001", nombre: "Descarga Eléctrica", elemento: "Electro", escalon: 1, rol: "control", vias: [Mo], mana: 5, cd: 1, prob: 0.6,
        desc: "Una descarga que impacta a un enemigo, causando daño inmediato y Parálisis.",
        damage: dmg(10, 1.5), efectos: [control("paralisis", 2, 0.7)] }),
    hechizo({ id: "Electro-002", nombre: "Cadena Voltaica", elemento: "Electro", escalon: 2, rol: "daño", vias: [Mo, H], mana: 12, cd: 2, prob: 0.8,
        desc: "Un rayo que salta entre tres enemigos (100% / 70% / 50%).",
        damage: dmg(22, 2.6, "enemigos", "cadena") }),
    hechizo({ id: "Electro-003", nombre: "Relámpago Tardío", elemento: "Electro", escalon: 3, rol: "daño", vias: CANTICO, mana: 22, cd: 3, tiempo: 2, prob: 0.8,
        desc: "Reúne la tormenta durante dos turnos y la descarga sobre un único enemigo.",
        damage: dmg(150, 6), mental: { permitido: false } }),

    // ── Wind: esquive y debuffs de precisión ─────────────────────────────────
    hechizo({ id: "Wind-001", nombre: "Brisa revitalizante", elemento: "Wind", escalon: 1, rol: "soporte", vias: [H], mana: 7, cd: 1, prob: 0.8,
        desc: "Una brisa que cura levemente a un aliado y le da velocidad.",
        healing: heal(12, 1.5), efectos: [{ tipo: "buff", nombre: "Velocidad", stat: "velocidad", valor: BUFFS.velocidad, duracion: 3, objetivo: "aliados", alcance: "single" }] }),
    hechizo({ id: "Wind-002", nombre: "Paso del Viento", elemento: "Wind", escalon: 2, rol: "soporte", vias: [H, Mo], mana: 12, cd: 2, prob: 0.85,
        desc: "El grupo se mueve como el viento: más esquive y velocidad durante tres turnos.",
        healing: heal(5, 1, "aliados", "todos"),
        efectos: [
            { tipo: "buff", nombre: "Paso del Viento (esquive)", stat: "esquive", valor: BUFFS.esquive, peso: 0.6, duracion: 3, objetivo: "aliados", alcance: "todos" },
            { tipo: "buff", nombre: "Paso del Viento (velocidad)", stat: "velocidad", valor: BUFFS.velocidad, duracion: 3, objetivo: "aliados", alcance: "todos" },
        ] }),
    hechizo({ id: "Wind-003", nombre: "Torbellino", elemento: "Wind", escalon: 3, rol: "control", vias: CANTICO, mana: 22, cd: 3, prob: 0.7,
        desc: "Un torbellino golpea a todos los enemigos y les nubla la puntería.",
        damage: dmg(70, 5, "enemigos", "todos"),
        efectos: [{ tipo: "debuff", nombre: "Torbellino", stat: "precision", valor: BUFFS.precision, peso: 0.6, duracion: 3, objetivo: "enemigos", alcance: "todos" }] }),

    // ── Kryo: control y calma ────────────────────────────────────────────────
    hechizo({ id: "Kryo-001", nombre: "Soplo Helado", elemento: "Kryo", escalon: 1, rol: "control", vias: [E], mana: 5, cd: 1, prob: 0.8,
        desc: "Una runa de escarcha que daña al enemigo y lo ralentiza.",
        damage: dmg(10, 1.5), efectos: [lentitud(3)] }),
    hechizo({ id: "Kryo-002", nombre: "Escarcha Inmóvil", elemento: "Kryo", escalon: 2, rol: "control", vias: [E, Mo], mana: 12, cd: 2, prob: 0.8,
        desc: "Congela a un enemigo. Su propio daño no rompe el hielo; el siguiente golpe sí.",
        damage: dmg(45, 4.5), efectos: [control("congelado", 2, 0.7)] }),
    hechizo({ id: "Kryo-003", nombre: "Invierno Profundo", elemento: "Kryo", escalon: 3, rol: "control", vias: CANTICO, mana: 22, cd: 3, prob: 0.7,
        desc: "Un invierno que daña a todos los enemigos, los ralentiza y apaga su fuerza.",
        damage: dmg(55, 4.5, "enemigos", "todos"),
        efectos: [
            lentitud(3, "todos"),
            { tipo: "debuff", nombre: "Invierno Profundo", stat: "daño", valor: -0.25, peso: 0.5, duracion: 3, objetivo: "enemigos", alcance: "todos" },
        ] }),
]

function universal({ id, nombre, desc, via, mana, cd, efectos = [], healing, adq, resplandor = null, prob = 1 }) {
    const doc = {
        _id: id, Nombre: nombre, Descripcion: desc, Elemento: null, Escalon: null,
        Rol: healing ? "curación" : (efectos[0]?.tipo === "guardia" || efectos[0]?.tipo === "estasis" ? "defensa" : "soporte"),
        isActive: true,
        Req: { fe_min: 1, fe_max: null, resplandor_min: resplandor, resplandor_max: null, clase: null, stats: null },
        Adquisicion: adq,
        Mecanicas: { Efectos: efectos, cast: { vias: [via], mental: { permitido: false }, tiempo: 1, probabilidad: prob, interruptible: true } },
        Costos: { mana, Vida: 0, Dinero: 0, Cooldown: cd },
        Creado: "", uso: "combate",
    }
    if (healing) doc.Mecanicas.healing = healing
    return doc
}

// PENDIENTE: calibrar números con calibracion.js
const UNIVERSALES = [
    universal({ id: "univ-001", nombre: "Guardia", via: Mo, mana: 0, cd: 1, adq: { via: "inicio" },
        desc: "Te cubres: reduces a la mitad el daño que recibes hasta tu próximo turno.",
        efectos: [{ tipo: "guardia", nombre: "Guardia", valor: 0.5, duracion: 1, objetivo: "mismo", alcance: "single" }] }),
    universal({ id: "univ-002", nombre: "Concentrar", via: Me, mana: 0, cd: 2, adq: { via: "tratado", precio: ADQUISICION.PRECIO_TRATADO_BARATO },
        desc: "Cedes el turno para recuperar maná.",
        efectos: [{ tipo: "mana", nombre: "Concentrar", objetivo: "mismo", alcance: "single" }] }),
    universal({ id: "univ-003", nombre: "Provocar", via: H, mana: 5, cd: 3, adq: { via: "tratado", precio: ADQUISICION.PRECIO_TRATADO },
        desc: "Obligas a los enemigos a atacarte durante dos turnos.",
        efectos: [{ tipo: "provocar", nombre: "Provocar", duracion: 2, objetivo: "mismo", alcance: "single" }] }),
    universal({ id: "univ-004", nombre: "Primeros auxilios", via: Mo, mana: 4, cd: 2, adq: { via: "tratado", precio: ADQUISICION.PRECIO_TRATADO_BARATO },
        desc: "Una cura pequeña para un aliado o para ti.",
        healing: heal(10, 0.5) }),
    universal({ id: "univ-005", nombre: "Reposo Estelar", via: Me, mana: 12, cd: 3, resplandor: 5, adq: { via: "evento" },
        desc: "Te vuelves intocable como una estrella: Estasis de 1 turno sobre ti o un aliado.",
        efectos: [{ tipo: "estasis", nombre: "Estasis", duracion: 1, inmune: true, pausa: true, objetivo: "aliados", alcance: "single" }] }),
]

/** Correcciones de datos de los hechizos que ya existen (XII.A). */
const CORRECCIONES = {
    "Pyro-001": { Nombre: "Chispa Ígnea", Elemento: "Pyrós" },
    "Rakau-001": { "Mecanicas.healing.objetivo": "mismo" },
}

module.exports = { ELEMENTALES, UNIVERSALES, CATALOGO: [...ELEMENTALES, ...UNIVERSALES], CORRECCIONES, ESTADOS_VALORES }
