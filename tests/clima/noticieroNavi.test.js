// Noticiero sin envíos automáticos (Navi, config/entorno.js): solo publica cuando se pide
// desde el dashboard, y nunca se edita solo después.
process.env.ENVIOS_AUTOMATICOS = "no";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ColeccionFalsa } = require("./coleccionFalsa");
const ER = require("../../functions/Clima/estadoRegion");
const img = require("../../functions/Clima/imagenes");
const N = require("../../functions/Clima/noticiero");
const { configDe } = require("../../functions/Clima/config");

const REGION = "TOB-001";
const MIN = 60000;
const REFRESCO = configDe(REGION).noticieroRefrescoMin * MIN;
const vaciar = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

let col, t, enviados, editados;
const canal = {
    id: "717140034834268162",
    guildId: "716342375303217285",
    isTextBased: () => true,
    send: async () => { const id = `m${enviados.length + 1}`; enviados.push(id); return { id }; },
    messages: { edit: async (id) => { editados.push(id); }, delete: async () => {} }
};

test.beforeEach((ctx) => {
    ctx.mock.timers.enable({ apis: ["setTimeout"] });
    col = new ColeccionFalsa();
    t = new Date("2026-11-07T10:00:00Z").getTime();
    enviados = []; editados = [];
    ER.limpiarCache();
    ER.usarColeccion(col);
    ER.usarAhora(() => t);
    img.usarBuscador(async () => ["https://img/a.png"]);
    N.configurar({ channels: { fetch: async (id) => (id === canal.id ? canal : null) } });
});
test.afterEach(() => { N.detenerRefresco(REGION); ER.limpiarCache(); });

test("Navi: iniciar desde el dashboard publica una vez y no se refresca solo", async (ctx) => {
    await N.iniciarNoticiero(REGION, canal.id);
    assert.equal(enviados.length, 1);
    t += REFRESCO * 3;
    ctx.mock.timers.tick(REFRESCO * 3);
    await vaciar();
    assert.equal(editados.length, 0, "sin refresco periódico");
});

test("Navi: un cambio de hora no edita el mensaje", async () => {
    await N.iniciarNoticiero(REGION, canal.id);
    t += 60 * MIN;
    await ER.actualizar(REGION);
    await vaciar();
    assert.equal(editados.length, 0);
    assert.equal(enviados.length, 1);
});

test("Navi: refrescar a mano sí edita", async () => {
    await N.iniciarNoticiero(REGION, canal.id);
    await N.actualizarNoticiero(REGION);
    assert.deepEqual(editados, ["m1"]);
});
