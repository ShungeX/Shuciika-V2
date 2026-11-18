const { ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, TextDisplayBuilder } = require("discord.js");
const { crearBoton } = require("../../../../utils/constructores/crearComponente");
const { crearCustomId } = require("../../../../utils/constructores/customId");
const servicio = require("../../../../functions/Contenedores/servicio");
const vista = require("../../../../functions/Contenedores/vista");
const { ARTESANO, REPARACION, RESPALDO } = require("../../../../functions/Contenedores/config");
const clientdb = require("../../../../Server");
const souls = clientdb.db("Rol_db").collection("Soul");

const V2_EFIMERO = ["Ephemeral", "IsComponentsV2"];

// Botones del contenedor de un Alma Desafinada.
// customId: contenedor-{userId}-{characterId}-{panel|kit|taller|respaldo|artesano}
//   panel → abre el panel privado (efímero) desde /rol perfil → Alma → Equipamiento
//   el resto vive dentro de ese panel y lo actualiza en el sitio
module.exports = crearBoton({
    customId: "contenedor",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true }
    },

    ejecutar: async ({ interaction, character, soul, componentData: { extras } }) => {
        const [accion] = extras;
        const userId = interaction.user.id;
        const efimero = (content) => interaction.reply({ content, flags: ["Ephemeral"], allowedMentions: { parse: [] } });
        if (userId !== character.ownerID) return efimero("No puedes tocar el contenedor de este personaje ＞﹏＜");

        if (accion === "panel") {
            const panel = vista.construirPanelContenedor({ character, soul, userId });
            if (!panel) return efimero(vista.mensajeDe({ motivo: "no_desafinado" }));
            return interaction.reply({ components: panel, flags: V2_EFIMERO, allowedMentions: { parse: [] } });
        }

        // Vuelve a pintar el panel con el alma recién leída y el resultado de la acción
        const actualizar = async (aviso) => {
            const soulFresca = await souls.findOne({ _id: soul._id });
            return interaction.update({
                components: vista.construirPanelContenedor({ character, soul: soulFresca, userId, aviso }),
                allowedMentions: { parse: [] },
            });
        };

        if (accion === "kit") {
            const r = await servicio.repararConKit(character, soul);
            if (!r.ok) return efimero(vista.mensajeDe(r));
            return actualizar(`\`[🧰]\` Usaste un **Kit de reparación**: +${r.puntos} de durabilidad. Tu contenedor queda **${r.etapa}**.`);
        }

        if (accion === "taller") {
            const r = await servicio.repararEnTaller(character, soul, { userId });
            if (!r.ok) return efimero(vista.mensajeDe(r));
            return actualizar(
                `\`[🛠️]\` El Taller ${r.estabaRoto ? "reemplazó el cristal de" : "reparó"} tu contenedor por **${r.costo}** ${vista.LUMENS}` +
                (REPARACION.RECARGA_AL_REPARAR ? " y te lo devuelve con la carga llena." : ".") +
                "\n-# *El responsable del área te mira un segundo más de lo necesario.*"
            );
        }

        if (accion === "respaldo") {
            const r = await servicio.pedirRespaldo(soul);
            if (!r.ok) return efimero(vista.mensajeDe(r));
            return actualizar(`\`[🎒]\` El Instituto te entrega un **Contenedor de Cortesía**.\n-# ${RESPALDO.TEXTO_ENTREGA}`);
        }

        if (accion === "artesano") {
            const estado = servicio.estadoContenedor(soul);
            if (!estado) return efimero(vista.mensajeDe({ motivo: "no_desafinado" }));
            if (!estado.puedeArtesano) return efimero(vista.mensajeDe({ motivo: "ya_tiene_artesanal" }));

            const campoTexto = (id, estilo, max, requerido) =>
                new TextInputBuilder().setCustomId(id).setStyle(estilo).setMaxLength(max).setRequired(requerido);

            const modal = new ModalBuilder()
                .setCustomId(crearCustomId({ action: "contenedorArtesano", userId, characterId: character._id }))
                .setTitle("Encargo al artesano")
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# El artesano del Distrito mercantil forja tu contenedor definitivo por **${ARTESANO.PRECIO} Lumens**.\n` +
                        "-# Él pone el cristal y la esencia; tú, la forma y el nombre. La forma es solo estética."
                    )
                )
                .addLabelComponents(
                    new LabelBuilder()
                        .setLabel("Forma")
                        .setStringSelectMenuComponent(
                            new StringSelectMenuBuilder()
                                .setCustomId("forma")
                                .setPlaceholder("¿Qué figura tendrá?")
                                .setRequired(true)
                                .addOptions([
                                    ...ARTESANO.FORMAS.map(f => ({ label: f[0].toUpperCase() + f.slice(1), value: f })),
                                    { label: "Otra (escríbela abajo)", value: "otra" },
                                ])
                        ),
                    new LabelBuilder()
                        .setLabel("Otra forma")
                        .setDescription("Solo si elegiste \"Otra\"")
                        .setTextInputComponent(campoTexto("formaOtra", TextInputStyle.Short, ARTESANO.FORMA_MAX, false)),
                    new LabelBuilder()
                        .setLabel("Nombre del contenedor")
                        .setTextInputComponent(campoTexto("nombre", TextInputStyle.Short, ARTESANO.NOMBRE_MAX, true)),
                    new LabelBuilder()
                        .setLabel("Descripción")
                        .setDescription("Cómo se ve, qué lo hace tuyo")
                        .setTextInputComponent(campoTexto("descripcion", TextInputStyle.Paragraph, ARTESANO.DESCRIPCION_MAX, false))
                );
            return interaction.showModal(modal);
        }

        return efimero("Acción del contenedor desconocida.");
    }
});
