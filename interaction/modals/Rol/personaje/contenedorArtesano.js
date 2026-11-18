const { crearModal } = require("../../../../utils/constructores/crearComponente");
const servicio = require("../../../../functions/Contenedores/servicio");
const vista = require("../../../../functions/Contenedores/vista");
const clientdb = require("../../../../Server");
const souls = clientdb.db("Rol_db").collection("Soul");

// Modal del botón "Artesano" del panel privado: forma + nombre + descripción del contenedor definitivo.
// customId: contenedorArtesano-{userId}-{characterId}
// El texto es libre: servicio.encargarArtesanal lo sanea (longitud, markdown, menciones, enlaces).
module.exports = crearModal({
    customId: "contenedorArtesano",
    soloAutor: true,
    camposDinamicos: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true }
    },

    ejecutar: async ({ interaction, character, soul }) => {
        const userId = interaction.user.id;
        if (userId !== character.ownerID) {
            return interaction.reply({ content: "No puedes tocar el contenedor de este personaje ＞﹏＜", flags: ["Ephemeral"] });
        }

        const elegida = interaction.fields.getStringSelectValues("forma")[0];
        const forma = elegida === "otra" ? interaction.fields.getTextInputValue("formaOtra") : elegida;
        const nombre = interaction.fields.getTextInputValue("nombre");
        const descripcion = interaction.fields.getTextInputValue("descripcion");

        const r = await servicio.encargarArtesanal(character, soul, { forma, nombre, descripcion, userId });
        if (!r.ok) {
            return interaction.reply({ content: vista.mensajeDe(r), flags: ["Ephemeral"], allowedMentions: { parse: [] } });
        }

        const soulFresca = await souls.findOne({ _id: soul._id });
        return interaction.update({
            components: vista.construirPanelContenedor({
                character, soul: soulFresca, userId,
                aviso:
                    `\`[💎]\` El artesano te entrega **${r.entrada.diseno.nombre}**, un ${r.entrada.forma} con tu forma y tu nombre (−${r.costo} ${vista.LUMENS}).\n` +
                    "-# Tu Contenedor de Cortesía vuelve al Instituto.",
            }),
            allowedMentions: { parse: [] },
        });
    }
});
