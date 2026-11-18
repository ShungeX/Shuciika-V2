// Slot de personaje por apoyar: espera de 14 días, una sola vez (functions/Premium/slotApoyo.js).
const test = require("node:test")
const assert = require("node:assert/strict")
const premium = require("../../functions/Premium/premium")
const { iniciarEspera, cancelarEspera, entregarSlotsVencidos } = require("../../functions/Premium/slotApoyo")

const DIA = 86400
const T0 = 1_800_000_000

/** Colección en memoria con lo justo: igualdad, $ne, $exists, $lte · $set, $unset, $inc, upsert. */
function coleccionFalsa(docs = []) {
    const m = new Map(docs.map(d => [d._id, structuredClone(d)]))
    const leer = (d, r) => r.split(".").reduce((o, k) => o?.[k], d)
    const escribir = (d, r, fn) => { const p = r.split("."); let o = d; for (const k of p.slice(0, -1)) o = (o[k] ??= {}); fn(o, p.at(-1)) }
    const cumple = (d, f) => Object.entries(f).every(([k, v]) => {
        const x = leer(d, k)
        if (v && typeof v === "object") return Object.entries(v).every(([op, w]) =>
            op === "$ne" ? x !== w : op === "$exists" ? (x !== undefined) === w : op === "$lte" ? x <= w : (() => { throw new Error(op) })())
        return x === v
    })
    const aplicar = (d, u) => {
        for (const [r, v] of Object.entries(u.$set || {})) escribir(d, r, (o, k) => { o[k] = v })
        for (const r of Object.keys(u.$unset || {})) escribir(d, r, (o, k) => { delete o[k] })
        for (const [r, v] of Object.entries(u.$inc || {})) escribir(d, r, (o, k) => { o[k] = (o[k] || 0) + v })
    }
    return {
        docs: m,
        async findOne(f) { return [...m.values()].find(d => cumple(d, f)) || null },
        find(f) { return { toArray: async () => [...m.values()].filter(d => cumple(d, f)).map(d => structuredClone(d)) } },
        async updateOne(f, u, o = {}) {
            const d = [...m.values()].find(x => cumple(x, f))
            if (d) { aplicar(d, u); return { matchedCount: 1, modifiedCount: 1 } }
            if (o.upsert) { if (m.has(f._id)) { const e = new Error("dup"); e.code = 11000; throw e } const n = { _id: f._id }; aplicar(n, u); m.set(f._id, n); return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 } }
            return { matchedCount: 0, modifiedCount: 0 }
        }
    }
}

/** Cliente de Discord falso con los miembros dados (id → lista de roles). */
const clienteFalso = (miembros) => ({
    guilds: { cache: new Map([[premium.GUILD_ID, { members: {
        cache: new Map(Object.entries(miembros).map(([id, roles]) => [id, { premiumSince: null, roles: { cache: new Set(roles) } }])),
        fetch: async () => null
    } }]]) }
})

const conSlots = (id, total = 1) => ({ _id: id, nix: { slotsPersonajes: { total, usados: 1 } } })

test("al recibir el rol no se entrega nada: solo empieza la espera", async () => {
    const col = coleccionFalsa([conSlots("a")])
    assert.equal(await iniciarEspera(col, "a", T0), true)
    assert.equal(col.docs.get("a").nix.slotsPersonajes.total, 1)
    assert.equal(col.docs.get("a").apoyo.slotEsperaDesde, T0)
})

test("antes de 14 días no se entrega; a los 14 días sí, una sola vez", async () => {
    const col = coleccionFalsa([conSlots("a")])
    const cli = clienteFalso({ a: [premium.ROL_SUPPORT] })
    await iniciarEspera(col, "a", T0)

    let r = await entregarSlotsVencidos(cli, col, T0 + 13 * DIA)
    assert.deepEqual(r.entregados, [])
    assert.equal(col.docs.get("a").nix.slotsPersonajes.total, 1)

    r = await entregarSlotsVencidos(cli, col, T0 + 14 * DIA)
    assert.deepEqual(r.entregados, ["a"])
    assert.equal(col.docs.get("a").nix.slotsPersonajes.total, 2)
    assert.equal(col.docs.get("a").apoyo.slotEntregado, true)

    // Otro barrido o volver a apoyar no da otro slot
    await entregarSlotsVencidos(cli, col, T0 + 30 * DIA)
    assert.equal(await iniciarEspera(col, "a", T0 + 40 * DIA), false)
    await entregarSlotsVencidos(cli, col, T0 + 60 * DIA)
    assert.equal(col.docs.get("a").nix.slotsPersonajes.total, 2)
})

test("si deja de apoyar antes de los 14 días, la espera se cancela y vuelve a empezar", async () => {
    const col = coleccionFalsa([conSlots("a")])
    await iniciarEspera(col, "a", T0)
    await cancelarEspera(col, "a")
    assert.equal(col.docs.get("a").apoyo.slotEsperaDesde, undefined)

    await iniciarEspera(col, "a", T0 + 20 * DIA)
    const cli = clienteFalso({ a: [premium.ROL_BOOST] })
    assert.deepEqual((await entregarSlotsVencidos(cli, col, T0 + 25 * DIA)).entregados, [])
    assert.deepEqual((await entregarSlotsVencidos(cli, col, T0 + 34 * DIA)).entregados, ["a"])
})

test("si al cumplir los 14 días ya no tiene el rol, no se entrega", async () => {
    const col = coleccionFalsa([conSlots("a")])
    await iniciarEspera(col, "a", T0)
    const r = await entregarSlotsVencidos(clienteFalso({ a: [] }), col, T0 + 15 * DIA)
    assert.deepEqual(r.cancelados, ["a"])
    assert.equal(col.docs.get("a").nix.slotsPersonajes.total, 1)
})

test("sin personajes: el slot queda apartado para su primera ficha", async () => {
    const col = coleccionFalsa([])
    await iniciarEspera(col, "b", T0)
    const r = await entregarSlotsVencidos(clienteFalso({ b: [premium.ROL_SUPPORT] }), col, T0 + 14 * DIA)
    assert.deepEqual(r.apartados, ["b"])
    assert.equal(col.docs.get("b").apoyo.slotPendiente, true)
})

test("sin cliente de Discord no decide nada (reintenta después)", async () => {
    const col = coleccionFalsa([conSlots("a")])
    await iniciarEspera(col, "a", T0)
    const r = await entregarSlotsVencidos(null, col, T0 + 20 * DIA)
    assert.deepEqual(r, { entregados: [], apartados: [], cancelados: [] })
    assert.equal(col.docs.get("a").apoyo.slotEsperaDesde, T0)
})
