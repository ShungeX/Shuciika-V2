// Degradado ANSI, sanitizado y validación del estilo de apoyo (functions/Premium/apoyoEstilo.js).
const test = require("node:test")
const assert = require("node:assert/strict")
const E = require("../../functions/Premium/apoyoEstilo")

const ESC = E.ESC
const visibles = (ansi) => ansi.replace(/\u001b\[[0-9;]*m/g, "")
const colores = (ansi) => (ansi.match(/\u001b\[38;2;\d+;\d+;\d+m/g) || []).length
const DESDE = [164, 236, 187], HASTA = [209, 97, 162]

test("respeta la longitud máxima contando code points", () => {
    const out = E.degradado("a".repeat(50), DESDE, HASTA, 32)
    assert.equal([...visibles(out)].length, 32)
    assert.equal(colores(out), 32)
    assert.ok(out.endsWith(`${ESC}[0m`))
})

test("un solo carácter usa el color inicial", () => {
    const out = E.degradado("S", DESDE, HASTA)
    assert.equal(out, `${ESC}[38;2;164;236;187mS${ESC}[0m`)
})

test("el primer y el último carácter visibles llevan los extremos de la paleta", () => {
    const out = E.degradado("Support", DESDE, HASTA)
    assert.ok(out.startsWith(`${ESC}[38;2;164;236;187mS`))
    assert.ok(out.includes(`${ESC}[38;2;209;97;162mt`))
})

test("los espacios no se colorean ni cuentan como pasos del degradado", () => {
    const out = E.degradado("a b", DESDE, HASTA)
    assert.equal(colores(out), 2)
    assert.equal(visibles(out), "a b")
})

test("quita ESC, saltos de línea y otros caracteres de control del texto de entrada", () => {
    const out = E.degradado(`a${ESC}[31mb\nc\td`, DESDE, HASTA)
    assert.equal(visibles(out).includes("\n"), false)
    assert.equal(visibles(out).includes("\t"), false)
    // El único ESC que queda es el que pone la función (uno por letra + el reset)
    const escs = out.split(ESC).length - 1
    assert.equal(escs, colores(out) + 1)
})

test("los backticks se cambian para no cerrar el bloque", () => {
    const out = E.degradado("a```b", DESDE, HASTA)
    assert.equal(out.includes("`"), false)
    assert.equal(visibles(out), "a'''b")
})

test("los emojis Unicode se conservan sin partirse", () => {
    const texto = "🌸Shun👩‍🎤"
    const out = E.degradado(texto, DESDE, HASTA)
    assert.ok(visibles(out).includes("🌸"))
    assert.equal(visibles(out).includes("�"), false)
    // Ningún surrogate suelto
    assert.equal(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(visibles(out)), false)
})

test("sanitizarTexto quita menciones y emojis personalizados", () => {
    const limpio = E.sanitizarTexto("Hola <@123> <@!456> <@&789> <#111> <:KSH:222> <a:baile:333> 🌸 Shun")
    assert.equal(limpio, "Hola 🌸 Shun")
})

test("degradadoSeguro devuelve null si el nombre queda vacío tras sanitizar", () => {
    assert.equal(E.degradadoSeguro("<@123> <:x:1>", "brisa"), null)
    assert.equal(E.degradadoSeguro("   ", "brisa"), null)
    assert.equal(E.degradadoSeguro("", "brisa"), null)
    assert.equal(E.degradadoSeguro(null, "brisa"), null)
})

test("degradadoSeguro usa la paleta por defecto si el id no existe", () => {
    const out = E.degradadoSeguro("Ab", "no-existe")
    assert.ok(out.startsWith(`${ESC}[38;2;164;236;187m`))
})

test("bloque envuelve en ```ansi", () => {
    assert.equal(E.bloque("x"), "```ansi\nx\n```")
})

test("validarApoyoEstilo corrige lo inválido y aplica valores por defecto", () => {
    assert.deepEqual(E.validarApoyoEstilo(undefined), { modo: "etiqueta", paleta: "brisa", posicion: "superior", mostrarEtiqueta: true })
    assert.deepEqual(
        E.validarApoyoEstilo({ modo: "hack", paleta: "#ff0000", posicion: "medio", mostrarEtiqueta: "false", extra: 1 }),
        { modo: "etiqueta", paleta: "brisa", posicion: "superior", mostrarEtiqueta: true }
    )
    assert.deepEqual(
        E.validarApoyoEstilo({ modo: "ambos", paleta: "miel", posicion: "inferior", mostrarEtiqueta: false }),
        { modo: "ambos", paleta: "miel", posicion: "inferior", mostrarEtiqueta: false }
    )
    assert.deepEqual(E.validarApoyoEstilo([1, 2]).modo, "etiqueta")
})

test("las paletas tienen ids únicos y colores RGB válidos", () => {
    const ids = E.PALETAS.map(p => p.id)
    assert.equal(new Set(ids).size, ids.length)
    for (const p of E.PALETAS) {
        for (const c of [...p.desde, ...p.hasta]) assert.ok(Number.isInteger(c) && c >= 0 && c <= 255, p.id)
    }
})
