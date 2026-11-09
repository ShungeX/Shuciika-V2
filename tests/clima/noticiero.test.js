const test = require("node:test");
const assert = require("node:assert/strict");
const { ColeccionFalsa } = require("./coleccionFalsa");
const ER = require("../../functions/Clima/estadoRegion");
const img = require("../../functions/Clima/imagenes");
const N = require("../../functions/Clima/noticiero");
const { configDe } = require("../../functions/Clima/config");
const { MessageFlags } = require("discord.js");

const REGION = "TOB-001";
const MIN = 60000;
const REFRESCO = configDe(REGION).noticieroRefrescoMin * MIN;
const vaciar = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

let col, t, enviados, editados, borrado;
const canal = {
    id: "717140034834268162",
    guildId: "716342375303217285",
    isTextBased: () => true,
    send: async (p) => { const id = `m${enviados.length + 1}`; enviados.push({ id, p: leer(p) }); return { id }; },
    messages: {
        edit: async (id, p) => {
            if (borrado) throw Object.assign(new Error("Unknown Message"), { code: borrado });
            editados.push({ id, p: leer(p) });
        },
        delete: async (id) => { borrados.push(id); }
    }
};
let borrados = [];

/** Extrae lo importante del contenedor V2 (y comprueba su forma). */
function leer(payload) {
    assert.equal(payload.flags, MessageFlags.IsComponentsV2);
    assert.equal(payload.embeds, undefined);
    const [c] = payload.components;
    assert.equal(c.type, 17);
    const [seccion, sep1, datos, sep2, galeria, pie] = c.components;
    assert.deepEqual([seccion.type, sep1.type, datos.type, sep2.type, galeria.type, pie.type], [9, 14, 10, 14, 12, 10]);
    return {
        miniatura: seccion.accessory.media.url,
        titulo: seccion.components[0].content,
        cuerpo: seccion.components[1].content,
        datos: datos.content,
        imagen: galeria.items[0].media.url,
        pie: pie.content,
        color: c.accent_color
    };
}
const hora = (p) => p.datos.match(/Hora: (\d\d:\d\d)/)[1];

test.beforeEach((ctx) => {
    ctx.mock.timers.enable({ apis: ["setTimeout"] });
    col = new ColeccionFalsa();
    t = new Date("2026-11-07T10:00:00Z").getTime();
    enviados = []; editados = []; borrados = []; borrado = false;
    ER.limpiarCache();
    ER.usarColeccion(col);
    ER.usarAhora(() => t);
    img.usarBuscador(async () => ["https://img/a.png", "https://img/b.png", "https://img/c.png"]);
    N.configurar({ channels: { fetch: async (id) => (id === canal.id ? canal : null) } });
});
test.afterEach(() => { N.detenerRefresco(REGION); ER.limpiarCache(); });

/** Avanza el reloj interno y los timers a la vez. */
async function avanzar(ctx, ms) {
    t += ms;
    ctx.mock.timers.tick(ms);
    await vaciar();
}

test("publicado: se edita cada 5 min con la hora nueva y la misma frase e imagen de esa hora", async (ctx) => {
    await N.iniciarNoticiero(REGION, canal.id);
    assert.equal(enviados.length, 1);
    const inicial = enviados[0].p;
    assert.equal(inicial.miniatura, configDe(REGION).noticieroMiniatura, "la miniatura es fija");
    assert.equal(inicial.titulo, "### Clima actual en Tobeya");
    assert.match(inicial.cuerpo, /^.+\n\n-# .+/);
    assert.ok(inicial.imagen.startsWith("https://img/"), "la imagen grande es la del clima");
    assert.match(inicial.datos, /Día: 0/);
    assert.match(inicial.datos, /Estación: Otoño/);
    assert.match(inicial.datos, /Temperatura: -?\d+°C/);

    await avanzar(ctx, REFRESCO - 1000);
    assert.equal(editados.length, 0, "no debe editar antes de los 5 min");

    await avanzar(ctx, 1000);
    assert.equal(editados.length, 1);
    const e1 = editados[0].p;
    assert.equal(e1.cuerpo, inicial.cuerpo, "la frase se mantiene dentro de la hora");
    assert.equal(e1.imagen, inicial.imagen, "la imagen se mantiene dentro de la hora");
    assert.equal(hora(e1), "00:12");   // 5 min reales = 12 min internos
    assert.match(e1.pie, /cada 5 minutos/);

    await avanzar(ctx, REFRESCO);
    assert.equal(editados.length, 2);
    assert.equal(hora(editados[1].p), "00:24");
});

test("un cambio de hora edita con contenido nuevo y reinicia la cuenta de 5 min", async (ctx) => {
    await N.iniciarNoticiero(REGION, canal.id);
    await avanzar(ctx, 4 * MIN);
    t += 21 * MIN + 1000;   // llega la hora 1 (sin disparar el refresco todavía)
    await ER.actualizar(REGION);
    await vaciar();
    assert.equal(editados.length, 1, "el cambio de hora edita");
    assert.equal(hora(editados[0].p), "01:00");

    // El refresco cuenta desde esa edición: 4 min después aún no edita
    ctx.mock.timers.tick(4 * MIN); await vaciar();
    assert.equal(editados.length, 1);
    ctx.mock.timers.tick(1 * MIN); await vaciar();
    assert.equal(editados.length, 2);
});

test("detenido: deja de editarse", async (ctx) => {
    await N.iniciarNoticiero(REGION, canal.id);
    await N.detenerNoticiero(REGION);
    await avanzar(ctx, REFRESCO * 3);
    assert.equal(editados.length, 0);
    assert.equal(enviados.length, 1);
});

test("si borran el mensaje, el refresco envía uno nuevo y sigue editando ese", async (ctx) => {
    await N.iniciarNoticiero(REGION, canal.id);
    borrado = 10008;
    await avanzar(ctx, REFRESCO);
    assert.equal(enviados.length, 2);
    assert.equal(col.docs.get(REGION).noticiero.mensajeId, "m2");
    borrado = false;
    await avanzar(ctx, REFRESCO);
    assert.equal(editados.at(-1).id, "m2");
});

test("mensaje antiguo con embed (no editable a V2): envía uno nuevo y borra el viejo", async (ctx) => {
    await N.iniciarNoticiero(REGION, canal.id);
    borrado = 50035;
    await avanzar(ctx, REFRESCO);
    assert.equal(enviados.length, 2);
    assert.deepEqual(borrados, ["m1"]);
    assert.equal(col.docs.get(REGION).noticiero.mensajeId, "m2");
});
