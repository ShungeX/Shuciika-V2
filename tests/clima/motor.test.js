const test = require("node:test");
const assert = require("node:assert/strict");
const { configDe } = require("../../functions/Clima/config");
const M = require("../../functions/Clima/motor");
const { infoHora } = require("../../functions/Clima/reloj");
const { fnv1a32, azar } = require("../../functions/Clima/azar");

const REGION = "TOB-001";
const CONFIG = configDe(REGION);
const relojEn = (iso) => ({ epoch: new Date(iso), cicloMin: 600, horaBase: 0 });
const VERANO = relojEn("2026-07-01T00:00:00Z");
const INVIERNO = relojEn("2026-01-05T00:00:00Z");

/** Clima armado a mano para una hora concreta. */
function climaBase(over = {}) {
    return {
        horaIndex: 0, estado: "Nublado", previo: null, desdeHora: 0, duracionObjetivo: 3,
        regimen: { dia: 0, tipo: "variable" }, cambiosDia: { dia: 0, n: 0 },
        temperatura: 20, override: null, ...over
    };
}

test("PRNG: FNV-1a de 32 bits devuelve uint32 y azar está en [0, 1)", () => {
    for (const s of ["", "TOB-001:0:trans", "TOB-001:123456:regimen-sorteo", "otoño"]) {
        const h = fnv1a32(s);
        assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff, s);
    }
    for (let i = 0; i < 500; i++) {
        const u = azar(REGION, i, "trans");
        assert.ok(u >= 0 && u < 1);
    }
    assert.equal(azar(REGION, 42, "dur"), azar(REGION, 42, "dur"));
    assert.notEqual(azar(REGION, 42, "dur"), azar(REGION, 42, "trans"));
});

test("determinismo: misma región + misma hora + mismo estado inicial = mismo resultado", () => {
    const a = M.climaInicial(100, REGION, CONFIG, VERANO);
    const b = M.climaInicial(100, REGION, CONFIG, VERANO);
    assert.deepEqual(a, b);
    let x = a, y = b;
    for (let h = 101; h < 101 + 24 * 30; h++) {
        x = M.siguienteHora(x, h, REGION, CONFIG, VERANO);
        y = M.siguienteHora(y, h, REGION, CONFIG, VERANO);
        assert.deepEqual(x, y, `hora ${h}`);
    }
    // Otra región diverge
    let z = M.climaInicial(100, "OTRA-001", CONFIG, VERANO);
    let distinto = false;
    for (let h = 101; h < 101 + 24 * 10; h++) {
        z = M.siguienteHora(z, h, "OTRA-001", CONFIG, VERANO);
        const w = M.simularHasta(a, h, REGION, CONFIG, VERANO).clima;
        if (z.estado !== w.estado) distinto = true;
    }
    assert.ok(distinto, "dos regiones distintas no deberían tener el mismo clima");
});

test("siguienteHora no modifica el objeto de entrada", () => {
    const c = climaBase({ duracionObjetivo: 1 });
    const copia = structuredClone(c);
    M.siguienteHora(c, 1, REGION, CONFIG, VERANO);
    assert.deepEqual(c, copia);
});

test("duración mínima: nunca cambia antes de duracionObjetivo (salvo fin forzado)", () => {
    for (let inicio = 1000; inicio < 1000 + 24 * 40; inicio += 13) {
        const c0 = climaBase({ horaIndex: inicio, desdeHora: inicio, duracionObjetivo: 5, estado: "Soleado",
            regimen: { dia: Math.floor(inicio / 24), tipo: "seco" }, cambiosDia: { dia: Math.floor(inicio / 24), n: 0 } });
        let c = c0;
        for (let h = inicio + 1; h < inicio + 5; h++) {
            c = M.siguienteHora(c, h, REGION, CONFIG, VERANO);
            assert.equal(c.estado, "Soleado", `cambió en la hora ${h - inicio} de 5`);
        }
        c = M.siguienteHora(c, inicio + 5, REGION, CONFIG, VERANO);
        // A la 5.ª hora puede cambiar (salvo tope diario); si cambió, desdeHora = esa hora
        if (c.estado !== "Soleado") assert.equal(c.desdeHora, inicio + 5);
    }
});

test("fin forzado: Niebla en Tarde con cambiosDia.n = maxCambiosPorDia DEBE cambiar", () => {
    const h = 24 * 10 + 13;   // 13:00 = Tarde
    assert.equal(infoHora(VERANO, h).fase, "Tarde");
    const dia = Math.floor(h / 24);
    const c = climaBase({
        horaIndex: h - 1, estado: "Niebla", previo: "Nublado", desdeHora: h - 1, duracionObjetivo: 4,
        regimen: { dia, tipo: "variable" }, cambiosDia: { dia, n: CONFIG.maxCambiosPorDia }
    });
    const sig = M.siguienteHora(c, h, REGION, CONFIG, VERANO);
    assert.notEqual(sig.estado, "Niebla");
    assert.ok(CONFIG.transiciones.Niebla[sig.estado]);
});

test("fin forzado: Nevada fuera de invierno termina aunque no se cumpla la duración", () => {
    const h = 24 * 3 + 10;
    const dia = Math.floor(h / 24);
    const c = climaBase({ horaIndex: h - 1, estado: "Nevada", desdeHora: h - 1, duracionObjetivo: 8,
        regimen: { dia, tipo: "variable" }, cambiosDia: { dia, n: 0 } });
    assert.notEqual(M.siguienteHora(c, h, REGION, CONFIG, VERANO).estado, "Nevada");
    assert.equal(M.siguienteHora(c, h, REGION, CONFIG, INVIERNO).estado, "Nevada");
});

test("tope diario: sin fin forzado se mantiene el estado al llegar a maxCambiosPorDia", () => {
    const h = 24 * 5 + 14;
    const dia = Math.floor(h / 24);
    const c = climaBase({ horaIndex: h - 1, estado: "Soleado", desdeHora: h - 10, duracionObjetivo: 2,
        regimen: { dia, tipo: "variable" }, cambiosDia: { dia, n: CONFIG.maxCambiosPorDia } });
    const sig = M.siguienteHora(c, h, REGION, CONFIG, VERANO);
    assert.equal(sig.estado, "Soleado");
    assert.ok(sig.duracionObjetivo > h - sig.desdeHora - 1, "debe extender la duración");
});

test("multiplicadorMax se aplica al producto estación × régimen × fase", () => {
    const h = 24 * 2 + 14;   // Tarde, verano
    const info = infoHora(VERANO, h);
    const pesos = Object.fromEntries(M.pesosDestino(climaBase({ estado: "Nublado" }), info, "tormentoso", CONFIG));
    // Tormenta: 2.5 × 1.5 × 1.4 = 5.25 → tope 4 → 6 × 4
    assert.equal(pesos.Tormenta, CONFIG.transiciones.Nublado.Tormenta * CONFIG.multiplicadorMax);
    // Niebla no puede empezar en la tarde
    assert.equal(pesos.Niebla, 0);
    // Nevada: multiplicador 0 en verano
    assert.equal(pesos.Nevada, 0);
});

test("histéresis: volver al estado previo pesa × histeresisRetorno", () => {
    const info = infoHora(VERANO, 24 * 2 + 9);
    const sin = Object.fromEntries(M.pesosDestino(climaBase({ estado: "Ventoso", previo: null }), info, "variable", CONFIG));
    const con = Object.fromEntries(M.pesosDestino(climaBase({ estado: "Ventoso", previo: "Soleado" }), info, "variable", CONFIG));
    assert.ok(Math.abs(con.Soleado - sin.Soleado * CONFIG.histeresisRetorno) < 1e-9);
    assert.equal(con.Nublado, sin.Nublado);
});

test("invariantes sobre 1000 días simulados (las 4 estaciones)", () => {
    const reloj = relojEn("2026-01-01T00:00:00Z");   // 1000 días internos ≈ 417 días reales
    let c = M.climaInicial(0, REGION, CONFIG, reloj);
    const vistos = new Set();
    for (let h = 1; h <= 1000 * 24; h++) {
        const sig = M.siguienteHora(c, h, REGION, CONFIG, reloj);
        const info = infoHora(reloj, h);
        vistos.add(info.estacion);
        if (sig.estado !== c.estado) {
            assert.ok(CONFIG.transiciones[c.estado][sig.estado], `transición inexistente ${c.estado}>${sig.estado}`);
            if (sig.estado === "Niebla") assert.ok(CONFIG.nieblaInicioEn.includes(info.fase), `Niebla empezó en ${info.fase}`);
        }
        if (sig.estado === "Nevada") assert.equal(info.estacion, "invierno", `Nevada en ${info.estacion} (hora ${h})`);
        if (sig.estado === "Niebla") assert.ok(CONFIG.nieblaPermitidaEn.includes(info.fase), `Niebla siguió en ${info.fase}`);
        assert.ok(sig.temperatura >= CONFIG.temperatura.min && sig.temperatura <= CONFIG.temperatura.max);
        assert.ok(sig.cambiosDia.n <= CONFIG.maxCambiosPorDia + 2, "demasiados cambios en un día");
        c = sig;
    }
    assert.equal(vistos.size, 4, "la simulación debe recorrer las 4 estaciones");
});

test("temperatura: suavizado 0.5 hacia el objetivo y jitter solo en el valor mostrado", () => {
    const info = infoHora(VERANO, 24 * 4 + 14);
    const objetivo = M.temperaturaObjetivo(info.estacion, "Soleado", info.fase, CONFIG);
    assert.equal(objetivo, 26 + 2 + 3);
    assert.equal(M.avanzarTemperatura(21, objetivo, CONFIG), 26);
    assert.equal(M.avanzarTemperatura(undefined, objetivo, CONFIG), objetivo);
    assert.equal(M.avanzarTemperatura(39.9, 60, CONFIG), 40);   // límite superior
    for (let h = 0; h < 200; h++) {
        const t = M.temperaturaMostrada(20.4, REGION, h, CONFIG);
        assert.ok([19, 20, 21].includes(t));
        assert.ok(Number.isInteger(t));
    }
    // El valor guardado no acumula jitter: estado constante → converge al objetivo
    let c = climaBase({ estado: "Soleado", duracionObjetivo: 999, temperatura: 0 });
    for (let h = 1; h <= 30; h++) c = M.siguienteHora(c, h, REGION, CONFIG, VERANO);
    const infoFinal = infoHora(VERANO, 30);
    const objFinal = M.temperaturaObjetivo(infoFinal.estacion, "Soleado", infoFinal.fase, CONFIG);
    assert.ok(Math.abs(c.temperatura - objFinal) < 4, `T=${c.temperatura} lejos de ${objFinal}`);
});

test("override: la temperatura usa el estado visible; la simulación natural no cambia", () => {
    const base = climaBase({ estado: "Soleado", duracionObjetivo: 999, temperatura: 25 });
    const hasta = new Date(VERANO.epoch.getTime() + 25 * 60000 * 100);
    const conOv = { ...base, override: { estado: "Nevada", hasta } };
    const a = M.siguienteHora(base, 1, REGION, CONFIG, VERANO);
    const b = M.siguienteHora(conOv, 1, REGION, CONFIG, VERANO);
    const c = M.siguienteHora(conOv, 1, REGION, CONFIG, VERANO, { ignorarOverride: true });
    assert.equal(a.estado, b.estado);
    assert.ok(b.temperatura < a.temperatura);
    assert.equal(c.temperatura, a.temperatura);
    assert.equal(M.estadoVisible(conOv, VERANO.epoch.getTime()), "Nevada");
    assert.equal(M.estadoVisible(conOv, hasta.getTime()), "Soleado");
});

test("brecha > 72 h: simularHasta reinicia desde el estado inicial con temperatura = objetivo", () => {
    const c = M.climaInicial(0, REGION, CONFIG, VERANO);
    const r = M.simularHasta({ ...c, estado: "Tormenta" }, 73, REGION, CONFIG, VERANO);
    assert.equal(r.reiniciado, true);
    assert.equal(r.clima.estado, CONFIG.estadoInicial);
    assert.equal(r.clima.horaIndex, 73);
    const info = infoHora(VERANO, 73);
    assert.equal(r.clima.temperatura, M.temperaturaObjetivo(info.estacion, CONFIG.estadoInicial, info.fase, CONFIG));
    assert.equal(M.simularHasta(c, 72, REGION, CONFIG, VERANO).reiniciado, false);
});
