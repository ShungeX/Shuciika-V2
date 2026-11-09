// TEST DE LEGADO: que no se vuelva a olvidar ninguna transición de Hora_rol.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const legado = require("../fixtures/matrizLegado.json");
const { REGIONES } = require("../../functions/Clima/config");

// Flechas que NO existían en la matriz original. Si agregas otra al CONFIG, decláala aquí.
const NUEVAS = ["Nublado>Nevada", "Nublado>Niebla", "Granizada>Nevada", "Niebla>Soleado", "Niebla>Nublado"];

const flechasLegado = new Set();
for (const [origen, fila] of Object.entries(legado)) {
    if (origen.startsWith("_")) continue;
    for (const [destino, p] of Object.entries(fila)) {
        if (p > 0 && origen !== destino) flechasLegado.add(`${origen}>${destino}`);
    }
}

for (const [regionId, CONFIG] of Object.entries(REGIONES)) {
    test(`${regionId}: toda flecha del legado (prob > 0, origen != destino) existe en CONFIG.transiciones`, () => {
        const faltan = [...flechasLegado].filter((f) => {
            const [o, d] = f.split(">");
            return !(CONFIG.transiciones[o] && CONFIG.transiciones[o][d] > 0);
        });
        assert.deepEqual(faltan, [], `Faltan transiciones del legado: ${faltan.join(", ")}`);
    });

    test(`${regionId}: toda flecha del CONFIG está en el legado o declarada en NUEVAS`, () => {
        const sinDeclarar = [];
        for (const [o, fila] of Object.entries(CONFIG.transiciones)) {
            for (const d of Object.keys(fila)) {
                const f = `${o}>${d}`;
                if (!flechasLegado.has(f) && !NUEVAS.includes(f)) sinDeclarar.push(f);
            }
        }
        assert.deepEqual(sinDeclarar, [], `Flechas sin declarar: ${sinDeclarar.join(", ")}`);
    });

    test(`${regionId}: las flechas NUEVAS existen de verdad en el CONFIG`, () => {
        for (const f of NUEVAS) {
            const [o, d] = f.split(">");
            assert.ok(CONFIG.transiciones[o]?.[d] > 0, `NUEVAS declara ${f} pero no está en el CONFIG`);
        }
    });

    test(`${regionId}: ningún estado húmedo pasa directo a Soleado o Caluroso`, () => {
        for (const o of ["Lluvioso", "Granizada", "Tormenta", "Nevada"]) {
            assert.equal(CONFIG.transiciones[o].Soleado, undefined, `${o}>Soleado`);
            assert.equal(CONFIG.transiciones[o].Caluroso, undefined, `${o}>Caluroso`);
        }
    });
}
