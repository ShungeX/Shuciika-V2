const test = require("node:test");
const assert = require("node:assert/strict");
const { getTexto, TEXTOS } = require("../../functions/Clima/textos");
const { ESTADOS, FASES } = require("../../functions/Clima/config");
const { validarTextos } = require("../../scripts/validarTextos");

test("todas las combinaciones estado × fase existen y nunca dan 'Informacion no disponible'", () => {
    for (const e of ESTADOS) {
        for (const f of FASES) {
            assert.ok(TEXTOS.estados[e]?.[f], `falta ${e}/${f}`);
            const t = getTexto(e, f, null, { regionId: "test" });
            assert.ok(t.titulo && t.frase && /^#[0-9a-f]{6}$/i.test(t.color), `${e}/${f}`);
            assert.ok(!/Informacion no disponible/i.test(t.frase));
        }
    }
});

test("migración: chistes internos copiados tal cual y correcciones aplicadas", () => {
    assert.ok(TEXTOS.estados.Nublado.Tarde.frases.includes("Ay ma... Espera ese no es el texto"));
    assert.ok(TEXTOS.estados.Soleado.Madrugada.frases.includes("#Miedo"));
    assert.equal(TEXTOS.estados.Soleado["Día"].color, "#f7de3f");
    assert.deepEqual(TEXTOS.estados.Lluvioso.Tarde.frases, []);
    assert.ok(TEXTOS.estados.Lluvioso.Tarde.todo);
    assert.ok(!TEXTOS.estados.Lluvioso.Noche.frases.includes(""));
    for (const f of FASES) assert.ok(TEXTOS.estados.Tormenta[f].titulo.trim(), `Tormenta/${f} sin título`);
});

test("respaldo: frases vacías → genericos.porEstado → genericos.porFase → '...'", () => {
    const textos = {
        estados: { A: { Tarde: { titulo: "t", frases: [], color: "#000000" } } },
        genericos: { porEstado: { A: ["genérico de A"] }, porFase: { Tarde: ["genérico de tarde"] } },
        cambios: {}
    };
    assert.equal(getTexto("A", "Tarde", null, { textos, regionId: "r1" }).frase, "genérico de A");
    textos.genericos.porEstado.A = [];
    assert.equal(getTexto("A", "Tarde", null, { textos, regionId: "r2" }).frase, "genérico de tarde");
    textos.genericos.porFase.Tarde = [];
    assert.equal(getTexto("A", "Tarde", null, { textos, regionId: "r3" }).frase, "...");
});

test("no repite la última frase mostrada en la región", () => {
    let ultima = null;
    for (let i = 0; i < 200; i++) {
        const { frase } = getTexto("Soleado", "Noche", null, { regionId: "sin-repetir" });
        assert.notEqual(frase, ultima);
        ultima = frase;
    }
});

test("aviso solo cuando hay previo y existe cambios['previo>estado']", () => {
    assert.ok(getTexto("Lluvioso", "Tarde", "Nublado").aviso);
    assert.equal(getTexto("Lluvioso", "Tarde").aviso, undefined);
    assert.equal(getTexto("Soleado", "Tarde", "Ventoso").aviso, undefined);
});

test("validar-textos detecta TODO, vacíos, colores y copy-paste", () => {
    const r = validarTextos({
        estados: {
            A: { Tarde: { titulo: "", frases: ["", "Cielos despejados"], color: "f7de3f" } },
            B: { Tarde: { titulo: "ok", frases: ["Cielos despejados"], color: "#123456" }, Noche: { titulo: "ok", frases: [], color: "#123456" } }
        }
    }, { estados: ["A", "B"], fases: ["Tarde", "Noche"] });
    assert.ok(r.titulosVacios.includes("A/Tarde"));
    assert.ok(r.frasesVacias.includes("A/Tarde"));
    assert.ok(r.coloresMal.some((c) => c.startsWith("A/Tarde")));
    assert.ok(r.sinFrases.includes("B/Noche"));
    assert.ok(r.faltantes.includes("A/Noche"));
    assert.ok(r.repetidas.some((x) => x.frase === "Cielos despejados"));
});

test("climaTextos.json real: sin títulos vacíos, frases vacías ni colores mal formados", () => {
    const r = validarTextos(TEXTOS);
    assert.deepEqual(r.titulosVacios, []);
    assert.deepEqual(r.frasesVacias, []);
    assert.deepEqual(r.coloresMal, []);
    assert.deepEqual(r.faltantes, []);
    // El copy-paste de Soleado/Tarde en Lluvioso/Tarde ya no está
    assert.ok(!r.repetidas.some((x) => x.frase === "Cielos despejados"));
});
