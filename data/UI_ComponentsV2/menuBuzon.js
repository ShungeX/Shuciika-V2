// ─────────────────────────────────────────────────────────────────────────────
// Pantallas del buzón (/rol buzon). Components V2, siempre efímeras.
//
// custom_ids (separador "-", characterId vacío → se usa el personaje activo):
//   buzonVer-{userId}--{vista}-{tipo}-{pagina}       select: abrir una notificación (value = _id)
//   buzonFiltro-{userId}--{vista}                    select: filtrar por tipo
//   buzonBtn-{userId}--lista-{vista}-{tipo}-{pagina} botones de página / vista
//   buzonBtn-{userId}--borrar-{id}                   borrar una notificación genérica
// El detalle de un regalo usa los botones de regalos (regaloBz).
// ─────────────────────────────────────────────────────────────────────────────
const { crearCustomId } = require("../../utils/constructores/customId")
const cfg = require("../../config/buzon")
const { FIRMA } = require("../../config/mensajesRegalos")

const textoV2 = (content) => ({ type: 10, content })
const separador = () => ({ type: 14, divider: true, spacing: 1 })
const fila = (...componentes) => ({ type: 1, components: componentes })
const boton = (custom_id, label, style = 2, disabled = false, emoji = null) => ({ type: 2, custom_id, label, style, disabled, ...(emoji ? { emoji: { name: emoji } } : {}) })
const ts = (d, f = "R") => `<t:${Math.floor(new Date(d).getTime() / 1000)}:${f}>`
const SIN_AVATAR = "https://res.cloudinary.com/dn1cubayf/image/upload/v1727127018/Resources/unknowncharacter.png"

const idLista = (userId, vista, tipo, pagina) => crearCustomId({ action: "buzonBtn", userId, extras: ["lista", vista, tipo, pagina] })
const tipoDe = (doc) => doc?.tipo || "regalo"

function emojiDe(doc) {
    if (tipoDe(doc) !== "regalo") return cfg.TIPOS[tipoDe(doc)]?.emoji || "✉️"
    if (doc.estado === "reportado") return "🔒"
    if (doc.estado === "abierto") return "🎀"
    return "🎁"
}

function lineaDe(doc) {
    const e = emojiDe(doc)
    if (tipoDe(doc) === "regalo") {
        const titulo = doc.envoltura?.titulo ? `**${doc.envoltura.titulo}**` : "**Regalo**"
        if (doc.estado === "reportado") return `- ${e} ${titulo} de **${doc.deNombre}** · en revisión`
        if (doc.estado === "abierto") return `- ${e} ${titulo} de **${doc.deNombre}** · abierto ${ts(doc.abiertoEn)}`
        return `- ${e} ${titulo} de **${doc.deNombre}** · llegó ${ts(doc.creadoEn)} · vuelve ${ts(doc.venceEn)}`
    }
    const nueva = doc.estado === "nueva"
    return `- ${e} ${nueva ? `**${doc.titulo}**` : doc.titulo} · de ${doc.deNombre} · ${ts(doc.creadoEn)}${nueva ? "" : " · leída"}`
}

/**
 * Lista del buzón.
 * @param {{ userId, nombre, items, total, sinAbrir, pagina, paginas, vista, tipo, aviso? }} p
 */
function construirBuzon({ userId, nombre, items, total, sinAbrir, pagina, paginas, vista, tipo, aviso }) {
    const todo = vista === "todo"
    const filtroTxt = tipo !== "todos" ? ` · ${cfg.TIPOS[tipo]?.emoji} ${cfg.TIPOS[tipo]?.nombre}` : ""
    const cabecera = [
        `# 📬 Buzón de ${nombre}`,
        sinAbrir
            ? `-# Tienes **${sinAbrir}** ${sinAbrir === 1 ? "cosa esperándote" : "cosas esperándote"} ${FIRMA}`
            : `-# No hay nada nuevo por ahora ${FIRMA}`,
        `-# Mostrando: ${todo ? "todo" : "sin abrir"}${filtroTxt}${paginas > 1 ? ` · página ${pagina + 1}/${paginas}` : ""}`,
    ]
    if (aviso) cabecera.push("", `> ${aviso}`)

    const componentes = [textoV2(cabecera.join("\n")), separador()]
    if (items.length) {
        componentes.push(textoV2(items.map(lineaDe).join("\n")))
        componentes.push(fila({
            type: 3,
            custom_id: crearCustomId({ action: "buzonVer", userId, extras: [vista, tipo, pagina] }),
            placeholder: "Abrir...",
            min_values: 1, max_values: 1,
            options: items.map(doc => {
                const regalo = tipoDe(doc) === "regalo"
                const label = regalo ? (doc.envoltura?.titulo || `Regalo de ${doc.deNombre}`) : doc.titulo
                return {
                    label: String(label || "Sin título").slice(0, 100),
                    value: String(doc._id),
                    description: `${cfg.TIPOS[tipoDe(doc)]?.nombre || "Aviso"} · De ${doc.deNombre}`.slice(0, 100),
                    emoji: { name: emojiDe(doc) },
                }
            }),
        }))
    } else {
        componentes.push(textoV2(todo ? "-# Aquí no hay nada todavía." : "-# Nada sin abrir. Pulsa **Ver todo** para ver lo que ya abriste."))
    }

    componentes.push(fila({
        type: 3,
        custom_id: crearCustomId({ action: "buzonFiltro", userId, extras: [vista] }),
        placeholder: "Filtrar por tipo...",
        min_values: 1, max_values: 1,
        options: [
            { label: "Todo", value: "todos", emoji: { name: "📬" }, default: tipo === "todos" },
            ...Object.entries(cfg.TIPOS).map(([valor, t]) => ({ label: t.nombre, value: valor, emoji: { name: t.emoji }, default: tipo === valor })),
        ],
    }))

    const botones = [boton(idLista(userId, todo ? "nuevos" : "todo", tipo, 0), todo ? "Solo sin abrir" : "Ver todo", 2, false, todo ? "📪" : "📭")]
    if (paginas > 1) {
        botones.unshift(
            boton(idLista(userId, vista, tipo, pagina - 1), "◀", 2, pagina === 0),
            boton(idLista(userId, vista, tipo, pagina + 1), "▶", 2, pagina >= paginas - 1),
        )
    }
    componentes.push(separador(), fila(...botones))
    return [{ type: 17, accent_color: 0xB79CED, components: componentes }]
}

/** Detalle de una notificación genérica (carta, paquete, sistema). */
function construirNotificacion({ userId, doc, avatar, aviso }) {
    const t = cfg.TIPOS[tipoDe(doc)] || { nombre: "Aviso", emoji: "✉️" }
    const cuerpo = [
        `# ${t.emoji} ${doc.titulo}`,
        `-# *\`De:\`* ${doc.deNombre} · ${ts(doc.creadoEn, "f")}`,
        "",
        doc.texto || "-# Sin mensaje",
    ]
    if (aviso) cuerpo.push("", `> ${aviso}`)
    const componentes = [{ type: 9, components: [textoV2(cuerpo.join("\n"))], accessory: { type: 11, media: { url: avatar || SIN_AVATAR } } }]
    if (doc.imagen) componentes.push(separador(), { type: 12, items: [{ media: { url: doc.imagen } }] })
    componentes.push(separador(), fila(
        boton(crearCustomId({ action: "buzonBtn", userId, extras: ["borrar", String(doc._id)] }), "Borrar", 4, false, "🗑️"),
        boton(idLista(userId, "nuevos", "todos", 0), "Volver al buzón", 2, false, "↩️"),
    ))
    return [{ type: 17, accent_color: 0xB79CED, components: componentes }]
}

module.exports = { construirBuzon, construirNotificacion, idLista }
