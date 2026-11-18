const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente");
const clientdb = require("../../../Server");
const vestibulos = require("../../../functions/vestibulos");

const contenedor = (texto, color) => {
    const c = { type: 17, components: [{ type: 10, content: texto }] };
    if (typeof color === "number") c.accent_color = color;
    return [c];
};

// Menú público del mensaje de cada vestíbulo (customId: vestibulo_ir---{vestibuloId}); el valor elegido es el vestíbulo de destino.
// Moverse cambia el rol de ubicación del miembro y la ubicación guardada en su personaje activo.
module.exports = crearStringSelectMenu({
    customId: "vestibulo_ir",
    soloAutor: false,
    requirements: {
        character: { obtener: true, required: false }
    },
    optionNames: ["destino"],

    ejecutar: async ({ interaction, character, componentData: { extras }, options: { destino } }) => {
        // Se reenvían los mismos componentes para que el menú vuelva a su texto inicial;
        // si no, quien elige el mismo destino dos veces no dispara nada
        await interaction.update({ components: interaction.message.components.map(c => c.toJSON()) });
        const efimero = (texto, color) => interaction.followUp({ components: contenedor(texto, color), flags: ["Ephemeral", "IsComponentsV2"] });

        const r = await vestibulos.moverPersonaje({
            member: interaction.member,
            character,
            origenId: extras[0],
            destinoId: destino,
            dbServer: clientdb.db("Server_db"),
            dbRol: clientdb.db("Rol_db")
        });
        if (!r.ok) return efimero(r.texto);

        const color = r.destino.vestibulo.accent_color;

        if (r.publico) {
            const canal = await interaction.client.channels.fetch(r.publico.canalId).catch(() => null);
            await canal?.send({ components: contenedor(r.publico.texto, color), flags: ["IsComponentsV2", "SuppressNotifications"], allowedMentions: { parse: [] } })
                .catch(err => console.error(`[Vestíbulos] No se pudo anunciar la llegada en ${r.publico.canalId}:`, err.message));
        }
    }
});
