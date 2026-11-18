const { ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { crearBoton } = require("../../../utils/constructores/crearComponente");
const { crearCustomId } = require("../../../utils/constructores/customId");
const servicio = require("../../../functions/Mascotas/servicio");
const pantallas = require("../../../functions/Mascotas/pantallas");
const vista = require("../../../functions/Mascotas/vista");
const N = require("../../../functions/Mascotas/nucleo");
const C = require("../../../config/configPets");

// Botones de mascotas y huevos.
// customId: mascotas-{userId}--{accion}-{...}-{origen}
//   El characterId va vacío: el router inyecta el personaje ACTIVO de quien pulsa, y cada mascota o
//   huevo se busca dentro de ese personaje (nunca por ID de Discord).
//   ver      → panel de la mascota activa            mascotas-u--ver-{origen}
//   huevos   → panel de huevos en crianza            mascotas-u--huevos-{origen}
//   cuidar   → alimentar|limpiar|jugar|dormir        mascotas-u--cuidar-{petId}-{accion}-{origen}
//   renombrar→ abre el modal del nombre              mascotas-u--renombrar-{petId}-{origen}
//   huevo    → limpieza|carino|calor                 mascotas-u--huevo-{huevoId}-{clave}-{origen}
//   incubar  → meter|sacar de la incubadora          mascotas-u--incubar-{huevoId}-{meter|sacar}-{origen}
//   nuevo    → empieza a criar un huevo              mascotas-u--nuevo-[{region}]-{id}-{manual|incubadora}
//   origen: "p" panel dentro de /rol perfil · "e" mensaje efímero (abierto desde el inventario)
module.exports = crearBoton({
    customId: "mascotas",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: false }
    },

    ejecutar: async ({ interaction, character, soul, componentData: { extras } }) => {
        const [accion, a, b, c] = extras;
        const userId = interaction.user.id;
        const efimero = (content) => interaction.reply({ content, flags: ["Ephemeral"], allowedMentions: { parse: [] } });
        const pintar = async (pantalla) => {
            await interaction.update({ components: pantalla.components, allowedMentions: { parse: [] } });
            await pantallas.anunciar(interaction, pantalla);
        };
        const origenDe = (valor) => (valor === "e" ? "e" : "p");

        if (accion === "ver") {
            return pintar(await pantallas.mascotas({ userId, character, puedeCuidar: true, origen: origenDe(a) }));
        }

        if (accion === "huevos") {
            return pintar(await pantallas.huevos({ userId, character, soul, origen: origenDe(a) }));
        }

        if (accion === "cuidar") {
            const origen = origenDe(c);
            const r = await servicio.cuidarMascota({ character, petId: a, accion: b });
            if (!r.ok) return efimero(vista.mensajeDe(r));

            const nombre = r.pet.Nombre;
            const aviso = r.desperto
                ? `\`[☀️]\` **${nombre}** se despierta y se estira.`
                : `\`[🐾]\` **${nombre}** ${r.cfg.hecho}.`;
            await pintar(await pantallas.mascotas({ userId, character, puedeCuidar: true, origen, aviso }));

            if (r.subioNivel || r.subioEtapa) {
                await interaction.followUp({ components: vista.mensajeCambio(r), flags: pantallas.V2_EFIMERO, allowedMentions: { parse: [] } }).catch(() => { });
            }
            return;
        }

        if (accion === "renombrar") {
            const modal = new ModalBuilder()
                .setCustomId(crearCustomId({ action: "mascotaNombre", userId, characterId: "", extras: [a, origenDe(b)] }))
                .setTitle("Renombrar mascota")
                .addLabelComponents(
                    new LabelBuilder()
                        .setLabel("Nuevo nombre")
                        .setDescription(`De 2 a ${C.LIMITES.NOMBRE_MAX} caracteres`)
                        .setTextInputComponent(
                            new TextInputBuilder()
                                .setCustomId("nombre")
                                .setStyle(TextInputStyle.Short)
                                .setMinLength(2)
                                .setMaxLength(C.LIMITES.NOMBRE_MAX)
                                .setRequired(true)
                        )
                );
            return interaction.showModal(modal);
        }

        if (accion === "huevo") {
            const origen = origenDe(c);
            const r = await servicio.cuidarHuevo({ character, soul, huevoId: a, clave: b });
            // Si nació o se rompió mientras el panel estaba abierto, el panel nuevo lo cuenta
            if (!r.ok && ["roto", "eclosionado", "huevo_no_encontrado"].includes(r.motivo)) {
                return pintar(await pantallas.huevos({ userId, character, soul, origen }));
            }
            if (!r.ok) return efimero(vista.mensajeDe(r));

            const cfg = C.HUEVO.CUIDADOS[r.clave];
            const aviso = r.sobrecuidado
                ? `\`[✨]\` ${cfg.verbo} de más el **${r.nombre}**: nacerá **${N.formatoDuracion(r.reduccionMs)}** antes. \`-${C.HUEVO.COSTO_ENERGIA}⚡\``
                : `\`[${cfg.emoji}]\` ${cfg.verbo} el **${r.nombre}** (+${Math.round(r.despues - r.antes)}%). \`-${C.HUEVO.COSTO_ENERGIA}⚡\``;
            return pintar(await pantallas.huevos({ userId, character, soul, origen, aviso }));
        }

        if (accion === "incubar") {
            const origen = origenDe(c);
            const meter = b === "meter";
            const r = await servicio.moverIncubadora({ character, soul, huevoId: a, meter });
            if (!r.ok && ["roto", "eclosionado", "huevo_no_encontrado"].includes(r.motivo)) {
                return pintar(await pantallas.huevos({ userId, character, soul, origen }));
            }
            if (!r.ok) return efimero(vista.mensajeDe(r));

            const aviso = meter
                ? `\`[🏠]\` Dejas el **${r.nombre}** en la incubadora: ya no necesita cuidados, pero tardará un poco más.`
                : `\`[🤲]\` Sacas el **${r.nombre}** de la incubadora: ahora depende de ti.`;
            return pintar(await pantallas.huevos({ userId, character, soul, origen, aviso }));
        }

        if (accion === "nuevo") {
            const incubadora = c === "incubadora";
            const r = await servicio.empezarHuevo({ character, soul, region: a, id: b, incubadora });
            if (!r.ok) return efimero(vista.mensajeDe(r));

            const aviso = incubadora
                ? `\`[🏠]\` Colocas el **${r.objeto.Nombre}** en la incubadora. Solo queda esperar.`
                : `\`[🥚]\` Envuelves el **${r.objeto.Nombre}** con cuidado. A partir de ahora depende de ti.`;
            return pintar(await pantallas.huevos({ userId, character, soul, origen: "e", aviso }));
        }

        return efimero(vista.mensajeDe({ motivo: "accion_invalida" }));
    }
});
