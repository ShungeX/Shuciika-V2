// Botones del reporte de regalo en el canal del staff (functions/Regalos/reportesCanal.js).
// customId: regaloStaff---{devolver|liberar}-{reporteId}   (público: se valida que sea staff)
const { PermissionFlagsBits } = require("discord.js")
const { crearBoton } = require("../../../../utils/constructores/crearComponente")
const { devs } = require("../../../../config/configslash.json")
const { texto } = require("../../../../config/mensajesRegalos")
const regalos = require("../../../../functions/Regalos/regalos")
const { construirReporte, SIN_MENCIONES } = require("../../../../functions/Regalos/reportesCanal")

const esStaff = (interaction) =>
    String(devs || "").split(/[\s,]+/).includes(interaction.user.id) ||
    Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages))

module.exports = crearBoton({
    customId: "regaloStaff",

    ejecutar: async ({ interaction, componentData: { extras } }) => {
        const [accion, reporteId] = extras
        if (!esStaff(interaction)) {
            return interaction.reply({ content: "Solo el staff puede resolver reportes 〒▽〒", flags: ["Ephemeral"] })
        }
        await interaction.deferUpdate()
        const r = await regalos.resolverReporte({ reporteId, accion, staffId: interaction.user.id })
        if (!r.ok) {
            // Ya resuelto por otra persona: se refresca el mensaje con el estado real
            const rep = r.reporte || await regalos.obtenerReporte(reporteId)
            if (rep) await interaction.editReply({ components: construirReporte(rep), allowedMentions: SIN_MENCIONES })
            return interaction.followUp({ content: texto(r.codigo), flags: ["Ephemeral"] })
        }
        return interaction.editReply({ components: construirReporte(r.reporte), allowedMentions: SIN_MENCIONES })
    }
})
