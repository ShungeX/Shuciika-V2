// Simula el clima con reloj falso en las 4 estaciones e imprime estadísticas.
//   npm run simular-clima -- <regionId> <nDias>
//   npm run simular-clima -- TOB-001 120
// Cada estación arranca desde cero (estado inicial y régimen nuevos). No toca la BD.
// Ajusta SOLO functions/Clima/config.js según lo que salga aquí.

const { configDe, ESTADOS } = require("../functions/Clima/config");
const { climaInicial, siguienteHora } = require("../functions/Clima/motor");
const { infoHora } = require("../functions/Clima/reloj");

const regionId = process.argv[2] || "TOB-001";
const nDias = Math.max(1, parseInt(process.argv[3] || "120", 10));
const CONFIG = configDe(regionId);

// Inicio de cada estación (UTC); el reloj falso se comprime para no salirse de ella.
const ESTACIONES = [
    { nombre: "primavera", inicio: "2026-03-21T00:00:00Z" },
    { nombre: "verano", inicio: "2026-06-22T00:00:00Z" },
    { nombre: "otoño", inicio: "2026-09-23T00:00:00Z" },
    { nombre: "invierno", inicio: "2026-12-22T00:00:00Z" }
];
const HUMEDOS = new Set(["Lluvioso", "Tormenta", "Granizada"]);
const RANGO_CAMBIOS = [3, 6];
const RANGO_HUMEDO = { verano: [30, 45], invierno: [0, 12] };

const pct = (n, total) => (total ? (100 * n) / total : 0);
const f1 = (n) => n.toFixed(1);
function percentil(ordenado, p) {
    if (!ordenado.length) return 0;
    const i = Math.min(ordenado.length - 1, Math.ceil((p / 100) * ordenado.length) - 1);
    return ordenado[Math.max(0, i)];
}

function simularEstacion({ nombre, inicio }, indice) {
    const horas = nDias * 24;
    // ~80 días reales por estación como máximo para que la fecha no cambie de estación
    const cicloMin = Math.min(CONFIG.reloj.cicloMin, Math.floor((80 * 1440) / nDias));
    const horaBase = (indice + 1) * 1_000_000;   // flujo de azar distinto por estación
    const reloj = { epoch: new Date(inicio), cicloMin, horaBase };

    let clima = climaInicial(horaBase, regionId, CONFIG, reloj);
    const serie = [clima.estado];
    const fuera = [];
    for (let h = horaBase + 1; h < horaBase + horas; h++) {
        clima = siguienteHora(clima, h, regionId, CONFIG, reloj);
        const est = infoHora(reloj, h).estacion;
        if (est !== nombre) fuera.push(h);
        serie.push(clima.estado);
    }
    return { serie, fuera: fuera.length, cicloMin };
}

function analizar(serie) {
    const total = serie.length;
    const horasPor = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
    const visitasPor = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
    const tramos = [];   // { estado, horas }
    for (const e of serie) {
        horasPor[e]++;
        const ultimo = tramos[tramos.length - 1];
        if (ultimo && ultimo.estado === e) ultimo.horas++;
        else { tramos.push({ estado: e, horas: 1 }); visitasPor[e]++; }
    }
    const visitas = tramos.length;
    const cambios = tramos.length - 1;
    const dias = total / 24;

    let rachaLluvia = 0;
    for (const t of tramos) if (t.estado === "Lluvioso") rachaLluvia = Math.max(rachaLluvia, t.horas);

    // Rachas húmedas (Lluvioso+Tormenta+Granizada seguidos)
    const rachasHumedas = [];
    let actual = 0;
    for (const e of serie) {
        if (HUMEDOS.has(e)) actual++;
        else if (actual) { rachasHumedas.push(actual); actual = 0; }
    }
    if (actual) rachasHumedas.push(actual);
    rachasHumedas.sort((a, b) => a - b);

    let diasSinLluvia = 0;
    for (let d = 0; d < Math.floor(dias); d++) {
        if (!serie.slice(d * 24, d * 24 + 24).some((e) => HUMEDOS.has(e))) diasSinLluvia++;
    }

    let aba = 0;
    for (let i = 2; i < tramos.length; i++) {
        if (tramos[i].estado === tramos[i - 2].estado && tramos[i - 1].horas <= 3) aba++;
    }

    const horasHumedas = serie.filter((e) => HUMEDOS.has(e)).length;
    return { total, horasPor, visitasPor, visitas, cambios, dias, rachaLluvia, rachasHumedas, diasSinLluvia, aba, horasHumedas };
}

console.log(`\nSimulación de clima · ${regionId} (${CONFIG.nombre}) · ${nDias} días internos por estación\n`);
let avisos = 0;

ESTACIONES.forEach((est, i) => {
    const { serie, fuera, cicloMin } = simularEstacion(est, i);
    const r = analizar(serie);
    const pctHumedo = pct(r.horasHumedas, r.total);
    const cambiosDia = r.cambios / r.dias;

    console.log(`══ ${est.nombre.toUpperCase()} ══  (${r.total} h, reloj falso ${cicloMin} min/día${fuera ? `, ⚠ ${fuera} h fuera de la estación` : ""})`);
    console.log("  Estado       % tiempo   % visitas");
    for (const e of ESTADOS) {
        console.log(`  ${e.padEnd(11)} ${f1(pct(r.horasPor[e], r.total)).padStart(7)}%  ${f1(pct(r.visitasPor[e], r.visitas)).padStart(8)}%`);
    }
    const okCambios = cambiosDia >= RANGO_CAMBIOS[0] && cambiosDia <= RANGO_CAMBIOS[1];
    console.log(`  Cambios por día (media): ${cambiosDia.toFixed(2)} ${okCambios ? "✓" : `⚠ fuera de ${RANGO_CAMBIOS.join("–")}`}`);
    const rango = RANGO_HUMEDO[est.nombre];
    const okHumedo = !rango || (pctHumedo >= rango[0] && pctHumedo <= rango[1]);
    console.log(`  Horas húmedas (Lluvioso+Tormenta+Granizada): ${f1(pctHumedo)}% ${rango ? (okHumedo ? "✓" : `⚠ fuera de ${rango.join("–")}%`) : ""}`);
    console.log(`  Racha máxima de Lluvioso: ${r.rachaLluvia} h`);
    const rh = r.rachasHumedas;
    console.log(`  Rachas húmedas: ${rh.length} · mediana ${percentil(rh, 50)} h · p90 ${percentil(rh, 90)} h · p99 ${percentil(rh, 99)} h · >24 h: ${f1(pct(rh.filter((x) => x > 24).length, rh.length))}%`);
    console.log(`  Días sin lluvia: ${r.diasSinLluvia} de ${Math.floor(r.dias)} (${f1(pct(r.diasSinLluvia, Math.floor(r.dias)))}%)`);
    console.log(`  Patrón A-B-A (B de <= 3 h): ${r.aba} veces (${(r.aba / r.dias).toFixed(2)} por día)`);

    for (const e of ESTADOS) {
        const m = CONFIG.porEstacion[est.nombre]?.[e] ?? 1;
        if (m > 0 && r.horasPor[e] === 0) {
            console.log(`  ⚠ ${e} NUNCA apareció en ${est.nombre} (multiplicador ${m})`);
            avisos++;
        }
    }
    if (!okCambios || !okHumedo) avisos++;
    console.log("");
});

console.log(avisos ? `${avisos} aviso(s). Ajusta functions/Clima/config.js (no el código).` : "Todo dentro de los rangos orientativos.");
