// ─────────────────────────────────────────────────────────────────────────────
// ÚNICO punto que lee los campos del esquema de ítems (Objetos_globales) para el
// sistema de regalos. Si el esquema cambia, solo se toca aquí.
//
// Campos confirmados en la base (nov 2026): precio, valor_base, Rareza,
// atributos.peso, atributos.capacidad (opcional), efectos, evento_origen,
// intercambiable, restricciones.
// ─────────────────────────────────────────────────────────────────────────────
// catalogoObjetos se pide al usarse: así leerItem/valorRegalo se pueden cargar
// fuera del bot (scripts/calibrarRegalos.js) sin arrancar Server.js
const catalogo = () => require("../catalogoObjetos")
// Misma regla que las tiendas para saber si algo sigue contaminado
const { estaContaminado } = require("../Tiendas/formulaVenta")

const numero = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v))

/** Definición del catálogo para una entrada de inventario ({ ID, Region }). */
function definicionDe(entrada) {
    if (!entrada) return null
    return catalogo().getObjetoPorId(entrada.Region ?? entrada.region, entrada.ID ?? entrada.itemId ?? entrada.id)
}

/**
 * Normaliza una definición del catálogo a lo que el sistema de regalos necesita.
 * @param {Object} def - Objeto de Objetos_globales
 * @returns {{
 *   id: number, region: string, clave: string, nombre: string,
 *   precio: number|null, rareza: string|null, peso: number,
 *   capacidad: number|null, bonusPasivo: number|null, evento: number,
 *   valorRegalo: number|null, regalable: boolean
 * }|null}
 */
function leerItem(def) {
    if (!def) return null

    // Precio de tienda; si no hay, el valor base de venta. <= 0 cuenta como "sin precio"
    // (no se penaliza: el factor se excluye y los pesos se renormalizan).
    const precioCrudo = numero(def.precio) ?? numero(def.valor_base)
    const precio = precioCrudo && precioCrudo > 0 ? precioCrudo : null

    // Rarezas reales hoy: "Común" / "Comun", "Luminoso", "Resonante", "Arcano", "Divino", "NIX".
    const rareza = def.Rareza ? String(def.Rareza).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() : null

    // TODO(decisión): ¿qué campo marca el "bonus pasivo"? Hoy: propiedad opcional
    // `bonusPasivo` ("ninguno" | "menor" | "notable"); si no está, un ítem sin
    // efectos cuenta como "ninguno" y uno con efectos se excluye del cálculo
    // (no sabemos si su efecto es menor o notable).
    let bonusPasivo
    if (def.bonusPasivo === "notable") bonusPasivo = 1
    else if (def.bonusPasivo === "menor") bonusPasivo = 0.5
    else if (def.bonusPasivo === "ninguno") bonusPasivo = 0
    else bonusPasivo = (Array.isArray(def.efectos) && def.efectos.length) ? null : 0

    // TODO(decisión): ¿evento_origen marca un ítem de evento LIMITADO? Hoy sí:
    // cualquier valor no nulo cuenta como 1. El multiplicador global por evento
    // activo (p. ej. Noche de Selenitas) es otra cosa y no está implementado.
    const evento = def.evento_origen ? 1 : 0

    const valorRegalo = numero(def.valorRegalo)

    return {
        id: Number(def.ID),
        region: String(def.Region || ""),
        clave: `${def.Region}:${Number(def.ID)}`,
        nombre: String(def.Nombre || `Objeto ${def.ID}`),
        precio,
        rareza,
        peso: Math.max(0, numero(def.atributos?.peso) ?? 0),
        capacidad: numero(def.atributos?.capacidad),
        bonusPasivo,
        evento,
        valorRegalo: valorRegalo === null ? null : Math.max(0, Math.min(100, valorRegalo)),
        // `regalable` es nuevo (default true). `intercambiable: false` también lo impide:
        // es el flag que ya usaban los regalos y el comercio.
        regalable: def.regalable !== false && def.intercambiable !== false,
    }
}

/**
 * ¿Esta ENTRADA del inventario se puede meter en un regalo?
 * Las instancias únicas (instanciaID: bolsas, crafteos) y lo contaminado no.
 */
function entradaRegalable(entrada, def = definicionDe(entrada)) {
    if (!entrada || !def) return false
    if (entrada.instanciaID) return false
    if (entrada.Metadata?.restricciones?.intercambiable === false) return false
    if (entrada.Metadata?.restricciones?.isRegalo) return false
    // TODO(decisión): ¿lo contaminado (sin purificar) puede regalarse? Hoy no: el
    // diseño habla del inventario liminal "ya purificado".
    if (estaContaminado(entrada)) return false
    const info = leerItem(def)
    return Boolean(info?.regalable)
}

module.exports = { leerItem, definicionDe, entradaRegalable }
