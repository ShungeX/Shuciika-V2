// Modal «Antes de enviar tu ficha» (T0): quién te invitó y cómo nos conociste.
// Guarda la respuesta en CachePJ.invitacion y enseña la confirmación de envío.

const { crearModal } = require("../../../utils/constructores/crearComponente");
const clientdb = require("../../../Server");
const { leerRespuesta, construirConfirmacionEnvio } = require("../../../functions/invitaciones");

const Cachedb = clientdb.db("Rol_db").collection("CachePJ");

module.exports = crearModal({
    customId: "invitacion_ficha",
    soloAutor: true,

    ejecutar: async ({ interaction }) => {
        const r = leerRespuesta(interaction);
        if (!r.ok) {
            return interaction.reply({ content: r.error, flags: ["Ephemeral"] });
        }

        const cache = await Cachedb.findOne({ _id: interaction.user.id });
        if (!cache) {
            return interaction.reply({ content: "No encuentro tu ficha en borrador 〒▽〒\n-# Vuelve a usar `/rol crear_ficha`.", flags: ["Ephemeral"] });
        }
        if (cache.waiting) {
            return interaction.reply({ content: "Tu ficha ya fue enviada y se encuentra en revisión.", flags: ["Ephemeral"] });
        }

        await Cachedb.updateOne({ _id: interaction.user.id }, { $set: { invitacion: r.invitacion } });

        await interaction.reply({
            components: construirConfirmacionEnvio(interaction.user.id),
            flags: ["IsComponentsV2", "Ephemeral"]
        });

        // El mismo aviso que el envío sin T0
        if (!cache.avatarURL) {
            await interaction.followUp({
                content: "-# Parece que tu personaje aún no tiene una **Foto de perfil**, es opcional... Pero te recomendamos agregar una ＞﹏＜\n-# Puedes asignar una presionando el boton `Establecer foto`",
                flags: ["Ephemeral"]
            }).catch(() => { });
        }
    }
});
