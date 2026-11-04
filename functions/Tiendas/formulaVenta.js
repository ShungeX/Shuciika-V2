// functions/Tiendas/formulaVenta.js
// Precio al que una tienda compra un objeto. Sin base de datos, para poder probarlo aparte.
//
//   p = ⌊ v_base · r · D / Dmax ⌋      r = 0.75 limpio, 0.45 contaminado      D/Dmax = 1 sin durabilidad
//
// Un solo floor al final para que el redondeo no acumule pérdida. Se calcula en enteros (r en %) para que
// errores de coma flotante como 53.999999 no resten un Lumen.

const { factorDurabilidad, durabilidadMaxima } = require("../Objetos/durabilidad")

const PORCENTAJE_LIMPIO = 75
const PORCENTAJE_CONTAMINADO = 45
const TOPE_VENTAS_DIARIO = 400

/** Valor base de venta: `valor_base`; si no hay, el precio de tienda. */
function valorBase(def) {
    const v = Number(def?.valor_base ?? def?.precio)
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}

/** En el inventario, un objeto contaminado lleva `contaminado` o (el nombre antiguo) `contaminable`. */
function estaContaminado(item) {
    return Boolean(item?.contaminado ?? item?.contaminable)
}

/** p = ⌊v_base · r · D/Dmax⌋ con números ya resueltos. */
function precioVenta(vBase, contaminado, D = 1, Dmax = 1) {
    const r = contaminado ? PORCENTAJE_CONTAMINADO : PORCENTAJE_LIMPIO
    if (!(vBase > 0) || !(Dmax > 0) || !(D > 0)) return 0
    // D puede traer decimales por el desgaste; se escala para seguir en enteros
    const D100 = Math.round(D * 100)
    return Math.floor((vBase * r * D100) / (100 * 100 * Dmax))
}

/** Precio unitario de una entrada del inventario según su definición. */
function precioVentaItem(item, def) {
    const { D, Dmax } = factorDurabilidad(item, def)
    return precioVenta(valorBase(def), estaContaminado(item), D, Dmax)
}

module.exports = {
    PORCENTAJE_LIMPIO,
    PORCENTAJE_CONTAMINADO,
    TOPE_VENTAS_DIARIO,
    valorBase,
    estaContaminado,
    precioVenta,
    precioVentaItem,
    durabilidadMaxima
}
