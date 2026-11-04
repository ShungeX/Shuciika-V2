const { EmbedBuilder } = require("discord.js");
const { crearModal } = require("../../../../utils/constructores/crearComponente");
const interfazCreate = require("../../../../functions/interfazCreate");
const { usarObjeto } = require("../../../../functions/Objetos/usarObjeto");
const clientdb = require("../../../../Server");
const personajes = clientdb.db("Rol_db").collection("Personajes");

// Modal del botón "Usar item" de /rol inventario: un select con los objetos usables de la lista visible y la cantidad.
// customId: inventarioUsar-{userId}-{characterId}-{pagina}-{filtros}
module.exports = crearModal({
    customId: "inventarioUsar",
    soloAutor: true,
    // El select no es un TextInput: se lee de interaction.fields
    camposDinamicos: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: false }
    },

    ejecutar: async ({ interaction, character, soul, componentData: { extras } }) => {
        const [pageRaw, filtrosJoined] = extras;
        const page = Number(pageRaw) || 1;
        const filtros = filtrosJoined ? filtrosJoined.split("_") : ["fullbag"];

        const clave = interaction.fields.getStringSelectValues("objeto")[0];
        const cantidadTexto = interaction.fields.getTextInputValue("cantidad");

        await interaction.deferUpdate();

        let resultado;
        try {
            resultado = await usarObjeto({ interaction, character, soul, clave, cantidadTexto });
        } catch (error) {
            console.error("[inventarioUsar] Error al usar el objeto:", error);
            resultado = { ok: false, publico: false, lineas: ["Ha ocurrido un error al intentar usar el objeto (╥﹏╥)"] };
        }

        // Refrescar el inventario con las cantidades nuevas
        if (resultado.ok) {
            const actualizado = await personajes.findOne({ _id: character._id });
            if (actualizado) {
                const json = interfazCreate.inventarioMensaje(interaction, actualizado, page, filtros);
                await interaction.editReply({ components: json }).catch(() => { });
            }
        }

        const texto = resultado.lineas.filter(Boolean).join("\n").slice(0, 4000) || "Listo.";

        if (resultado.publico) {
            const embed = new EmbedBuilder()
                .setDescription(texto)
                .setColor(resultado.ok ? "DarkGreen" : "Red");
            if (resultado.titulo) embed.setTitle(resultado.titulo);
            return interaction.followUp({ embeds: [embed] });
        }

        return interaction.followUp({ content: texto.slice(0, 2000), flags: ["Ephemeral"] });
    }
});
