// Regeneración de energía (functions/dataCharacters.recargarEnergia) y los gastos que dependen de ella.
// Usa la base de datos en memoria de las pruebas de mascotas.
const test = require("node:test")
const assert = require("node:assert/strict")
const { tabla, limpiar } = require("../mascotas/_entorno")

const { recargarEnergia } = require("../../functions/dataCharacters")
const config = require("../../config/config")

const MAX = config.maxEnergy
const TICK = config.regeneracionMinutos * 60_000
const souls = require("../../Server").db("Rol_db").collection("Soul")

/** Alma guardada en la base falsa; devuelve una lectura fresca, como hace el bot en cada interacción. */
async function alma(energy, haceMs) {
    tabla("Soul").set(1, { _id: 1, nucleo: { energy, lastEnergyUpdate: haceMs === null ? 0 : Date.now() - haceMs } })
    return souls.findOne({ _id: 1 })
}
const leer = () => souls.findOne({ _id: 1 })
/** Gasta como lo hacen el trabajo (motorPago) y la exploración: recargar y descontar. */
async function gastar(cantidad) {
    const actual = await recargarEnergia(await leer())
    assert.ok(actual >= cantidad)
    await souls.updateOne({ _id: 1, "nucleo.energy": { $gte: cantidad } }, { $inc: { "nucleo.energy": -cantidad } })
}

test.beforeEach(limpiar)

test("1 · Gastar tras horas con la energía llena no se reembolsa en la siguiente lectura", async () => {
    await alma(MAX, 5 * 60 * 60_000)   // llena desde hace 5 h
    await gastar(10)
    assert.equal(await recargarEnergia(await leer()), MAX - 10)
    // Y el segundo gasto tampoco sale gratis
    await gastar(10)
    assert.equal(await recargarEnergia(await leer()), MAX - 20)
})

test("2 · Por debajo del máximo regenera un punto por intervalo, sin perder el resto del reloj", async () => {
    await alma(100, 3.5 * TICK)
    assert.equal(await recargarEnergia(await leer()), 103)
    const soul = await leer()
    assert.equal(soul.nucleo.energy, 103)
    // Queda medio intervalo acumulado para el punto siguiente
    assert.ok(Math.abs(Date.now() - soul.nucleo.lastEnergyUpdate - 0.5 * TICK) < 2000)
})

test("3 · La regeneración se detiene en el máximo y deja el reloj en ese momento", async () => {
    await alma(MAX - 2, 10 * TICK)
    assert.equal(await recargarEnergia(await leer()), MAX)
    assert.ok(Date.now() - (await leer()).nucleo.lastEnergyUpdate < 2000)
})

test("4 · Llena y con el reloj al día no escribe nada (no hay una escritura por cada lectura)", async () => {
    await alma(MAX, 0.5 * TICK)
    const antes = (await leer()).nucleo.lastEnergyUpdate
    assert.equal(await recargarEnergia(await leer()), MAX)
    assert.equal((await leer()).nucleo.lastEnergyUpdate, antes)
})

test("5 · Un alma recién despertada (reloj en 0) empieza con la energía llena", async () => {
    await alma(0, null)
    assert.equal(await recargarEnergia(await leer()), MAX)
    assert.ok(Date.now() - (await leer()).nucleo.lastEnergyUpdate < 2000)
})
