const { crearModal } = require("../../../../utils/constructores/crearComponente");
const servicio = require("../../../../functions/Mascotas/servicio");
const pantallas = require("../../../../functions/Mascotas/pantallas");
const vista = require("../../../../functions/Mascotas/vista");

// Modal del botón "Renombrar" del panel de mascotas.
// customId: mascotaNombre-{userId}--{petId}-{origen}   (characterId vacío → personaje activo)
module.exports = crearModal({
    customId: "mascotaNombre",
    soloAutor: true,
    camposDinamicos: true,
    requirements: {
        character: { obtener: true, required: true }
    },

    ejecutar: async ({ interaction, character, componentData: { extras } }) => {
        const [petId, origenRaw] = extras;
        const userId = interaction.user.id;
        const origen = origenRaw === "e" ? "e" : "p";

        const r = await servicio.renombrar({ character, petId, nombre: interaction.fields.getTextInputValue("nombre") });
        if (!r.ok) return interaction.reply({ content: vista.mensajeDe(r), flags: ["Ephemeral"], allowedMentions: { parse: [] } });

        const pantalla = await pantallas.mascotas({
            userId, character, puedeCuidar: true, origen,
            aviso: `\`[✏️]\` Ahora se llama **${r.nombre}**.`,
        });
        // El modal sale de un botón del panel: se actualiza ese mismo mensaje
        if (interaction.isFromMessage()) {
            await interaction.update({ components: pantalla.components, allowedMentions: { parse: [] } });
        } else {
            await interaction.reply({ components: pantalla.components, flags: pantallas.V2_EFIMERO, allowedMentions: { parse: [] } });
        }
        return pantallas.anunciar(interaction, pantalla);
    }
});
