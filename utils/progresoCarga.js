// Progreso de arranque: una sola barra en lugar de un log por cada sistema cargado.
//  - En una terminal (TTY) la barra se redibuja sobre la misma línea.
//  - En un panel de hosting / archivo de logs (sin TTY) se escribe una línea corta por paso,
//    para que se vea dónde se quedó si el arranque se cuelga.
// Al terminar se imprime un único resumen con tiempos y memoria.

const ANCHO_BARRA = 20;
const ESPERA_MAXIMA_MS = 60_000; // si algún paso nunca termina, se cierra el resumen igualmente

const esTTY = Boolean(process.stdout.isTTY);
const pasos = new Map(); // nombre -> { estado: 'pendiente'|'curso'|'ok'|'fallo', ms, detalle, inicio }
let inicioGlobal = Date.now();
let activo = false;
let barraDibujada = false;
let consolaOriginal = null;
let temporizador = null;
let alTerminar = null;

function contar() {
    let hechos = 0, fallos = 0;
    for (const p of pasos.values()) {
        if (p.estado === 'ok') hechos++;
        else if (p.estado === 'fallo') { hechos++; fallos++; }
    }
    return { hechos, fallos, total: pasos.size };
}

function textoBarra() {
    const { hechos, total } = contar();
    const fraccion = total ? hechos / total : 0;
    const llenos = Math.round(fraccion * ANCHO_BARRA);
    const barra = '▰'.repeat(llenos) + '▱'.repeat(ANCHO_BARRA - llenos);
    return `${barra} ${String(Math.round(fraccion * 100)).padStart(3)}% (${hechos}/${total})`;
}

function borrarBarra() {
    if (esTTY && barraDibujada) {
        process.stdout.write('\r\x1b[2K');
        barraDibujada = false;
    }
}

function dibujar() {
    if (!activo || !esTTY) return;
    const enCurso = [...pasos].filter(([, p]) => p.estado === 'curso').map(([n]) => n);
    const cola = enCurso.length ? ` · ${enCurso.join(', ')}…` : '';
    const ancho = process.stdout.columns || 100;
    const linea = `\x1b[35mNavi\x1b[0m ${textoBarra()}${cola}`;
    // Sin saltos de línea: si no cabe, se recorta para que \r siga volviendo al inicio
    const visible = linea.length > ancho + 9 ? linea.slice(0, ancho + 8) : linea;
    process.stdout.write('\r\x1b[2K' + visible);
    barraDibujada = true;
}

// Mientras la barra está en pantalla, cualquier console.* la borra antes de escribir y la repone después
function interceptarConsola() {
    if (!esTTY || consolaOriginal) return;
    consolaOriginal = {};
    for (const metodo of ['log', 'info', 'warn', 'error']) {
        const original = console[metodo];
        consolaOriginal[metodo] = original;
        console[metodo] = function (...args) {
            borrarBarra();
            original.apply(console, args);
            dibujar();
        };
    }
}

function restaurarConsola() {
    if (!consolaOriginal) return;
    for (const metodo of Object.keys(consolaOriginal)) console[metodo] = consolaOriginal[metodo];
    consolaOriginal = null;
}

function segundos(ms) {
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

/**
 * Declara los pasos del arranque y muestra la barra en 0%.
 * @param {string[]} nombres
 * @param {{ alTerminar?: () => string }} [opciones] alTerminar devuelve un texto extra para el resumen (p. ej. la versión)
 */
function iniciar(nombres, opciones = {}) {
    inicioGlobal = Date.now();
    pasos.clear();
    for (const n of nombres) pasos.set(n, { estado: 'pendiente', ms: 0, detalle: '', inicio: 0 });
    alTerminar = opciones.alTerminar || null;
    activo = true;
    interceptarConsola();
    dibujar();
    temporizador = setTimeout(() => finalizar(), ESPERA_MAXIMA_MS);
    temporizador.unref?.();
}

function comenzar(nombre) {
    const p = pasos.get(nombre);
    if (!p || p.estado !== 'pendiente') return;
    p.estado = 'curso';
    p.inicio = Date.now();
    dibujar();
}

function cerrarPaso(nombre, estado, detalle) {
    const p = pasos.get(nombre);
    if (!p || p.estado === 'ok' || p.estado === 'fallo') return;
    p.ms = Date.now() - (p.inicio || inicioGlobal);
    p.estado = estado;
    p.detalle = detalle ? String(detalle) : '';
    if (!activo) return;

    if (esTTY) {
        dibujar();
    } else {
        const marca = estado === 'ok' ? '✓' : '✗';
        const extra = p.detalle ? ` — ${p.detalle}` : '';
        console.log(`[Carga] ${textoBarra()} ${marca} ${nombre} (${segundos(p.ms)})${extra}`);
    }

    const { hechos, total } = contar();
    if (hechos === total) finalizar();
}

/** Marca un paso como completado. `detalle` es opcional (p. ej. "4 regiones"). */
function paso(nombre, detalle) {
    cerrarPaso(nombre, 'ok', detalle);
}

/** Marca un paso como fallido; el error se muestra en el resumen final. */
function fallo(nombre, error) {
    cerrarPaso(nombre, 'fallo', error?.message || error || 'error');
}

/**
 * Ejecuta `fn` como un paso: lo marca en curso, y al terminar lo marca hecho o fallido.
 * Si `fn` devuelve un texto o un número se usa como detalle. El error se relanza.
 */
async function medir(nombre, fn) {
    comenzar(nombre);
    try {
        const resultado = await fn();
        paso(nombre, typeof resultado === 'string' || typeof resultado === 'number' ? resultado : '');
        return resultado;
    } catch (error) {
        fallo(nombre, error);
        throw error;
    }
}

function finalizar() {
    if (!activo) return;
    activo = false;
    clearTimeout(temporizador);
    borrarBarra();
    restaurarConsola();

    const { hechos, fallos, total } = contar();
    const memoria = process.memoryUsage();
    const rss = (memoria.rss / 1048576).toFixed(0);
    const heap = (memoria.heapUsed / 1048576).toFixed(0);
    const tiempos = [...pasos]
        .filter(([, p]) => p.estado === 'ok')
        .map(([n, p]) => `${n} ${segundos(p.ms)}${p.detalle ? ` (${p.detalle})` : ''}`)
        .join(' · ');
    const fallidos = [...pasos].filter(([, p]) => p.estado === 'fallo');
    const pendientes = [...pasos].filter(([, p]) => p.estado === 'pendiente' || p.estado === 'curso').map(([n]) => n);
    const extra = alTerminar ? ` ${alTerminar()}` : '';
    const todoBien = !fallos && !pendientes.length;

    console.log(
        `${todoBien ? '✅' : '⚠️'} Navi${extra} ${todoBien ? 'lista' : 'arrancó con problemas'} en ${segundos(process.uptime() * 1000)}` +
        ` — ${hechos - fallos}/${total} sistemas · RAM ${rss} MB (heap ${heap} MB)`
    );
    if (tiempos) console.log(`   ${tiempos}`);
    for (const [n, p] of fallidos) console.error(`   ✗ ${n}: ${p.detalle}`);
    if (pendientes.length) console.warn(`   … sin terminar: ${pendientes.join(', ')}`);
}

module.exports = { iniciar, comenzar, paso, fallo, medir, finalizar };
