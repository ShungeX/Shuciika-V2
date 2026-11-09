// ═══ CLIMA-HORARIO: reloj interno (funciones puras, sin BD) ═══
// reloj = { epoch: Date, cicloMin: 600, horaBase: 0 }
// msPorHora = cicloMin × 60000 / 24   → 25 min reales por hora interna con cicloMin = 600

const msPorHora = (reloj) => (reloj.cicloMin * 60000) / 24;
const epochMs = (reloj) => new Date(reloj.epoch).getTime();

/** Hora interna absoluta en el instante `ms` (sirve para cualquier fecha, pasada o futura). */
function horaIndexEn(reloj, ms = Date.now()) {
    return Math.floor((ms - epochMs(reloj)) / msPorHora(reloj)) + (reloj.horaBase || 0);
}

/** Inversa: instante real (Date) en que EMPIEZA la hora interna `horaIndex`. */
function fechaDeHora(reloj, horaIndex) {
    return new Date(epochMs(reloj) + (horaIndex - (reloj.horaBase || 0)) * msPorHora(reloj));
}

/** Minuto interno (0-59) dentro de la hora en curso. */
function minutoEn(reloj, ms = Date.now()) {
    const transcurrido = (ms - epochMs(reloj)) / msPorHora(reloj);
    const fraccion = transcurrido - Math.floor(transcurrido);
    return Math.min(59, Math.floor(fraccion * 60));
}

const diaDe = (horaIndex) => Math.floor(horaIndex / 24);
const horaDelDiaDe = (horaIndex) => ((horaIndex % 24) + 24) % 24;

/** Fases originales de Hora_rol.js. */
function faseDe(horaDelDia) {
    if (horaDelDia >= 19) return "Noche";
    if (horaDelDia >= 18) return "Atardecer";
    if (horaDelDia >= 12) return "Tarde";
    if (horaDelDia >= 7) return "Día";
    if (horaDelDia >= 6) return "Amanecer";
    return "Madrugada";
}

/** Carpeta de imágenes (regla original): "Noche" si hora >= 18 o <= 5, "Día" en el resto. */
const carpetaLuzDe = (horaDelDia) => (horaDelDia >= 18 || horaDelDia <= 5 ? "Noche" : "Día");

/**
 * Estación según la fecha real (UTC):
 * invierno 21 dic–19 mar | primavera 20 mar–20 jun | verano 21 jun–21 sep | otoño 22 sep–20 dic
 */
function estacionDe(fecha) {
    const d = new Date(fecha);
    const md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
    if (md >= 1221 || md <= 319) return "invierno";
    if (md <= 620) return "primavera";
    if (md <= 921) return "verano";
    return "otoño";
}

/** Todo lo que se deriva de una hora interna. */
function infoHora(reloj, horaIndex) {
    const horaDelDia = horaDelDiaDe(horaIndex);
    const fecha = fechaDeHora(reloj, horaIndex);
    return {
        horaIndex,
        dia: diaDe(horaIndex),
        horaDelDia,
        fase: faseDe(horaDelDia),
        carpeta: carpetaLuzDe(horaDelDia),
        estacion: estacionDe(fecha),
        fecha
    };
}

module.exports = {
    msPorHora, horaIndexEn, fechaDeHora, minutoEn,
    diaDe, horaDelDiaDe, faseDe, carpetaLuzDe, estacionDe, infoHora
};
