// Modal "Cuéntanos cómo te fue" del botón "Da tu opinión" (Crear ficha).
// Se permite una sola opinión por ficha: se marca con CachePJ.opinionEnviada,
// que desaparece junto con el documento cuando la ficha se acepta o rechaza.

const { ModalBuilder, LabelBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { crearCustomId } = require("./constructores/customId");

const OPCIONES_FACILIDAD = [
    { value: "1", label: "1 · Muy confuso" },
    { value: "2", label: "2 · Confuso" },
    { value: "3", label: "3 · Normal" },
    { value: "4", label: "4 · Fácil" },
    { value: "5", label: "5 · Muy fácil" },
];

const OPCIONES_TRABAS = [
    { value: "pasos", label: "Los pasos" },
    { value: "opciones", label: "Las opciones" },
    { value: "textos", label: "Los textos" },
    { value: "error", label: "Un error del bot" },
    { value: "nada", label: "Nada" },
    { value: "otro", label: "Otro" },
];

const MENSAJE_YA_ENVIADA = "Ya nos diste tu opinión sobre esta ficha, ¡gracias por tomarte el tiempo! (✿◡‿◡)";

function construirModalOpinion(userId) {
    return new ModalBuilder()
        .setTitle("Cuéntanos cómo te fue")
        .setCustomId(crearCustomId({ action: "actualizarPerfil", userId, extras: ["opinion"] }))
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("¿Qué tan fácil fue crear tu personaje?")
                .setStringSelectMenuComponent(
                    new StringSelectMenuBuilder()
                        .setCustomId("opinion_facilidad")
                        .setPlaceholder("Muy confuso → Muy fácil")
                        .setMinValues(1)
                        .setMaxValues(1)
                        .addOptions(OPCIONES_FACILIDAD)
                ),
            new LabelBuilder()
                .setLabel("¿Algo te trabó?")
                .setDescription("Puedes elegir varias")
                .setStringSelectMenuComponent(
                    new StringSelectMenuBuilder()
                        .setCustomId("opinion_trabas")
                        .setPlaceholder("Elige una o más opciones")
                        .setMinValues(1)
                        .setMaxValues(OPCIONES_TRABAS.length)
                        .addOptions(OPCIONES_TRABAS)
                ),
            new LabelBuilder()
                .setLabel("¿Qué cambiarías o agregarías?")
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId("opinion_comentario")
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder("Una idea, un fallo o algo que no entendiste.")
                        .setMaxLength(1000)
                        .setRequired(false)
                ),
        );
}

/** Convierte los valores del modal en texto legible para el embed del staff. */
function leerRespuestasOpinion(fields) {
    const valorFacilidad = fields.getStringSelectValues("opinion_facilidad")?.[0];
    let trabas = fields.getStringSelectValues("opinion_trabas") ?? [];
    // "Nada" no tiene sentido junto a otras opciones
    if (trabas.length > 1) trabas = trabas.filter(v => v !== "nada");

    const facilidad = OPCIONES_FACILIDAD.find(o => o.value === valorFacilidad);
    const etiquetasTrabas = trabas
        .map(v => OPCIONES_TRABAS.find(o => o.value === v)?.label)
        .filter(Boolean);

    return {
        puntuacion: Number(valorFacilidad) || null,
        facilidad: facilidad ? `${"★".repeat(Number(facilidad.value))}${"☆".repeat(5 - Number(facilidad.value))} ${facilidad.label}` : "Sin respuesta",
        trabas: etiquetasTrabas.length ? etiquetasTrabas.join(" · ") : "Sin respuesta",
        comentario: (fields.getTextInputValue("opinion_comentario") || "").trim(),
    };
}

module.exports = { construirModalOpinion, leerRespuestasOpinion, MENSAJE_YA_ENVIADA, OPCIONES_FACILIDAD, OPCIONES_TRABAS };
