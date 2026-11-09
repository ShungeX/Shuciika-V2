const test = require("node:test");
const assert = require("node:assert/strict");
const { ColeccionFalsa } = require("./coleccionFalsa");
const ER = require("../../functions/Clima/estadoRegion");
const M = require("../../functions/Clima/motor");
const { configDe } = require("../../functions/Clima/config");

const REGION = "TOB-001";
const CONFIG = configDe(REGION);
const MS_HORA = 25 * 60000;
const T0 = new Date("2026-07-10T00:00:00Z").getTime();

let col, reloj, eventosRecibidos;
const nombresEventos = ["cambioHora", "cambioFase", "cambioDia", "cambioEstacion", "cambioClima"];
const oyentes = nombresEventos.map((n) => [n, (p) => eventosRecibidos.push({ n, ...p })]);

test.beforeEach(() => {
    col = new ColeccionFalsa();
    reloj = T0;
    eventosRecibidos = [];
    ER.limpiarCache();
    ER.usarColeccion(col);
    ER.usarAhora(() => reloj);
    for (const [n, fn] of oyentes) ER.eventos.on(n, fn);
});
test.afterEach(() => {
    for (const [n, fn] of oyentes) ER.eventos.off(n, fn);
    ER.limpiarCache();
});

test("crea el documento con upsert: epoch = ahora, cicloMin 600, estado Nublado", async () => {
    const est = await ER.getEstado(REGION);
    const doc = col.docs.get(REGION);
    assert.equal(new Date(doc.reloj.epoch).getTime(), T0);
    assert.equal(doc.reloj.cicloMin, 600);
    assert.equal(doc.clima.estado, "Nublado");
    assert.equal(doc.clima.horaIndex, 0);
    assert.deepEqual(doc.noticiero, { canalId: null, mensajeId: null });
    assert.equal(est.estado, "Nublado");
    assert.equal(est.estacion, "verano");
    assert.ok(["seco", "variable", "lluvioso", "tormentoso"].includes(est.regimen));
    assert.ok(Number.isInteger(est.temperatura));
});

test("documento existente (status del instituto): conserva sus campos y solo agrega los del módulo", async () => {
    col.docs.set(REGION, { _id: REGION, nucleoCentral: { points: 5, maxPoints: 10 }, status: "Estable", messageId: "123" });
    await ER.getEstado(REGION);
    const doc = col.docs.get(REGION);
    assert.deepEqual(doc.nucleoCentral, { points: 5, maxPoints: 10 });
    assert.equal(doc.status, "Estable");
    assert.equal(doc.messageId, "123");
    assert.ok(doc.reloj && doc.clima && doc.noticiero && Array.isArray(doc.historial));
    assert.equal(doc.nombre, "Tobeya");
});

test("no consulta Mongo en cada lectura dentro de la misma hora", async () => {
    await ER.getEstado(REGION);
    const antes = col.escrituras;
    const findOne = col.findOne.bind(col);
    let lecturas = 0;
    col.findOne = async (...a) => { lecturas++; return findOne(...a); };
    for (let i = 0; i < 20; i++) { reloj += 60000; await ER.getEstado(REGION); }   // 20 min < 25
    assert.equal(lecturas, 0);
    assert.equal(col.escrituras, antes);
});

test("recupera horas perdidas: igual a la simulación pura, todo el historial y UN solo cambioClima", async () => {
    await ER.cargar(REGION);
    const inicial = structuredClone(col.docs.get(REGION).clima);
    const relojDoc = col.docs.get(REGION).reloj;

    reloj = T0 + 60 * MS_HORA + 1000;   // bot apagado 60 horas internas
    await ER.actualizar(REGION);

    const esperado = M.simularHasta(inicial, 60, REGION, CONFIG, relojDoc, { ignorarOverrideAntesDe: 60 });
    const doc = col.docs.get(REGION);
    assert.equal(doc.clima.horaIndex, 60);
    assert.equal(doc.clima.estado, esperado.clima.estado);
    assert.equal(doc.clima.temperatura, esperado.clima.temperatura);
    const cambiosEsperados = esperado.cambios.slice(-24);
    assert.deepEqual(doc.historial.slice(-cambiosEsperados.length), cambiosEsperados);
    assert.ok(doc.historial.length <= 24);

    const porTipo = (n) => eventosRecibidos.filter((e) => e.n === n);
    assert.equal(porTipo("cambioHora").length, 1);
    assert.deepEqual([porTipo("cambioHora")[0].anterior, porTipo("cambioHora")[0].nuevo], [0, 60]);
    assert.equal(porTipo("cambioDia").length, 1);
    assert.ok(porTipo("cambioClima").length <= 1);
    if (esperado.clima.estado !== inicial.estado) {
        assert.deepEqual([porTipo("cambioClima")[0].anterior, porTipo("cambioClima")[0].nuevo], [inicial.estado, esperado.clima.estado]);
    }
});

test("brecha > 72 h: reinicia desde Nublado en la hora actual", async () => {
    await ER.cargar(REGION);
    reloj = T0 + 200 * MS_HORA + 1000;
    await ER.actualizar(REGION);
    const doc = col.docs.get(REGION);
    assert.equal(doc.clima.horaIndex, 200);
    assert.equal(doc.clima.estado, "Nublado");
    assert.equal(doc.clima.desdeHora, 200);
});

test("bloqueo optimista: si otro proceso ya actualizó, relee y se queda con eso", async () => {
    await ER.cargar(REGION);
    // Otro proceso avanza el documento a la hora 1 con un estado distinto
    col.docs.get(REGION).clima.horaIndex = 1;
    col.docs.get(REGION).clima.estado = "Tormenta";
    reloj = T0 + MS_HORA + 1000;
    await ER.actualizar(REGION);
    const est = await ER.getEstado(REGION);
    assert.equal(est.estado, "Tormenta");
    assert.equal(col.docs.get(REGION).clima.estado, "Tormenta");
});

test("override: cambioClima al empezar y al vencer; el clima natural sigue debajo", async () => {
    await ER.cargar(REGION);
    const natural = col.docs.get(REGION).clima.estado;
    eventosRecibidos = [];

    const ov = await ER.ponerOverride(REGION, { estado: "Nevada", horas: 3, motivo: "evento" });
    assert.equal(ov.estado, "Nevada");
    assert.equal(new Date(ov.hasta).getTime(), T0 + 3 * MS_HORA);
    assert.deepEqual(eventosRecibidos.filter((e) => e.n === "cambioClima").map((e) => [e.anterior, e.nuevo]), [[natural, "Nevada"]]);
    let est = await ER.getEstado(REGION);
    assert.equal(est.estado, "Nevada");
    assert.equal(est.estadoNatural, natural);
    assert.equal(est.override.motivo, "evento");

    // Pronóstico: override antes de hasta, natural después
    const pron = await ER.getPronostico(REGION, 6);
    assert.deepEqual(pron.slice(0, 2).map((p) => p.estado), ["Nevada", "Nevada"]);
    assert.deepEqual(pron.slice(2).map((p) => p.estado), pron.slice(2).map((p) => p.estadoNatural));

    eventosRecibidos = [];
    reloj = T0 + 3 * MS_HORA + 1000;
    await ER.actualizar(REGION);
    est = await ER.getEstado(REGION);
    assert.equal(est.override, undefined);
    assert.equal(col.docs.get(REGION).clima.override, null);
    const cc = eventosRecibidos.filter((e) => e.n === "cambioClima");
    assert.equal(cc.length, est.estado === "Nevada" ? 0 : 1);
    if (cc.length) assert.deepEqual([cc[0].anterior, cc[0].nuevo], ["Nevada", est.estado]);
});

test("pronóstico determinista: coincide con lo que ocurre después", async () => {
    await ER.cargar(REGION);
    const pron = await ER.getPronostico(REGION, 30);
    for (let i = 1; i <= 30; i++) {
        reloj = T0 + i * MS_HORA + 1000;
        const est = await ER.getEstado(REGION);
        assert.equal(est.estado, pron[i - 1].estado, `hora ${i}`);
        assert.equal(est.temperatura, pron[i - 1].temperatura, `temperatura hora ${i}`);
        assert.equal(est.fase, pron[i - 1].fase);
    }
});

test("adelantar reloj: salta a la hora pedida simulando las intermedias", async () => {
    await ER.cargar(REGION);
    const r = await ER.adelantarReloj(REGION, 7);
    assert.equal(r.delta, 7);
    assert.equal(r.estado.horaDelDia, 7);
    assert.equal(r.estado.fase, "Día");
    assert.equal(col.docs.get(REGION).reloj.horaBase, 7);
    assert.equal(col.docs.get(REGION).clima.horaIndex, 7);
});

test("reiniciar clima: estado elegido en la hora actual y queda en el historial", async () => {
    await ER.cargar(REGION);
    const est = await ER.reiniciarClima(REGION, "Soleado");
    assert.equal(est.estadoNatural, "Soleado");
    const doc = col.docs.get(REGION);
    assert.deepEqual(doc.historial[doc.historial.length - 1], { estado: "Soleado", desdeHora: 0 });
    assert.ok(eventosRecibidos.some((e) => e.n === "cambioClima" && e.nuevo === "Soleado"));
});
