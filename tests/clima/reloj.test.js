const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../../functions/Clima/reloj");

test("fases en los límites (5/6, 6/7, 11/12, 17/18, 18/19, 23/0)", () => {
    const casos = [
        [5, "Madrugada"], [6, "Amanecer"],
        [6, "Amanecer"], [7, "Día"],
        [11, "Día"], [12, "Tarde"],
        [17, "Tarde"], [18, "Atardecer"],
        [18, "Atardecer"], [19, "Noche"],
        [23, "Noche"], [0, "Madrugada"]
    ];
    for (const [h, fase] of casos) assert.equal(R.faseDe(h), fase, `hora ${h}`);
});

test("carpeta de imágenes: Noche si >= 18 o <= 5", () => {
    assert.equal(R.carpetaLuzDe(5), "Noche");
    assert.equal(R.carpetaLuzDe(6), "Día");
    assert.equal(R.carpetaLuzDe(17), "Día");
    assert.equal(R.carpetaLuzDe(18), "Noche");
    assert.equal(R.carpetaLuzDe(0), "Noche");
});

test("estaciones en los límites de fecha (UTC)", () => {
    const casos = [
        ["2026-12-20T23:59:59Z", "otoño"], ["2026-12-21T00:00:00Z", "invierno"],
        ["2026-12-31T12:00:00Z", "invierno"], ["2027-01-01T00:00:00Z", "invierno"],
        ["2026-03-19T23:59:59Z", "invierno"], ["2026-03-20T00:00:00Z", "primavera"],
        ["2026-06-20T23:59:59Z", "primavera"], ["2026-06-21T00:00:00Z", "verano"],
        ["2026-09-21T23:59:59Z", "verano"], ["2026-09-22T00:00:00Z", "otoño"]
    ];
    for (const [fecha, est] of casos) assert.equal(R.estacionDe(new Date(fecha)), est, fecha);
});

test("reloj: 25 min por hora con cicloMin 600, inversa horaIndex -> fecha y fechas futuras", () => {
    const reloj = { epoch: new Date("2026-11-07T00:00:00Z"), cicloMin: 600, horaBase: 0 };
    assert.equal(R.msPorHora(reloj), 25 * 60000);
    const epoch = reloj.epoch.getTime();
    assert.equal(R.horaIndexEn(reloj, epoch), 0);
    assert.equal(R.horaIndexEn(reloj, epoch + 25 * 60000 - 1), 0);
    assert.equal(R.horaIndexEn(reloj, epoch + 25 * 60000), 1);
    // Un año en el futuro
    const futuro = new Date("2027-11-07T00:00:00Z").getTime();
    const h = R.horaIndexEn(reloj, futuro);
    assert.equal(h, (365 * 24 * 60) / 25);
    for (const x of [0, 1, 37, 1000, h]) {
        assert.equal(R.horaIndexEn(reloj, R.fechaDeHora(reloj, x).getTime()), x, `inversa de ${x}`);
    }
});

test("reloj: horaBase desplaza la hora sin romper la inversa", () => {
    const reloj = { epoch: new Date("2026-01-01T00:00:00Z"), cicloMin: 600, horaBase: 7 };
    assert.equal(R.horaIndexEn(reloj, reloj.epoch.getTime()), 7);
    assert.equal(R.fechaDeHora(reloj, 7).getTime(), reloj.epoch.getTime());
    const info = R.infoHora(reloj, 97);   // 97 = día 4, 01:00
    assert.deepEqual([info.dia, info.horaDelDia, info.fase, info.carpeta], [4, 1, "Madrugada", "Noche"]);
    assert.equal(R.horaIndexEn(reloj, info.fecha.getTime()), 97);
});

test("día y hora del día", () => {
    assert.equal(R.diaDe(0), 0);
    assert.equal(R.diaDe(23), 0);
    assert.equal(R.diaDe(24), 1);
    assert.equal(R.horaDelDiaDe(47), 23);
    assert.equal(R.horaDelDiaDe(48), 0);
});
