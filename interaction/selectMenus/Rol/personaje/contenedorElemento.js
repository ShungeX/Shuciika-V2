const { crearStringSelectMenu } = require("../../../../utils/constructores/crearComponente");
const servicio = require("../../../../functions/Contenedores/servicio");
const vista = require("../../../../functions/Contenedores/vista");
const clientdb = require("../../../../Server");
const souls = clientdb.db("Rol_db").collection("Soul");

// Cambio de elemento activo fuera de combate (inmediato y gratis), desde el panel privado.
// customId: contenedorElemento-{userId}-{characterId} · value: nombre del elemento
module.exports = crearStringSelectMenu({
    customId: "contenedorElemento",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true }
    },
    optionNames: ["elemento"],

    ejecutar: async ({ interaction, character, soul, options: { elemento } }) => {
        const userId = interaction.user.id;
        if (userId !== character.ownerID) {
            return interaction.reply({ content: "No puedes tocar el contenedor de este personaje ＞﹏＜", flags: ["Ephemeral"] });
        }
        const r = await servicio.cambiarElemento(soul, elemento);
        if (!r.ok) return interaction.reply({ content: vista.mensajeDe(r), flags: ["Ephemeral"] });

        const soulFresca = await souls.findOne({ _id: soul._id });
        return interaction.update({
            components: vista.construirPanelContenedor({ character, soul: soulFresca, userId, aviso: `\`[🔮]\` Tu contenedor ahora traduce **${r.elemento}**.` }),
            allowedMentions: { parse: [] },
        });
    }
});
