// data/UI_ComponentsV2/menuRegalo.js
// UI del sistema de regalos (Components V2, siempre efímera).
// `regalo` y `vistaPreviaRegalo` son las PLANTILLAS de diseño: los constructores
// de abajo las clonan y rellenan por índice, sin cambiar su estructura. Si se
// reordena una plantilla, actualizar los índices en construirEditor / construirVistaPrevia.
// Solo construyen componentes: los datos llegan ya leídos de functions/Regalos.

const { ModalBuilder, LabelBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } = require("discord.js")
const { crearCustomId } = require("../../utils/constructores/customId")
const cfg = require("../../config/regalos")
const { FIRMA } = require("../../config/mensajesRegalos")

const regalo = [
    {
        "type": 17,
        "accent_color": null,
        "spoiler": false,
        "components": [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": "",
                        "proxy_url": ""
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": "# Preparando regalo\n-# Contenedor seleccionado: [Nombre del item contenedor]\n-# Capacidad [🪨....] 0/0\n\n-# Sin nota"
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Cerrar regalo",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "633eb37069584823cf778485da1b8a33"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "### Contenido del regalo\n-# Mostrar solo 10 elementos y su cantidad"
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Borrar regalo",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "d01b0315fc00478ea521eb7bc7d16a48"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "### Tu inventario\n-# Mostrar solo 10 elementos y su cantidad"
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 1,
                "components": [
                    {
                        "type": 3,
                        "custom_id": "bb90bfe71f264ebc8347f4b7a483c841",
                        "options": [
                            {
                                "label": "Agregar objetos",
                                "value": "d2fb62f3ab1646ce84f152c84fc2c501",
                                "description": null,
                                "emoji": null,
                                "default": false
                            },
                            {
                                "label": "Retirar objetos",
                                "value": "a273558346214474d5054d038f4b9364",
                                "description": null,
                                "emoji": null,
                                "default": false
                            },
                            {
                                "label": "Agregar Banner",
                                "value": "8b5a1627f0f14398bb5cd940e919ad81",
                                "description": null,
                                "emoji": null,
                                "default": false
                            },
                            {
                                "label": "Agregar nota",
                                "value": "41eace5b6528462bf8467e0d0989b1bd",
                                "description": null,
                                "emoji": null,
                                "default": false
                            }
                        ],
                        "placeholder": "Selecciona una opción...",
                        "min_values": 1,
                        "max_values": 1,
                        "disabled": false
                    }
                ]
            },
            {
                "type": 10,
                "content": "-# Una vez cerrado el regalo no sera posible editarlo\n-# Si deshaces este mensaje, el contenido del regalo se guardara. puedes seguirlo editando, volviendo a seleccionar este item"
            }
        ]
    }
]

const vistaPreviaRegalo = [
    {
        "type": 17,
        "accent_color": null,
        "spoiler": false,
        "components": [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": "https://i.pinimg.com/736x/62/85/91/628591224ca36e8142ad5c1ef724f04a.jpg",
                        "proxy_url": "https://i.pinimg.com/736x/62/85/91/628591224ca36e8142ad5c1ef724f04a.jpg"
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": "# Titulo de regalo\n-# *`Para:`* [nombre del personaje]\n-# *`De:`* [Nombre del autor personaje]\n\n-# Aqui va la nota, si no la tiene agregada, simplemente omitela, si el titulo tambien esta vacio pon \"Regalo de [Autor]\"\n-# La miniatura es la foto del perfil del que envia el regalo."
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 10,
                "content": "### Contenido del regalo\n-# Mostrar 15 elementos y sus botones correspondientes para desplazarse"
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 12,
                "items": [
                    {
                        "media": {
                            "url": "https://i.pinimg.com/1200x/82/77/4a/82774a609d8eb2f0b0369e7abec4d338.jpg",
                            "proxy_url": "https://i.pinimg.com/1200x/82/77/4a/82774a609d8eb2f0b0369e7abec4d338.jpg"
                        },
                        "description": null,
                        "spoiler": false
                    }
                ]
            }
        ]
    }
]

// ─── Utilidades ──────────────────────────────────────────────────────────────
const EMOJI_LUMENS = "<a:Lumens:1335709991130103910>"
const MINIATURA_SIN_AVATAR = "https://res.cloudinary.com/dn1cubayf/image/upload/v1727127018/Resources/unknowncharacter.png"
const alAzar = (lista) => lista[Math.floor(Math.random() * lista.length)]
const clonar = (x) => JSON.parse(JSON.stringify(x))
const separador = () => ({ type: 14, divider: true, spacing: 1 })
const textoV2 = (content) => ({ type: 10, content })
const boton = (custom_id, label, style = 2, disabled = false, emoji = null) => ({ type: 2, custom_id, label, style, disabled, ...(emoji ? { emoji: { name: emoji } } : {}) })
const fila = (...componentes) => ({ type: 1, components: componentes })
const media = (url) => ({ url })
// El espacio final esquiva el bug de "-#" dentro de una lista en Discord (Windows)
const lineaItem = (nombre, cantidad) => `- -# ${nombre} x${cantidad} `

/** Permite mostrar notas sin que nada se convierta en mención. */
const SIN_MENCIONES = { parse: [] }

function barraCapacidad(peso, capacidad) {
    const largo = 10
    const llenos = capacidad > 0 ? Math.min(largo, Math.round((peso / capacidad) * largo)) : largo
    return `\`[${"🪨".repeat(llenos)}${".".repeat(largo - llenos)}]\` ${peso}/${capacidad}`
}

function listaRecortada(items, max, vacio) {
    if (!items.length) return `-# ${vacio}`
    const lineas = items.slice(0, max).map(i => lineaItem(i.nombre, i.cantidad))
    if (items.length > max) lineas.push(`-# …y ${items.length - max} más`)
    return lineas.join("\n")
}

// custom_ids (characterId vacío: manejarComponente resuelve el personaje activo)
const idEditor = (accion, userId, token, ...extras) => crearCustomId({ action: accion, userId, extras: [token, ...extras] })

// ─── Editor ──────────────────────────────────────────────────────────────────
/**
 * @param {Object} p
 * @param {string} p.userId
 * @param {string} p.token
 * @param {Object} p.bolsa         Entrada del inventario (instancia "armando")
 * @param {string} p.nombreBolsa
 * @param {Array<{nombre, cantidad}>} p.contenido
 * @param {{ lista: string, resumen: Object, navegacion: Object, filtro: Object, itemsPagina: Object[] }} p.inventarioUI
 *        Selector de /rol inventario reutilizado (ver pantallas.inventarioEditor)
 * @param {number} p.peso
 * @param {number} p.capacidad
 * @param {string} [p.aviso]        Línea de aviso arriba (errores o confirmaciones)
 */
function construirEditor({ userId, token, bolsa, nombreBolsa, contenido, inventarioUI, peso, capacidad, aviso }) {
    const datos = bolsa.Metadata.regalo
    const ui = clonar(regalo)
    const cont = ui[0]
    cont.accent_color = datos.color ?? null

    const [cabecera, , seccionContenido, , seccionInventario, , filaMenu, pie] = cont.components

    cabecera.accessory.media = media(alAzar(cfg.MINIATURAS_EDITOR))
    const lineas = [
        "# Preparando regalo",
        `-# Contenedor seleccionado: **${nombreBolsa}**`,
        `-# Capacidad ${barraCapacidad(peso, capacidad)}`,
    ]
    if (datos.lumens > 0) lineas.push(`-# Lumens dentro: **${datos.lumens}** ${EMOJI_LUMENS}`)
    if (datos.banner) lineas.push("-# 🖼️ Con banner")
    lineas.push("")
    if (datos.titulo) lineas.push(`-# **${datos.titulo}**`)
    lineas.push(datos.nota ? `-# 📝 *${datos.nota}*` : "-# Sin nota")
    if (aviso) lineas.push("", `> ${aviso}`)
    cabecera.components[0].content = lineas.join("\n")

    seccionContenido.accessory = boton(idEditor("regaloBtn", userId, token, "cerrar"), "Cerrar regalo", 2, !contenido.length && !(datos.lumens > 0))
    seccionContenido.components[0].content = `### Contenido del regalo\n${listaRecortada(contenido, cfg.LISTA_EDITOR, "Todavía está vacío")}`

    seccionInventario.accessory = boton(idEditor("regaloBtn", userId, token, "borrar"), "Borrar regalo", 4)
    seccionInventario.components[0].content = `### Tu inventario\n${inventarioUI.lista}`
    // El selector de /rol inventario (resumen, < Saltar pag. >, filtro) justo debajo de la lista
    const idx = cont.components.indexOf(seccionInventario)
    cont.components.splice(idx + 1, 0, inventarioUI.resumen, inventarioUI.navegacion, inventarioUI.filtro)

    // Opciones: Banner y Color solo si la bolsa lo permite
    const opciones = [
        { label: "Agregar objetos", value: "agregar", emoji: { name: "➕" }, description: "De la página de inventario que estás viendo" },
        ...(contenido.length ? [{ label: "Retirar objetos", value: "retirar", emoji: { name: "➖" }, description: "Devuelve objetos a tu inventario" }] : []),
        ...(cfg.permiteBanner(bolsa) ? [{ label: "Agregar Banner", value: "banner", emoji: { name: "🖼️" }, description: "Una imagen grande al final" }] : []),
        ...(cfg.permiteColor(bolsa) ? [{ label: "Cambiar color", value: "color", emoji: { name: "🎨" }, description: "Color del contenedor" }] : []),
        { label: "Agregar nota", value: "nota", emoji: { name: "📝" }, description: `Título y nota (máx. ${cfg.NOTA_MAX} caracteres)` },
        { label: "Agregar Lumens", value: "lumens", emoji: { name: "✨" }, description: `Hasta ${cfg.LUMENS_MAX_POR_REGALO} por regalo` },
        { label: "Vista previa", value: "preview", emoji: { name: "👀" }, description: "Así lo verá quien lo reciba" },
    ]
    filaMenu.components[0] = {
        ...filaMenu.components[0],
        custom_id: idEditor("regaloMenu", userId, token),
        options: opciones,
    }
    pie.content = "-# Una vez cerrado el regalo no será posible editarlo\n-# Si deshaces este mensaje, el contenido del regalo se guardará. Puedes seguir editándolo volviendo a seleccionar este item"
    return ui
}

/** Selector de color (solo bolsas en BOLSAS_CON_COLOR). */
function construirSelectorColor({ userId, token, actual }) {
    return [{
        type: 17,
        accent_color: actual ?? null,
        components: [
            textoV2("### 🎨 Elige el color del regalo"),
            fila({
                type: 3,
                custom_id: idEditor("regaloColor", userId, token),
                placeholder: "Selecciona un color...",
                min_values: 1, max_values: 1,
                options: [
                    ...cfg.COLORES.map(col => ({ label: col.nombre, value: String(col.hex), emoji: { name: col.emoji }, default: col.hex === actual })),
                    { label: "Sin color", value: "ninguno", emoji: { name: "🤍" }, default: actual === null || actual === undefined },
                ],
            }),
            fila(boton(idEditor("regaloBtn", userId, token, "volver"), "Volver al regalo", 2, false, "↩️")),
        ],
    }]
}

/** Confirmación de Cerrar / Borrar. */
function construirConfirmacion({ userId, token, accion }) {
    const cerrar = accion === "cerrar"
    return [{
        type: 17,
        accent_color: null,
        components: [
            textoV2(cerrar
                ? `### ¿Cerramos el regalo?\n-# Ya no podrás editarlo. Quedará en tu inventario listo para enviarlo con \`/rol regalar\` ${FIRMA}`
                : "### ¿Seguro que quieres deshacer el regalo?\n-# Todo lo que tiene vuelve a tu inventario, la bolsa también."),
            fila(
                boton(idEditor("regaloBtn", userId, token, cerrar ? "cerrarOk" : "borrarOk"), cerrar ? "Sí, cerrarlo" : "Sí, deshacerlo", cerrar ? 3 : 4),
                boton(idEditor("regaloBtn", userId, token, "volver"), "Volver", 2),
            ),
        ],
    }]
}

/** Mensaje final (regalo cerrado, borrado, abierto...). */
function construirAviso({ titulo, lineas = [], color = null, miniatura = null }) {
    const cuerpo = [`### ${titulo}`, ...lineas].join("\n")
    const cabecera = miniatura
        ? { type: 9, components: [textoV2(cuerpo)], accessory: { type: 11, media: media(miniatura) } }
        : textoV2(cuerpo)
    return [{ type: 17, accent_color: color, components: [cabecera] }]
}

// ─── Vista previa / detalle de un regalo ─────────────────────────────────────
/**
 * @param {Object} p
 * @param {string} p.de                 Nombre del remitente
 * @param {string|null} p.para          Nombre del destinatario (null = aún sin elegir)
 * @param {string|null} p.avatarDe      Foto de perfil del remitente (miniatura)
 * @param {string} [p.titulo]
 * @param {string} [p.nota]             Omitida si está vacía
 * @param {Array<{nombre, cantidad}>} p.items
 * @param {number} [p.lumens]
 * @param {string|null} [p.banner]
 * @param {number|null} [p.color]
 * @param {boolean} [p.ocultarContenido] Regalo sin abrir: no se revela lo de dentro
 * @param {string[]} [p.lineasExtra]     Debajo del contenido (etiqueta, amistad...)
 * @param {number} [p.pagina]
 * @param {(pagina:number)=>string} [p.idPagina]  custom_id de los botones de página
 * @param {Object[]} [p.botones]         Fila final de botones
 */
function construirVistaPrevia(p) {
    const ui = clonar(vistaPreviaRegalo)
    const cont = ui[0]
    cont.accent_color = p.color ?? null
    const [cabecera, sep1, bloqueContenido, sep2, galeria] = cont.components

    cabecera.accessory.media = media(p.avatarDe || MINIATURA_SIN_AVATAR)
    const encabezado = [
        `# ${p.titulo || `Regalo de ${p.de}`}`,
        `-# *\`Para:\`* ${p.para || "(lo eliges al enviarlo)"}`,
        `-# *\`De:\`* ${p.de}`,
    ]
    if (p.nota) encabezado.push("", `-# ${p.nota}`)
    cabecera.components[0].content = encabezado.join("\n")

    const pilas = [...(p.items || [])]
    if (p.lumens > 0) pilas.push({ nombre: `Lumens ${EMOJI_LUMENS}`, cantidad: p.lumens })
    const porPagina = cfg.LISTA_VISTA_PREVIA
    const paginas = Math.max(1, Math.ceil(pilas.length / porPagina))
    const pagina = Math.max(0, Math.min(p.pagina || 0, paginas - 1))

    let contenido
    if (p.ocultarContenido) {
        contenido = `### Contenido del regalo\n-# ¿Qué habrá dentro? 🎀 (${pilas.length} ${pilas.length === 1 ? "cosa" : "cosas"})`
    } else {
        const visibles = pilas.slice(pagina * porPagina, (pagina + 1) * porPagina)
        contenido = `### Contenido del regalo${paginas > 1 ? ` · ${pagina + 1}/${paginas}` : ""}\n` +
            (visibles.length ? visibles.map(i => lineaItem(i.nombre, i.cantidad)).join("\n") : "-# Vacío")
    }
    if (p.lineasExtra?.length) contenido += `\n\n${p.lineasExtra.filter(Boolean).join("\n")}`
    bloqueContenido.content = contenido

    const componentes = [cabecera, sep1, bloqueContenido]
    if (p.banner) {
        galeria.items = [{ media: media(p.banner), description: null, spoiler: false }]
        componentes.push(sep2, galeria)
    }

    const filaFinal = [...(p.botones || [])]
    if (!p.ocultarContenido && paginas > 1 && p.idPagina) {
        filaFinal.unshift(
            boton(p.idPagina(pagina - 1), "◀", 2, pagina === 0),
            boton(p.idPagina(pagina + 1), "▶", 2, pagina >= paginas - 1),
        )
    }
    if (filaFinal.length) componentes.push(fila(...filaFinal.slice(0, 5)))
    cont.components = componentes
    return ui
}

// ─── Buzón ───────────────────────────────────────────────────────────────────
function construirDetalleBuzon({ userId, regalo: r, avatarDe, pagina = 0, lineasExtra = [] }) {
    const id = (...extras) => crearCustomId({ action: "regaloBz", userId, extras })
    const pendiente = r.estado === "pendiente"
    const notaOculta = r.reporte?.notaOculta
    const botones = []
    if (pendiente) botones.push(boton(id("abrir", String(r._id)), "Abrir", 3, false, "🎁"))
    if (!r.reporte && ["pendiente", "abierto"].includes(r.estado)) botones.push(boton(id("reportar", String(r._id)), "Reportar", 2, false, "🚩"))
    botones.push(boton(crearCustomId({ action: "buzonBtn", userId, extras: ["lista", "nuevos", "todos", 0] }), "Volver al buzón", 2, false, "↩️"))

    const extra = [...lineasExtra]
    if (r.estado === "reportado") extra.push("-# 🔒 Este regalo está guardadito mientras revisan el reporte.")
    if (r.estado === "abierto" && r.valor?.etiqueta) extra.unshift(`-# *${r.valor.etiqueta}*`)

    return construirVistaPrevia({
        de: r.deNombre,
        para: r.paraNombre,
        avatarDe,
        titulo: r.envoltura?.titulo,
        nota: notaOculta ? "*(nota oculta tras tu reporte)*" : r.envoltura?.nota,
        items: (r.contenido?.items || []).map(i => ({ nombre: i.nombre, cantidad: i.cantidad })),
        lumens: r.contenido?.lumens || 0,
        banner: notaOculta ? null : r.envoltura?.banner,
        color: r.envoltura?.color ?? null,
        ocultarContenido: r.estado !== "abierto",
        lineasExtra: extra,
        pagina,
        idPagina: (pag) => id("verpag", String(r._id), pag),
        botones,
    })
}

// ─── Modals ──────────────────────────────────────────────────────────────────
/**
 * Modal de agregar/retirar: un select con los objetos y la cantidad, igual que
 * "Agregar al pedido" de las tiendas.
 * @param {{ userId, token, modo: "agregar"|"retirar", opciones: Array<{ clave, nombre, cantidad, peso? }> }} p
 */
function modalObjeto({ userId, token, modo, opciones }) {
    const agregar = modo === "agregar"
    return new ModalBuilder()
        .setCustomId(idEditor("regaloModal", userId, token, modo))
        .setTitle(agregar ? "Meter en el regalo" : "Sacar del regalo")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Objeto")
                .setDescription(agregar ? "Lo que se puede regalar en la página que estás viendo" : "Lo que lleva el regalo")
                .setStringSelectMenuComponent(
                    new StringSelectMenuBuilder()
                        .setCustomId("objeto")
                        .setPlaceholder("Elige un objeto...")
                        .setRequired(true)
                        .addOptions(opciones.slice(0, 25).map(o => ({
                            label: String(o.nombre).slice(0, 100),
                            value: o.clave,
                            description: (agregar
                                ? `Tienes ${o.cantidad}${o.peso !== undefined ? ` · peso ${o.peso} c/u` : ""}`
                                : `En el regalo: ${o.cantidad}`).slice(0, 100),
                        })))
                ),
            new LabelBuilder()
                .setLabel("Cantidad")
                .setDescription(agregar ? `Máximo ${cfg.CANTIDAD_MAX_PILA} por objeto` : "Si sacas más de las que hay, se saca todo")
                .setTextInputComponent(
                    new TextInputBuilder().setCustomId("cantidad").setStyle(TextInputStyle.Short)
                        .setValue("1").setMinLength(1).setMaxLength(3).setRequired(true)
                )
        )
}

/** "Saltar pag." del inventario del editor. */
function modalSalto({ userId, token, action = "regaloInvSalto", extras = [] }) {
    return new ModalBuilder()
        .setCustomId(idEditor(action, userId, token, ...extras))
        .setTitle("Saltar a página")
        .addLabelComponents(
            new LabelBuilder().setLabel("Número de página").setTextInputComponent(
                new TextInputBuilder().setCustomId("pagina").setStyle(TextInputStyle.Short)
                    .setPlaceholder("Introduce el número de página...").setMinLength(1).setMaxLength(3).setRequired(true)
            )
        )
}

function modalNota({ userId, token, titulo = "", nota = "" }) {
    const tituloInput = new TextInputBuilder().setCustomId("titulo").setStyle(TextInputStyle.Short)
        .setMaxLength(cfg.TITULO_MAX).setRequired(false).setPlaceholder(`Regalo de...`)
    const notaInput = new TextInputBuilder().setCustomId("nota").setStyle(TextInputStyle.Paragraph)
        .setMaxLength(cfg.NOTA_MAX).setRequired(false).setPlaceholder("Sin menciones ni enlaces de Discord ♡")
    if (titulo) tituloInput.setValue(titulo.replace(/@​/g, "@"))
    if (nota) notaInput.setValue(nota.replace(/@​/g, "@"))
    return new ModalBuilder()
        .setCustomId(idEditor("regaloModal", userId, token, "nota"))
        .setTitle("Nota del regalo")
        .addLabelComponents(
            new LabelBuilder().setLabel("Título (opcional)").setTextInputComponent(tituloInput),
            new LabelBuilder().setLabel("Nota (opcional)").setDescription(`Máx. ${cfg.NOTA_MAX} caracteres. Déjala vacía para quitarla.`).setTextInputComponent(notaInput),
        )
}

function modalBanner({ userId, token, actual = "" }) {
    const input = new TextInputBuilder().setCustomId("banner").setStyle(TextInputStyle.Short)
        .setRequired(false).setMaxLength(400).setPlaceholder("https://...png / jpg / gif / webp")
    if (actual) input.setValue(actual)
    return new ModalBuilder()
        .setCustomId(idEditor("regaloModal", userId, token, "banner"))
        .setTitle("Banner del regalo")
        .addLabelComponents(new LabelBuilder().setLabel("Enlace de la imagen").setDescription("Déjalo vacío para quitarlo").setTextInputComponent(input))
}

function modalLumens({ userId, token, actual = 0 }) {
    return new ModalBuilder()
        .setCustomId(idEditor("regaloModal", userId, token, "lumens"))
        .setTitle("Lumens del regalo")
        .addLabelComponents(
            new LabelBuilder().setLabel("¿Cuántos Lumens lleva en total?")
                .setDescription(`0 para quitarlos · máximo ${cfg.LUMENS_MAX_POR_REGALO}. Se apartan de tu saldo mientras tanto.`)
                .setTextInputComponent(new TextInputBuilder().setCustomId("lumens").setStyle(TextInputStyle.Short)
                    .setValue(String(actual || 0)).setMinLength(1).setMaxLength(5).setRequired(true))
        )
}

function modalReporte({ userId, regaloId }) {
    return new ModalBuilder()
        .setCustomId(crearCustomId({ action: "regaloReporte", userId, extras: [regaloId] }))
        .setTitle("Reportar regalo")
        .addLabelComponents(
            new LabelBuilder().setLabel("Motivo").setStringSelectMenuComponent(
                new StringSelectMenuBuilder().setCustomId("motivo").setPlaceholder("Elige un motivo...").setRequired(true)
                    .addOptions(cfg.MOTIVOS_REPORTE.map(m => ({ label: m.label, value: m.id })))
            ),
            new LabelBuilder().setLabel("¿Algo más que quieras contar? (opcional)").setTextInputComponent(
                new TextInputBuilder().setCustomId("texto").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(cfg.REPORTE_TEXTO_MAX)
            ),
        )
}


const regalarMenuSuelto = [
    {
        "type": 17,
        "accent_color": null,
        "spoiler": false,
        "components": [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": "https://i.pinimg.com/736x/a0/e6/5a/a0e65a7aa3d6f5f23e6fbf2aaa9c8f87.jpg",
                        "proxy_url": "https://i.pinimg.com/736x/a0/e6/5a/a0e65a7aa3d6f5f23e6fbf2aaa9c8f87.jpg"
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": "# ¿Enviar un regalo?"
                    },
                    {
                        "type": 10,
                        "content": "-# `Regalo seleccionado:` ninguno\n-# `Enviar a:`"
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 4,
                    "label": "Destruir regalo",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "8da8e09655984859bd057e8bc19aef34"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "### Tu inventario:"
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 1,
                "components": [
                    {
                        "type": 3,
                        "custom_id": "857220cae3b34a56d677f5a46661efa3",
                        "options": [
                            {
                                "label": "Tame Chimpanzee",
                                "value": "0259be21c5044c9bdc4972e729d7ee7a",
                                "description": null,
                                "emoji": null,
                                "default": false
                            }
                        ],
                        "placeholder": "Elige un acción...",
                        "min_values": 1,
                        "max_values": 1,
                        "disabled": false
                    }
                ]
            },
            {
                "type": 10,
                "content": "-# Enviar regalos sueltos disminuye la cantidad de puntos de amistad ganados, ademas de solo poder enviar un regalo suelto."
            }
        ]
    }
]

// ─── Menú de /rol regalar (plantilla regalarMenuSuelto) ──────────────────────
// custom_ids (token = el del menú, vive en memoria: functions/Regalos/menuRegalar.js)
//   regalarMenu-{userId}--{token}                 select de acciones
//   regalarBtn-{userId}--{token}-{accion}[-{arg}] cancelar | preview | enviar | volver | rel | prevpag
//   regalarInv-{userId}--{token}-...              selector de inventario (como /rol inventario)
//   regalarRel-{userId}--{token}-{pagina}         elegir a alguien de tus relaciones
//   regalarModal-{userId}--{token}-{modo}         elegir | lumens | destino | salto

/**
 * @param {object} p
 * @param {string} p.seleccion     Texto de lo elegido ("ninguno" si nada)
 * @param {string} p.destino       Texto del destinatario ("" si nadie)
 * @param {object} p.inventarioUI  Salida de pantallas.inventarioUI
 * @param {boolean} p.hayBolsa     Lo elegido es una bolsa (sin Lumens sueltos)
 * @param {boolean} p.haySeleccion
 */
function construirMenuRegalar({ userId, token, seleccion, destino, inventarioUI, hayBolsa, haySeleccion, aviso }) {
    const ui = clonar(regalarMenuSuelto)
    const cont = ui[0]
    const [cabecera, , seccionInventario, , filaMenu] = cont.components

    const lineas = [`-# \`Regalo seleccionado:\` ${seleccion || "ninguno"}`, `-# \`Enviar a:\` ${destino || "nadie todavía"}`]
    if (aviso) lineas.push("", `> ${aviso}`)
    cabecera.components[1].content = lineas.join("\n")

    // "Destruir regalo" cierra el menú sin enviar nada (no toca el inventario)
    seccionInventario.accessory = boton(idEditor("regalarBtn", userId, token, "cancelar"), "Destruir regalo", 4)
    seccionInventario.components[0].content = `### Tu inventario:\n${inventarioUI.lista}`
    const idx = cont.components.indexOf(seccionInventario)
    cont.components.splice(idx + 1, 0, inventarioUI.resumen, inventarioUI.navegacion, inventarioUI.filtro)

    const opciones = [
        { label: "Elegir regalo", value: "elegir", emoji: { name: "🎁" }, description: "Una bolsa cerrada o un objeto suelto de esta página" },
        ...(!hayBolsa ? [{ label: "Agregar Lumens", value: "lumens", emoji: { name: "✨" }, description: `Sueltos, hasta ${cfg.LUMENS_MAX_POR_REGALO}` }] : []),
        { label: "Enviar a (ID)", value: "destino", emoji: { name: "🔎" }, description: "Escribe la ID del personaje" },
        { label: "Elegir de mis relaciones", value: "relaciones", emoji: { name: "💞" }, description: "Tus amistades con sus puntos" },
        ...(haySeleccion ? [{ label: "Quitar selección", value: "quitar", emoji: { name: "↩️" }, description: "Vacía lo elegido (no toca tu inventario)" }] : []),
        { label: "Vista previa y enviar", value: "preview", emoji: { name: "📨" }, description: "Revisa todo antes de enviarlo" },
    ]
    filaMenu.components[0] = {
        ...filaMenu.components[0],
        custom_id: idEditor("regalarMenu", userId, token),
        placeholder: "Elige una acción...",
        options: opciones,
    }
    return ui
}

/**
 * Relaciones del personaje para elegir destinatario.
 * @param {{ userId, token, filas: { id, nombre, puntos, rango }[], pagina, paginas, total, aviso? }} p
 */
function construirRelaciones({ userId, token, filas, pagina, paginas, total, aviso }) {
    const cabecera = [
        "# 💞 ¿Para quién es?",
        total ? `-# Tus relaciones, de más cercana a menos · ${total} en total${paginas > 1 ? ` · página ${pagina + 1}/${paginas}` : ""}` : "-# Aún no tienes relaciones",
    ]
    if (aviso) cabecera.push("", `> ${aviso}`)
    const componentes = [textoV2(cabecera.join("\n")), separador()]
    if (filas.length) {
        componentes.push(textoV2(filas.map(f => `- **${f.nombre}** · ID ${f.id} · ${f.rango} · ♡ ${f.puntos}`).join("\n")))
        componentes.push(fila({
            type: 3,
            custom_id: idEditor("regalarRel", userId, token, pagina),
            placeholder: "Elige a quién regalar...",
            min_values: 1, max_values: 1,
            options: filas.map(f => ({
                label: String(f.nombre).slice(0, 100),
                value: String(f.id),
                description: `${f.rango} · ♡ ${f.puntos} puntos`.slice(0, 100),
            })),
        }))
    }
    const botones = [boton(idEditor("regalarBtn", userId, token, "volver"), "Volver", 2, false, "↩️")]
    if (paginas > 1) {
        botones.unshift(
            boton(idEditor("regalarBtn", userId, token, "rel", pagina - 1), "◀", 2, pagina === 0),
            boton(idEditor("regalarBtn", userId, token, "rel", pagina + 1), "▶", 2, pagina >= paginas - 1),
        )
    }
    componentes.push(separador(), fila(...botones))
    return [{ type: 17, accent_color: 0xF4A7C0, components: componentes }]
}

/** Elegir qué regalar: bolsas cerradas y objetos de la página que se está viendo. */
function modalElegirRegalo({ userId, token, opciones }) {
    return new ModalBuilder()
        .setCustomId(idEditor("regalarModal", userId, token, "elegir"))
        .setTitle("¿Qué vas a regalar?")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Regalo")
                .setDescription("Una bolsa cerrada o un objeto suelto de la página que estás viendo")
                .setStringSelectMenuComponent(
                    new StringSelectMenuBuilder().setCustomId("objeto").setPlaceholder("Elige...").setRequired(true)
                        .addOptions(opciones.slice(0, 25).map(o => ({
                            label: String(o.nombre).slice(0, 100),
                            value: o.valor,
                            ...(o.descripcion ? { description: String(o.descripcion).slice(0, 100) } : {}),
                            ...(o.emoji ? { emoji: { name: o.emoji } } : {}),
                        })))
                ),
            new LabelBuilder()
                .setLabel("Cantidad")
                .setDescription(`Solo para objetos sueltos (máx. ${cfg.CANTIDAD_MAX_PILA}). Las bolsas van enteras.`)
                .setTextInputComponent(
                    new TextInputBuilder().setCustomId("cantidad").setStyle(TextInputStyle.Short)
                        .setValue("1").setMinLength(1).setMaxLength(3).setRequired(true)
                )
        )
}

function modalDestino({ userId, token }) {
    return new ModalBuilder()
        .setCustomId(idEditor("regalarModal", userId, token, "destino"))
        .setTitle("¿Para quién es?")
        .addLabelComponents(
            new LabelBuilder().setLabel("ID del personaje").setDescription("La encuentras en su perfil")
                .setTextInputComponent(new TextInputBuilder().setCustomId("id").setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ej. 1234").setMinLength(1).setMaxLength(20).setRequired(true))
        )
}

function modalLumensSuelto({ userId, token, actual = 0 }) {
    return new ModalBuilder()
        .setCustomId(idEditor("regalarModal", userId, token, "lumens"))
        .setTitle("Lumens del regalo")
        .addLabelComponents(
            new LabelBuilder().setLabel("¿Cuántos Lumens?")
                .setDescription(`0 para quitarlos · máximo ${cfg.LUMENS_MAX_POR_REGALO}. Se cobran al enviarlo.`)
                .setTextInputComponent(new TextInputBuilder().setCustomId("lumens").setStyle(TextInputStyle.Short)
                    .setValue(String(actual || 0)).setMinLength(1).setMaxLength(5).setRequired(true))
        )
}

module.exports = {
    regalo,
    vistaPreviaRegalo,
    SIN_MENCIONES,
    EMOJI_LUMENS,
    boton,
    idEditor,
    construirEditor,
    construirSelectorColor,
    construirConfirmacion,
    construirAviso,
    construirVistaPrevia,
    construirDetalleBuzon,
    modalObjeto,
    modalSalto,
    modalNota,
    modalBanner,
    modalLumens,
    modalReporte,
    regalarMenuSuelto,
    construirMenuRegalar,
    construirRelaciones,
    modalElegirRegalo,
    modalDestino,
    modalLumensSuelto,
}
