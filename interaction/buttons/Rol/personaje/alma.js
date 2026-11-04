const { ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, TextDisplayBuilder } = require("discord.js");
const { crearBoton } = require("../../../../utils/constructores/crearComponente");
const { crearCustomId } = require("../../../../utils/constructores/customId");
const {
    leerProgreso, costoFragmento, simularConversion, techoStatPorResplandor, COSTO_FE_POR_PUNTO,
} = require("../../../../functions/Economia/progresionEstelar");
const { opcionesMejora } = require("../../../../data/UI_ComponentsV2/menuAlma");

// Botones del menú del alma.
// customId: alma-{userId}-{characterId}-{convertir|mejorar}
module.exports = crearBoton({
    customId: "alma",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true }
    },

    ejecutar: async ({ interaction, character, soul, componentData: { extras } }) => {
        const [accion] = extras;
        if (interaction.user.id !== character.ownerID) {
            return interaction.reply({ content: "No puedes modificar el alma de este personaje ＞﹏＜", flags: ["Ephemeral"] });
        }

        const prog = leerProgreso(soul);
        const idModal = (action) => crearCustomId({ action, userId: interaction.user.id, characterId: character._id });

        if (accion === "convertir") {
            const sim = simularConversion(prog.polvo, prog.ganados);
            if (sim.fragmentos === 0) {
                return interaction.reply({
                    content: `Necesitas **${costoFragmento(prog.ganados)}** de polvo estelar para condensar 1 FE (tienes ${prog.polvo}).`,
                    flags: ["Ephemeral"]
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(idModal("almaConvertir"))
                .setTitle("Condensar polvo estelar")
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# Polvo estelar: **${prog.polvo}**\n` +
                        `-# Costo del siguiente FE: **${costoFragmento(prog.ganados)}** de polvo\n` +
                        `-# El costo cambia con cada fragmento según tu total acumulado (${prog.ganados} FE).\n` +
                        `-# Con tu polvo actual puedes condensar hasta **${sim.fragmentos} FE** (${sim.gasto} de polvo).`
                    )
                )
                .addLabelComponents(
                    new LabelBuilder()
                        .setLabel("Fragmentos a condensar")
                        .setDescription(`Déjalo vacío para condensar todos los posibles (${sim.fragmentos})`)
                        .setTextInputComponent(
                            new TextInputBuilder()
                                .setCustomId("cantidad")
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder(String(sim.fragmentos))
                                .setMaxLength(5)
                                .setRequired(false)
                        )
                );
            return interaction.showModal(modal);
        }

        if (accion === "mejorar") {
            const techo = techoStatPorResplandor(prog.resplandor);
            if (prog.disponibles < COSTO_FE_POR_PUNTO) {
                return interaction.reply({
                    content: `Mejorar un stat cuesta **${COSTO_FE_POR_PUNTO} FE** y tienes ${prog.disponibles}.`,
                    flags: ["Ephemeral"]
                });
            }
            const opciones = opcionesMejora(soul);
            if (!opciones.length) {
                return interaction.reply({
                    content: `Todos tus stats llegaron al máximo de mejoras para Resplandor ${prog.resplandorRomano} (${techo}). Sube de Resplandor para seguir mejorando.`,
                    flags: ["Ephemeral"]
                });
            }

            const maxPuntos = Math.floor(prog.disponibles / COSTO_FE_POR_PUNTO);
            const modal = new ModalBuilder()
                .setCustomId(idModal("almaMejorar"))
                .setTitle("Mejorar stats")
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# FE disponibles: **${prog.disponibles}** · Cada punto cuesta **${COSTO_FE_POR_PUNTO} FE** (máx. ${maxPuntos} punto${maxPuntos === 1 ? "" : "s"}).\n` +
                        `-# Con Resplandor ${prog.resplandorRomano} cada stat admite hasta **${techo}** mejoras.\n` +
                        "-# Una vez asignados no se pueden cambiar [Temporalmente]."
                    )
                )
                .addLabelComponents(
                    new LabelBuilder()
                        .setLabel("Stat")
                        .setStringSelectMenuComponent(
                            new StringSelectMenuBuilder()
                                .setCustomId("stat")
                                .setPlaceholder("Elige el stat a mejorar...")
                                .setRequired(true)
                                .addOptions(opciones)
                        ),
                    new LabelBuilder()
                        .setLabel("Puntos a asignar")
                        .setDescription(`Entre 1 y ${maxPuntos}`)
                        .setTextInputComponent(
                            new TextInputBuilder()
                                .setCustomId("puntos")
                                .setStyle(TextInputStyle.Short)
                                .setValue("1")
                                .setMaxLength(3)
                                .setRequired(true)
                        )
                );
            return interaction.showModal(modal);
        }

        return interaction.reply({ content: "Acción del alma desconocida.", flags: ["Ephemeral"] });
    }
});
