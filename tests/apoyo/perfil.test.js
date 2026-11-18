// Etiqueta de apoyo en la tarjeta de /rol perfil: tres estados × dos vistas, degradados y tope de caracteres.
// Usa la base en memoria de las pruebas de mascotas para poder cargar Perfil.js sin Mongo ni Discord.
const test = require("node:test")
const assert = require("node:assert/strict")
require("../mascotas/_entorno")

const { piezasApoyoPerfil, estadoApoyo, contarTextoV2, LIMITE_TEXTO_V2 } = require("../../functions/Premium/apoyo")
const { construirPerfilV2 } = require("../../handlers/CMDHandler/Rol/Personajes/Perfil")
const { MENSAJES_DUEÑO, MENSAJES_VISITANTE } = require("../../data/apoyo/mensajes")
const premium = require("../../functions/Premium/premium")

const DUEÑO = "111"
const OTRO = "222"
const estilo = (o = {}) => ({ modo: "etiqueta", paleta: "brisa", posicion: "superior", mostrarEtiqueta: true, ...o })
const apoyo = (estado, o = {}, nombreDueño = "Shun [Ilyumsun]") => ({ estado, estilo: estilo(o), nombreDueño })
const base = { nombre: "ShungeX | Shun", ownerID: DUEÑO }
const piezas = (a, esDueño, extra = {}) => piezasApoyoPerfil({ ...base, apoyo: a, esDueño, ...extra })

const pj = {
    _id: 1, ownerID: DUEÑO,
    perfil: { Nombre: "ShungeX", Apodo: "Shun", Descripcion: "¿Quien eres?" },
    economia: { Lumens: 1084 }, estado: { Reputacion: 0 }, social: { Medallas: [] }
}
const textos = (comps) => {
    const out = []
    const rec = (l) => (l || []).forEach(c => { if (c?.type === 10) out.push(c.content); if (c?.components) rec(c.components) })
    rec(comps)
    return out
}
const sinLineasVacias = (texto) => !texto.split("\n").some(l => /^-#\s*$/.test(l))

const miembro = (roles = [], premiumSince = null) => ({ premiumSince, roles: { cache: new Set(roles) } })

test("estadoApoyo: activo, alguna vez y ninguno", () => {
    assert.equal(estadoApoyo(null, miembro([premium.ROL_BOOST])), "activo")
    assert.equal(estadoApoyo(null, miembro([premium.ROL_SUPPORT])), "activo")
    assert.equal(estadoApoyo(null, miembro([], new Date())), "activo")
    assert.equal(estadoApoyo(null, miembro([premium.ROL_EX_SUPPORT])), "alguna_vez")
    assert.equal(estadoApoyo({ apoyo: { primeraVez: 1 } }, null), "alguna_vez")
    assert.equal(estadoApoyo(null, miembro(["737058095599058995"])), "ninguno")   // staff no cuenta
    assert.equal(estadoApoyo(null, null), "ninguno")
})

for (const esDueño of [true, false]) {
    const vista = esDueño ? "dueño" : "visitante"
    const pool = esDueño ? MENSAJES_DUEÑO : MENSAJES_VISITANTE

    test(`activo (${vista}): etiqueta decorada con degradado y mensaje de su pool`, () => {
        const p = piezas(apoyo("activo"), esDueño, { azar: () => 0 })
        assert.ok(p.lineaApoyo.startsWith("\n-# *`Apoyo:`*\n```ansi\n🌸 "))
        assert.ok(p.lineaApoyo.includes(" ˚｡⋆\n```"))
        assert.ok(p.lineaApoyo.endsWith(`\n-# ${pool[0]}`))
        assert.ok(p.conDegradado)
        assert.ok(sinLineasVacias(p.lineaApoyo))
    })

    test(`activo sin degradado (${vista}): texto plano decorado`, () => {
        const p = piezas(apoyo("activo", { modo: "ninguno" }), esDueño, { azar: () => 0 })
        assert.equal(p.lineaApoyo, `\n-# *\`Apoyo:\`* 🌸 Support ˚｡⋆\n-# ${pool[0]}`)
        assert.equal(p.conDegradado, false)
    })

    test(`alguna vez (${vista}): "Support" en texto plano, nunca degradado`, () => {
        const p = piezas(apoyo("alguna_vez", { modo: "ambos" }), esDueño, { azar: () => 0.99 })
        assert.equal(p.lineaApoyo, `\n-# *\`Apoyo:\`* Support\n-# ${pool[pool.length - 1]}`)
        assert.equal(p.titulo, "# ShungeX | Shun")
        assert.equal(p.conDegradado, false)
    })

    test(`ninguno (${vista}): no se renderiza nada`, () => {
        const p = piezas(apoyo("ninguno"), esDueño)
        assert.equal(p.lineaApoyo, "")
        assert.equal(p.titulo, "# ShungeX | Shun")
        assert.equal(p.pie, `-# Personaje de: <@!${DUEÑO}>\n-# Sistema de personaje | v1.5`)
    })

    test(`tarjeta completa (${vista}) en los tres estados sin líneas "-#" vacías`, () => {
        for (const estado of ["activo", "alguna_vez", "ninguno"]) {
            const comps = construirPerfilV2(pj, esDueño ? DUEÑO : OTRO, null, apoyo(estado))
            const todo = textos(comps)
            const datos = todo.find(t => t.includes("`Grado:`"))
            assert.ok(datos, estado)
            if (estado === "ninguno") assert.equal(datos.includes("Apoyo:"), false)
            else assert.ok(datos.indexOf("`Apoyo:`") > datos.indexOf("`Grado:`"), estado)
            for (const t of todo) assert.ok(sinLineasVacias(t), `${estado}: ${t}`)
            assert.ok(contarTextoV2(comps) <= LIMITE_TEXTO_V2)
        }
    })
}

test("mostrarEtiqueta=false: el visitante no la ve, el dueño sí", () => {
    const a = apoyo("activo", { mostrarEtiqueta: false })
    assert.equal(piezas(a, false).lineaApoyo, "")
    assert.ok(piezas(a, true).lineaApoyo.includes("Apoyo:"))
})

test("un pool vacío o con textos vacíos nunca deja un '-#' sin texto", () => {
    const { mensajeAlAzar } = require("../../functions/Premium/apoyo")
    assert.equal(mensajeAlAzar(["", "   ", null]), "")
    assert.equal(mensajeAlAzar([]), "")
    assert.equal(mensajeAlAzar(["", "hola"], () => 0), "hola")
})

test("modo nombre: el título pasa a bloque ANSI; nombre vacío tras limpiar usa el título normal", () => {
    const p = piezas(apoyo("activo", { modo: "nombre" }), true)
    assert.ok(p.titulo.startsWith("```ansi\n"))
    assert.ok(p.lineaApoyo.includes("🌸 Support ˚｡⋆"))     // la etiqueta queda en texto plano
    const vacio = piezasApoyoPerfil({ apoyo: apoyo("activo", { modo: "nombre" }), esDueño: true, nombre: "<@123> <:x:1>", ownerID: DUEÑO })
    assert.equal(vacio.titulo, "# <@123> <:x:1>")
})

test("modo ambos: degradado en nombre y etiqueta", () => {
    const p = piezas(apoyo("activo", { modo: "ambos" }), true)
    assert.ok(p.titulo.startsWith("```ansi\n"))
    assert.ok(p.lineaApoyo.includes("```ansi\n🌸 "))
})

test("nombre demasiado largo: no se recorta, se usa el título normal", () => {
    const largo = "N".repeat(80)
    const p = piezasApoyoPerfil({ apoyo: apoyo("activo", { modo: "nombre" }), esDueño: true, nombre: largo, ownerID: DUEÑO })
    assert.equal(p.titulo, `# ${largo}`)
})

test("posición inferior: degradado solo en el pie, con el nombre del dueño en texto", () => {
    const p = piezas(apoyo("activo", { modo: "ambos", posicion: "inferior" }), false)
    assert.equal(p.titulo, "# ShungeX | Shun")
    assert.ok(p.lineaApoyo.includes("🌸 Support ˚｡⋆"))
    assert.ok(p.pie.startsWith("```ansi\n"))
    assert.ok(p.pie.replace(/\u001b\[[0-9;]*m/g, "").includes("Personaje de: Shun [Ilyumsun]\nSistema de personaje | v1.5"))
    assert.equal(p.pie.includes("<@"), false)
})

test("posición inferior sin nombre del dueño: pie normal con la mención", () => {
    const p = piezas(apoyo("activo", { posicion: "inferior" }, null), true)
    assert.ok(p.pie.startsWith("-# Personaje de: <@!"))
})

test("si el degradado no cabe en el tope de Components V2 cae a texto plano", () => {
    const p = piezas(apoyo("activo", { modo: "ambos" }), true, { otrosCaracteres: LIMITE_TEXTO_V2 - 50 })
    assert.equal(p.conDegradado, false)
    assert.ok(p.lineaApoyo.includes("🌸 Support ˚｡⋆"))
    assert.equal(p.titulo, "# ShungeX | Shun")
})

test("sin datos de apoyo (llamadas antiguas) la tarjeta sale como siempre", () => {
    const comps = construirPerfilV2(pj, DUEÑO, null)
    const todo = textos(comps)
    assert.equal(todo[0], "# ShungeX | Shun")
    assert.equal(todo.some(t => t.includes("Apoyo:")), false)
})
