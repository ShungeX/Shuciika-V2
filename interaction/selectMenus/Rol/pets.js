const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente");
const servicio = require("../../../functions/Mascotas/servicio");
const pantallas = require("../../../functions/Mascotas/pantallas");
const vista = require("../../../functions/Mascotas/vista");

// Selector de mascotas del panel: cambia la mascota activa del personaje.
// customId: pets-{userId}--activar-{origen}   (characterId vacío → personaje activo de quien pulsa)
module.exports = crearStringSelectMenu({
    customId: "pets",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true }
    },
    optionNames: ["petId"],

    ejecutar: async ({ interaction, character, componentData: { extras }, options: { petId } }) => {
        const [accion, origenRaw] = extras;
        const userId = interaction.user.id;
        const origen = origenRaw === "e" ? "e" : "p";
        const efimero = (content) => interaction.reply({ content, flags: ["Ephemeral"], allowedMentions: { parse: [] } });

        if (accion !== "activar") return efimero(vista.mensajeDe({ motivo: "accion_invalida" }));

        const r = await servicio.activar({ character, petId });
        if (!r.ok) return efimero(vista.mensajeDe(r));

        const pantalla = await pantallas.mascotas({
            userId, character, puedeCuidar: true, origen,
            aviso: `\`[🐾]\` **${r.pet.Nombre}** te acompaña ahora.`,
        });
        await interaction.update({ components: pantalla.components, allowedMentions: { parse: [] } });
        return pantallas.anunciar(interaction, pantalla);
    }
});
