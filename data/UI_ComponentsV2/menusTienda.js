// data/UI_ComponentsV2/menus.js
// Menús efímeros de las tiendas (pedido, recibo y modals). Solo construyen componentes:
// los datos (precios, saldo, nombres) se leen de la base de datos en functions/Tiendas/pedidos.js en cada render.

const { ModalBuilder, LabelBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } = require("discord.js")
const { crearCustomId } = require("../../utils/constructores/customId")
const { EMOJI_LUMENS, FRASES_ESTANTERIA_VACIA } = require("../../functions/mensajesServidor")

// Miniatura del encabezado cuando la tienda no tiene imágenes propias
const IMAGEN_PEDIDO_DEFECTO = "https://i.pinimg.com/736x/a8/16/66/a816664863eed683d84f5fd7c1168708.jpg"

const alAzar = (lista) => lista[Math.floor(Math.random() * lista.length)]

function boton(customId, label, style, disabled = false) {
    return { type: 2, custom_id: customId, label, style, disabled }
}

/** La imagen que se ve en el panel de la tienda, para que el pedido se sienta del mismo lugar. */
function imagenDeTienda(tienda) {
    const imagenes = tienda?.tienda?.imagenes || []
    const enPanel = tienda?.ultimaPublicacion?.eleccion?.imagen
    return imagenes[enPanel] || imagenes[0] || IMAGEN_PEDIDO_DEFECTO
}

/** Encabezado: título del lugar con la miniatura a la derecha. */
function encabezado(tienda, titulo, subtitulo) {
    return {
        type: 9,
        components: [
            { type: 10, content: `# ˗ˏˋ ${titulo} ⟡ ${tienda.nombre}  ๋࣭ ⭑` },
            { type: 10, content: subtitulo }
        ],
        accessory: { type: 11, media: { url: imagenDeTienda(tienda) } }
    }
}

// El espacio final esquiva el bug de "-#" dentro de una lista en Discord Canary (Windows)
const lineaObjeto = (l) => `- -# ${l.nombre} x ${l.cantidad} ── .✦ ${l.subtotal} ${EMOJI_LUMENS} `

const separador = { type: 14, divider: true, spacing: 1 }

/**
 * El pedido abierto de un usuario en una tienda.
 * @param {Object} p
 * @param {Object} p.tienda - Documento de mensajes_servidor (nombre, tienda.imagenes, accent_color...)
 * @param {Array<{ nombre: string, cantidad: number, subtotal: number }>} p.lineas
 * @param {number} p.saldo
 * @param {number} p.total
 * @param {boolean} p.hayEstanteria - false si la tienda no tiene nada a la venta
 * @param {string[]} [p.avisos] - Mensajes cortos (límites, precios que cambiaron...)
 * @param {{ userId: string, characterId: string|number }} p.ids
 * @param {boolean} [p.bloqueado] - Todos los botones desactivados (mientras se cobra)
 */
function pedidoTienda({ tienda, lineas, saldo, total, hayEstanteria = true, avisos = [], ids, bloqueado = false }) {
    const idBoton = (op, ...extra) => crearCustomId({ action: "tienda_pedido", userId: ids.userId, characterId: ids.characterId, extras: [tienda._id, op, ...extra] })
    const vacio = lineas.length === 0
    const alcanza = saldo >= total

    let listado
    if (!vacio) listado = lineas.map(lineaObjeto).join("\n")
    else if (!hayEstanteria) listado = `-# ${alAzar(FRASES_ESTANTERIA_VACIA)}`
    else listado = "-# Tu pedido está vacío. Agrega algo de la estantería ♡( ◡‿◡ )"

    const resumen = alcanza
        ? `-# Total: **${total}** ${EMOJI_LUMENS}  ── .✦ te quedarían **${saldo - total}** ${EMOJI_LUMENS}`
        : `-# Total: **${total}** ${EMOJI_LUMENS}  ── .✦ te faltan **${total - saldo}** ${EMOJI_LUMENS}`

    const hijos = [
        encabezado(tienda, "Tu pedido", `-# Tus lumens: ${saldo} ${EMOJI_LUMENS}`),
        separador,
        {
            type: 9,
            components: [{ type: 10, content: listado }],
            accessory: boton(idBoton("agregar"), "Agregar al pedido ▾", 2, bloqueado || !hayEstanteria)
        },
        separador,
        { type: 10, content: avisos.length ? `${resumen}\n${avisos.map(t => `-# ⟡ ${t}`).join("\n")}` : resumen },
        separador,
        {
            type: 1,
            components: [
                // Quitar solo tiene sentido si hay algo que quitar
                boton(idBoton("quitar"), "Quitar del pedido ▾", 2, bloqueado || vacio),
                // El total mostrado viaja en el customId: si al pagar ya no coincide, se vuelve a dibujar en vez de cobrar otra cifra
                boton(idBoton("pagar", total), "Pagar pedido", 3, bloqueado || vacio || !alcanza),
                boton(idBoton("vaciar"), "Vaciar pedido", 4, bloqueado || vacio)
            ]
        }
    ]

    return [contenedor(tienda, hijos)]
}

/** El mismo mensaje convertido en recibo tras pagar. */
function reciboTienda({ tienda, lineas, total, saldoFinal, ids }) {
    const idSeguir = crearCustomId({ action: "tienda_pedido", userId: ids.userId, characterId: ids.characterId, extras: [tienda._id, "seguir"] })
    return [contenedor(tienda, [
        encabezado(tienda, "Recibo", "-# Tu pedido ya está en tu inventario ¡Gracias por pasar! (◕‿◕✿)"),
        separador,
        { type: 10, content: lineas.map(lineaObjeto).join("\n") },
        separador,
        { type: 10, content: `-# Pagado: **${total}** ${EMOJI_LUMENS}  ── .✦ te quedan **${saldoFinal}** ${EMOJI_LUMENS}` },
        separador,
        { type: 1, components: [boton(idSeguir, "Seguir comprando", 2)] }
    ])]
}

/** El pedido caducó (15 min sin tocarlo) o el bot se reinició. */
function pedidoDesvanecido({ tienda, ids }) {
    const hijos = [{ type: 10, content: "Tu pedido se desvaneció, ábrelo de nuevo ♡( ◡‿◡ )" }]
    if (tienda) {
        const idSeguir = crearCustomId({ action: "tienda_pedido", userId: ids.userId, characterId: ids.characterId, extras: [tienda._id, "seguir"] })
        hijos.push({ type: 1, components: [boton(idSeguir, "Abrir de nuevo", 2)] })
    }
    return [contenedor(tienda, hijos)]
}

/** Mensaje suelto en la voz del lugar (observar, la enfermera, tienda cerrada...). */
function mensajeLugar(tienda, texto) {
    return [contenedor(tienda, [{ type: 10, content: texto }])]
}

function contenedor(tienda, hijos) {
    const c = { type: 17, components: hijos }
    const color = tienda?.tienda?.accent_color
    if (typeof color === "number") c.accent_color = color
    return c
}

const campoCantidad = (descripcion) => {
    const label = new LabelBuilder()
        .setLabel("Cantidad")
        .setTextInputComponent(
            new TextInputBuilder().setCustomId("cantidad").setStyle(TextInputStyle.Short).setValue("1").setMinLength(1).setMaxLength(3).setRequired(true)
        )
    return descripcion ? label.setDescription(descripcion) : label
}

/**
 * Modal para agregar: un select con lo que hay en la estantería y la cantidad.
 * @param {Array<{ clave: string, Nombre: string, precio: number, Rareza?: string }>} objetos - Máximo 25 (límite de Discord)
 */
function modalAgregar({ tienda, ids, objetos }) {
    return new ModalBuilder()
        .setCustomId(crearCustomId({ action: "tienda_pedido_modal", userId: ids.userId, characterId: ids.characterId, extras: [tienda._id, "agregar"] }))
        .setTitle("Agregar al pedido")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Objeto")
                .setDescription("Lo que hay ahora en la estantería")
                .setStringSelectMenuComponent(
                    new StringSelectMenuBuilder()
                        .setCustomId("objeto")
                        .setPlaceholder("Elige un objeto...")
                        .setRequired(true)
                        .addOptions(objetos.slice(0, 25).map(o => ({
                            label: o.Nombre.slice(0, 100),
                            value: o.clave,
                            description: `${o.precio} Lumens${o.Rareza ? ` · ${o.Rareza}` : ""}`.slice(0, 100)
                        })))
                ),
            campoCantidad()
        )
}

/**
 * Modal para quitar: solo lista lo que ya está en el pedido.
 * @param {Array<{ clave: string, nombre: string, cantidad: number }>} lineas
 */
function modalQuitar({ tienda, ids, lineas }) {
    return new ModalBuilder()
        .setCustomId(crearCustomId({ action: "tienda_pedido_modal", userId: ids.userId, characterId: ids.characterId, extras: [tienda._id, "quitar"] }))
        .setTitle("Quitar del pedido")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Objeto")
                .setStringSelectMenuComponent(
                    new StringSelectMenuBuilder()
                        .setCustomId("objeto")
                        .setPlaceholder("Elige qué quitar...")
                        .setRequired(true)
                        .addOptions(lineas.slice(0, 25).map(l => ({ label: l.nombre.slice(0, 100), value: l.clave, description: `Tienes ${l.cantidad} en tu pedido` })))
                ),
            campoCantidad("Si quitas más de las que hay, se quita todo")
        )
}

module.exports = {
    pedidoTienda,
    reciboTienda,
    pedidoDesvanecido,
    mensajeLugar,
    modalAgregar,
    modalQuitar
}
