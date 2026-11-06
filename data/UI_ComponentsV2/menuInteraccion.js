// ─────────────────────────────────────────────────────────────────────────────
// UI de interacciones entre personajes (Components V2).
// Se manda con flags ["IsComponentsV2"].
//
// Es la misma estructura que la plantilla original: los marcadores
// [personaje_interacción], [mensaje_personalizado_por_acción], etc. ahora son
// parámetros. La lógica (qué texto, qué puntos) vive en functions/Amistad/.
// ─────────────────────────────────────────────────────────────────────────────

const esUrl = (u) => typeof u === "string" && /^https?:\/\//.test(u)

/**
 * @param {object}  p
 * @param {string}  p.texto        Contenido principal (acción + línea de puntos)
 * @param {string}  [p.avatar]     Foto de perfil del personaje que actúa
 * @param {string}  [p.gif]        Imagen de la acción
 * @param {string}  p.customId     custom_id del menú (amistad*tipo*de*a*ts*cadena)
 * @param {{ label: string, value: string, default?: boolean }[]} p.opciones
 * @param {string}  [p.placeholder]
 * @param {boolean} [p.deshabilitado]  true al resolver/expirar, para evitar doble clic
 * @param {string}  [p.pie]        Línea final (ping al receptor o cierre)
 */
function menuInteraccion({ texto, avatar, gif, customId, opciones, placeholder = "¿Qué respondes?", deshabilitado = false, pie }) {
    const textoPrincipal = { type: 10, content: texto }

    const components = [
        esUrl(avatar)
            ? {
                type: 9,
                accessory: { type: 11, media: { url: avatar }, description: null, spoiler: false },
                components: [textoPrincipal],
            }
            : textoPrincipal,
        { type: 14, divider: true, spacing: 1 },
    ]

    if (esUrl(gif)) {
        components.push(
            { type: 12, items: [{ media: { url: gif }, description: null, spoiler: false }] },
            { type: 14, divider: true, spacing: 1 },
        )
    }

    if (customId && opciones?.length) {
        components.push({
            type: 1,
            components: [{
                type: 3,
                custom_id: customId,
                options: opciones.map(o => ({ label: o.label, value: o.value, description: null, emoji: null, default: !!o.default })),
                placeholder,
                min_values: 1,
                max_values: 1,
                disabled: deshabilitado,
            }],
        })
    }

    if (pie) components.push({ type: 10, content: pie })

    return [{ type: 17, accent_color: null, spoiler: false, components }]
}


// ─── Menú de amistad (/rol amistad) ──────────────────────────────────────────
const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize } = require("discord.js")

// Imagen de respaldo si el otro personaje no tiene avatar.
const AVATAR_RESPALDO = "https://i.pinimg.com/736x/d7/46/ee/d746ee3e9c836d32187682838e19a2ab.jpg"

/**
 * Tarjeta de amistad entre el personaje activo y `otro`. Se manda con flags
 * ["IsComponentsV2"]. El texto lo arma functions/Amistad/vistaAmistad.js.
 *
 * @param {object|null} pareja  Documento de `amistades` (null → tarjeta vacía: Desconocidos, 0 puntos)
 * @param {object} otro         Personaje consultado (su avatar va en el thumbnail)
 * @returns {ContainerBuilder[]}
 */
function construirMenuAmistad(pareja, otro, ahora = Date.now()) {
    const { contenidoTarjeta } = require("../../functions/Amistad/vistaAmistad")
    const { titulo, bloques, avatar, color } = contenidoTarjeta(pareja, otro, ahora)
    const [cabecera, ...resto] = bloques

    console.log(resto)

    const contenedor = new ContainerBuilder()
        .setAccentColor(color)
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(titulo),
                    new TextDisplayBuilder().setContent(cabecera),
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(esUrl(avatar) ? avatar : AVATAR_RESPALDO))
        )

    for (const bloque of resto) {
        contenedor
            .addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(bloque))
    }
    return [contenedor]
}

module.exports = { menuInteraccion, construirMenuAmistad }
