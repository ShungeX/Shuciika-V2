// ─── Notas de Resplandor I: dos Notas más por elemento ──────────────────────
// Referencia: Notas_Nuevas_Resplandor_I.md. Formato final (como catalogo.js). Se abren por
// Fragmentos Estelares GANADOS (Req.fe_min 3 / 10), no por Resplandor; se compran como página
// en la Tienda Mágica y se aprenden con el sistema de práctica por vías.
// Valores de partida para INT = 10 y T = 15 (⚙ se calibran con calibracion.js).
// La semilla en la BD la escribe scripts/seedNotasResplandor.js.

const { VIAS, BUFFS } = require("./config")
const { ESTADOS } = require("./estados")
const { FUENTES, precioPagina } = require("../../Aprendizaje/config")

const { HABLADO: H, MOVIMIENTO: Mo, ESCRITURA: E } = VIAS
const INT = "inteligencia"

/** Umbrales de Fragmentos ganados (⚙ ajustar según el ritmo real de Polvo). */
const FE = Object.freeze({ NOTA_101: 3, NOTA_102: 10 })

const dmg = (base, multi, alcance = "single", extra = {}) => ({ base, scaling: { stats: INT, multi }, objetivo: "enemigos", alcance, ...extra })
const heal = (base, multi) => ({ base, scaling: { stats: INT, multi }, objetivo: "aliados", alcance: "single" })
const lentitud = (duracion, alcance = "single") => ({ tipo: "degradacion", nombre: "Lentitud", duracion, objetivo: "enemigos", alcance })

function nota({ id, nombre, desc, elemento, rol, via, fe, mana, vida = 0, cd = 1, prob, damage, healing, efectos = [], invocacion }) {
    const f = FUENTES[id]
    const doc = {
        _id: id,
        Nombre: nombre,
        Descripcion: desc,
        Elemento: elemento,
        Escalon: 1,
        Rol: rol,
        Invocacion: invocacion,
        isActive: true,
        Req: { fe_min: fe, fe_max: null, resplandor_min: 1, resplandor_max: null, clase: null, stats: null },
        Adquisicion: { via: f.fuente, aprecio: f.aprecio, precio: precioPagina({ fuente: f.fuente, aprecio: f.aprecio }) },
        Mecanicas: {
            Efectos: efectos,
            cast: {
                vias: [via],
                mental: { permitido: true, maestria_min: 4, manaX: 1.5, tiempoExtra: 1 },
                tiempo: 1, probabilidad: prob, interruptible: true,
            },
        },
        Costos: { mana, Vida: vida, Dinero: 0, Cooldown: cd },
        Creado: "",
        uso: "combate",
    }
    if (damage) doc.Mecanicas.damage = damage
    if (healing) doc.Mecanicas.healing = healing
    return doc
}

const NOTAS_RESPLANDOR_I = [
    // ── Pyrós ────────────────────────────────────────────────────────────────
    nota({ id: "Pyro-101", nombre: "Ascua Latente", elemento: "Pyrós", rol: "daño", via: E, fe: FE.NOTA_101, mana: 5, prob: 1.0,
        desc: "Deja una brasa dormida en el enemigo: no hiere al instante, pero arde durante 4 turnos.",
        efectos: [{ tipo: "dot", nombre: "Quemadura", base: 8, duracion: 4, objetivo: "enemigos", alcance: "single" }],
        invocacion: "Eón, deja una brasa dormida en mi enemigo." }),
    nota({ id: "Pyro-102", nombre: "Llama Voraz", elemento: "Pyrós", rol: "daño", via: H, fe: FE.NOTA_102, mana: 5, vida: 4, prob: 0.8,
        desc: "Una llama voraz que se alimenta de lo que el mago está dispuesto a ofrecer.",
        damage: dmg(22, 2.5),
        invocacion: "Llama voraz, toma lo que debo ofrecerte." }),

    // ── Aqua ─────────────────────────────────────────────────────────────────
    nota({ id: "Aqua-101", nombre: "Gota Purificadora", elemento: "Aqua", rol: "curación", via: H, fe: FE.NOTA_101, mana: 5, prob: 0.8,
        desc: "Una gota clara que cura a un aliado y le quita un efecto negativo.",
        healing: heal(10, 1),
        efectos: [{ tipo: "cleanse", nombre: "Purificación", cantidad: 1, objetivo: "aliados", alcance: "single" }],
        invocacion: "Gota clara, lava el mal que nos aqueja." }),
    nota({ id: "Aqua-102", nombre: "Arroyo Constante", elemento: "Aqua", rol: "curación", via: Mo, fe: FE.NOTA_102, mana: 6, prob: 0.8,
        desc: "Un arroyo paciente que cura a un aliado poco a poco durante 3 turnos.",
        efectos: [{ tipo: "hot", nombre: "Arroyo Constante", base: 5, multi: 1, duracion: 3, objetivo: "aliados", alcance: "single" }],
        invocacion: "Arroyo paciente, corre despacio por sus heridas." }),

    // ── Lux ──────────────────────────────────────────────────────────────────
    nota({ id: "Lux-101", nombre: "Destello Cegador", elemento: "Lux", rol: "control", via: Mo, fe: FE.NOTA_101, mana: 5, prob: 0.8,
        desc: "Un destello que hiere al enemigo y puede cegarlo 2 turnos: no podrá escribir y apuntará peor.",
        damage: dmg(12, 1.2),
        efectos: [{ tipo: "control", nombre: ESTADOS.cegado.nombre, duracion: 2, probabilidad: 0.85, bloquea: [...ESTADOS.cegado.bloquea], objetivo: "enemigos", alcance: "single" }],
        invocacion: "Luz del Eón, nubla la vista del adversario." }),
    nota({ id: "Lux-102", nombre: "Chispa de Ánimo", elemento: "Lux", rol: "soporte", via: H, fe: FE.NOTA_102, mana: 5, prob: 0.85,
        desc: "Enciende el valor de un aliado: +15% de daño durante 4 turnos y una pequeña cura.",
        healing: heal(3, 0.5),
        efectos: [{ tipo: "buff", nombre: "Chispa de Ánimo", stat: "daño", valor: BUFFS.daño, duracion: 4, objetivo: "aliados", alcance: "single" }],
        invocacion: "Chispa de ánimo, enciende su valor." }),

    // ── Rakau ────────────────────────────────────────────────────────────────
    nota({ id: "Rakau-101", nombre: "Enredadera", elemento: "Rakau", rol: "control", via: Mo, fe: FE.NOTA_101, mana: 5, prob: 0.8,
        desc: "Una enredadera joven que golpea al enemigo y lo ralentiza 2 turnos.",
        damage: dmg(8, 1.2),
        efectos: [lentitud(2)],
        invocacion: "Enredadera joven, abraza sus pies y no sueltes." }),
    nota({ id: "Rakau-102", nombre: "Savia Vital", elemento: "Rakau", rol: "soporte", via: H, fe: FE.NOTA_102, mana: 5, cd: 3, prob: 0.8,
        desc: "La savia fluye hacia otro aliado (nunca hacia ti): +4 de regeneración de maná por turno durante 3 turnos.",
        efectos: [{ tipo: "regen_mana", nombre: "Savia Vital", valor: 4, duracion: 3, objetivo: "aliados", alcance: "single", excluirLanzador: true }],
        invocacion: "Savia del árbol, fluye hacia quien me acompaña." }),

    // ── Lapis ────────────────────────────────────────────────────────────────
    nota({ id: "Lapis-101", nombre: "Esquirla de Roca", elemento: "Lapis", rol: "daño", via: Mo, fe: FE.NOTA_101, mana: 5, prob: 0.85,
        desc: "Una esquirla de piedra lanzada contra un enemigo. Sin adornos.",
        damage: dmg(15, 1.8),
        invocacion: "Piedra, lanza una esquirla contra mi adversario." }),
    nota({ id: "Lapis-102", nombre: "Coraza de Roca", elemento: "Lapis", rol: "defensa", via: E, fe: FE.NOTA_102, mana: 6, prob: 0.85,
        desc: "Te cubres con una coraza de piedra que absorbe daño durante 3 turnos.",
        efectos: [{ tipo: "escudo", nombre: "Coraza de Roca", base: 20, multi: 2, duracion: 3, objetivo: "mismo", alcance: "single" }],
        invocacion: "Piedra primera, cúbreme con tu coraza." }),

    // ── Electro ──────────────────────────────────────────────────────────────
    nota({ id: "Electro-101", nombre: "Chispa Veloz", elemento: "Electro", rol: "daño", via: H, fe: FE.NOTA_101, mana: 5, prob: 0.8,
        desc: "Una chispa rápida que hiere al enemigo y te acelera durante 3 turnos.",
        damage: dmg(8, 1),
        efectos: [{ tipo: "buff", nombre: "Chispa Veloz", stat: "velocidad", valor: BUFFS.velocidad, duracion: 3, objetivo: "mismo", alcance: "single" }],
        invocacion: "Chispa veloz, hiere rápido y hazme ligero." }),
    nota({ id: "Electro-102", nombre: "Doble Descarga", elemento: "Electro", rol: "daño", via: Mo, fe: FE.NOTA_102, mana: 6, prob: 0.8,
        desc: "Una descarga que salta a dos enemigos (100% / 70%).",
        damage: dmg(11, 1.25, "cadena", { objetivosMax: 2 }),
        invocacion: "Cielo, descarga dos veces sobre quienes me acechan." }),

    // ── Wind ─────────────────────────────────────────────────────────────────
    nota({ id: "Wind-101", nombre: "Ráfaga Cortante", elemento: "Wind", rol: "daño", via: Mo, fe: FE.NOTA_101, mana: 6, prob: 0.85,
        desc: "Una ráfaga afilada que hiere al enemigo y le resta precisión durante 2 turnos.",
        damage: dmg(8, 1.3),
        efectos: [{ tipo: "debuff", nombre: "Ráfaga Cortante", stat: "precision", valor: BUFFS.precision, peso: 0.6, duracion: 2, objetivo: "enemigos", alcance: "single" }],
        invocacion: "Viento afilado, corta el aire frente a mí." }),
    nota({ id: "Wind-102", nombre: "Paso Ligero", elemento: "Wind", rol: "defensa", via: H, fe: FE.NOTA_102, mana: 5, prob: 0.9,
        desc: "El viento aligera tu paso: esquivas mejor durante 3 turnos.",
        efectos: [{ tipo: "buff", nombre: "Paso Ligero", stat: "esquive", valor: BUFFS.esquive, peso: 0.6, duracion: 3, objetivo: "mismo", alcance: "single" }],
        invocacion: "Viento, vuelve mi paso ligero como el tuyo." }),

    // ── Kryo ─────────────────────────────────────────────────────────────────
    nota({ id: "Kryo-101", nombre: "Calma Helada", elemento: "Kryo", rol: "control", via: E, fe: FE.NOTA_101, mana: 5, prob: 0.85,
        desc: "La escarcha enfría la furia del enemigo: poco daño, pero hace 20% menos de daño durante 3 turnos.",
        damage: dmg(5, 0.8),
        efectos: [{ tipo: "debuff", nombre: "Calma Helada", stat: "daño", valor: -0.2, peso: 0.5, duracion: 3, objetivo: "enemigos", alcance: "single" }],
        invocacion: "Escarcha, enfría la furia de mi adversario." }),
    nota({ id: "Kryo-102", nombre: "Nevisca", elemento: "Kryo", rol: "control", via: H, fe: FE.NOTA_102, mana: 6, prob: 0.8,
        desc: "Una nevisca ligera que daña a todos los enemigos y los ralentiza 1 turno.",
        damage: dmg(8, 0.9, "todos"),
        efectos: [lentitud(1, "todos")],
        invocacion: "Que la nieve caiga ligera sobre ellos." }),
]

module.exports = { NOTAS_RESPLANDOR_I, FE }
