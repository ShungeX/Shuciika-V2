// Límite de personajes de los beneficios en rol (functions/Premium/premium.js).
const test = require("node:test")
const assert = require("node:assert/strict")
const P = require("../../functions/Premium/premium")

const nix = (...ids) => ({ personajes: ids.map(id => ({ id, nombre: `PJ ${id}` })) })
const miembro = (roles = []) => ({ premiumSince: null, roles: { cache: new Set(roles) } })
const SUPPORT = miembro([P.ROL_SUPPORT])
const AHORA = 1_800_000_000

test("con 2 o menos personajes, todos tienen beneficios", () => {
    assert.deepEqual(P.personajesConBeneficio({ nix: nix(5, 9) }), ["5", "9"])
    assert.deepEqual(P.personajesConBeneficio({ nix: nix(5) }), ["5"])
    assert.deepEqual(P.personajesConBeneficio(null), [])
})

test("sin elección, los dos primeros registrados", () => {
    assert.deepEqual(P.personajesConBeneficio({ nix: nix(5, 9, 12) }), ["5", "9"])
})

test("con elección, solo los elegidos que aún tiene (máx. 2, sin repetidos)", () => {
    assert.deepEqual(P.personajesConBeneficio({ nix: nix(5, 9, 12), apoyo: { personajes: ["12", 9] } }), ["12", "9"])
    assert.deepEqual(P.personajesConBeneficio({ nix: nix(5, 9, 12), apoyo: { personajes: ["12", "12", "5", "9"] } }), ["12", "5"])
    // Un personaje elegido que ya no existe se ignora
    assert.deepEqual(P.personajesConBeneficio({ nix: nix(5, 9, 12), apoyo: { personajes: ["77", "9"] } }), ["9"])
    // Si ninguno elegido sigue existiendo, vuelve a los dos primeros
    assert.deepEqual(P.personajesConBeneficio({ nix: nix(5, 9, 12), apoyo: { personajes: ["77"] } }), ["5", "9"])
})

test("un cambio cada 30 días; el primero no espera", () => {
    assert.equal(P.proximoCambioPersonajes({}, AHORA), null)
    const hace10 = AHORA - 10 * 86400
    assert.equal(P.proximoCambioPersonajes({ apoyo: { personajesCambio: hace10 } }, AHORA), hace10 + 30 * 86400)
    assert.equal(P.proximoCambioPersonajes({ apoyo: { personajesCambio: AHORA - 31 * 86400 } }, AHORA), null)
})

test("esPremiumEnPersonaje: Support en personaje elegido sí, en otro no", async () => {
    const usuarioServer = { nix: nix(5, 9, 12), apoyo: { personajes: ["12"] } }
    assert.equal(await P.esPremiumEnPersonaje(null, "300", 12, { usuarioServer, member: SUPPORT }), true)
    assert.equal(await P.esPremiumEnPersonaje(null, "300", 5, { usuarioServer, member: SUPPORT }), false)
})

test("esPremiumEnPersonaje: sin apoyo, nunca", async () => {
    const usuarioServer = { nix: nix(5) }
    assert.equal(await P.esPremiumEnPersonaje(null, "300", 5, { usuarioServer, member: miembro() }), false)
})

test("staff e ID autorizada no tienen límite", async () => {
    const usuarioServer = { nix: nix(5, 9, 12), apoyo: { personajes: ["5"] } }
    assert.equal(await P.esPremiumEnPersonaje(null, "300", 12, { usuarioServer, member: miembro([P.ROLES_ADMIN[0]]) }), true)
    assert.equal(await P.esPremiumEnPersonaje(null, P.ID_AUTORIZADA, 12, { usuarioServer, member: miembro() }), true)
})

test("sin id de personaje no hay beneficio", async () => {
    assert.equal(await P.esPremiumEnPersonaje(null, "300", undefined, { usuarioServer: { nix: nix(5) }, member: SUPPORT }), false)
})
