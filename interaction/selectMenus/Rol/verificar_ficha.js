const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente");
const { crearCustomId } = require("../../../utils/constructores/customId");
const { formatearTextoLim } = require("../../../utils/textStrings");
const clientdb = require("../../../Server");
const db2 = clientdb.db("Rol_db");
const Cachedb = db2.collection("CachePJ");

const MAPA_CAMPOS = {
    "1": { id: "nombre", label: "Nombre" },
    "2": { id: "apodo", label: "Apodo" },
    "3": { id: "ciudadOrg", label: "Ciudad de Origen" },
    "4": { id: "especialidad", label: "Especialidades" },
    "5": { id: "estatura", label: "Estatura" },
    "6": { id: "peso", label: "Peso" },
    "7": { id: "avatarURL", label: "Foto de perfil" },
    "8": { id: "edad", label: "Edad" },
    "9": { id: "cumpleaños", label: "Cumpleaños" },
    "10": { id: "familia", label: "Linaje Familiar" },
    "11": { id: "personalidad", label: "Personalidad" },
    "12": { id: "historia", label: "Historia" },
    // Mapeo por clave directa
    "nombre": { id: "nombre", label: "Nombre" },
    "apodo": { id: "apodo", label: "Apodo" },
    "ciudadorg": { id: "ciudadOrg", label: "Ciudad de Origen" },
    "especialidad": { id: "especialidad", label: "Especialidades" },
    "especialidades": { id: "especialidad", label: "Especialidades" },
    "estatura": { id: "estatura", label: "Estatura" },
    "peso": { id: "peso", label: "Peso" },
    "avatarurl": { id: "avatarURL", label: "Foto de perfil" },
    "foto": { id: "avatarURL", label: "Foto de perfil" },
    "edad": { id: "edad", label: "Edad" },
    "cumpleaños": { id: "cumpleaños", label: "Cumpleaños" },
    "cumple": { id: "cumpleaños", label: "Cumpleaños" },
    "familia": { id: "familia", label: "Linaje Familiar" },
    "personalidad": { id: "personalidad", label: "Personalidad" },
    "historia": { id: "historia", label: "Historia" }
};

const TAG_RECHAZO = "1545228004425338920";
const TAG_CAMBIOS_SOLICITADOS = "1545227893754306631";
const TAG_PENDIENTE = "1545227800754266294";
const TAG_VERIFICADO = "1545227941422567505";

/**
 * Construye el ComponenteV2 para la notificación de rechazo enviada por MD (o al hilo si MD falla).
 *
 * @param {string} targetUserId - ID del usuario de Discord
 * @param {string} motivo - Motivo de la eliminación/rechazo
 * @returns {Array<Object>} ComponenteV2
 */
function construirMensajeRechazoMD(targetUserId, motivo) {
    return [
        {
            type: 17,
            accent_color: 4198673,
            spoiler: false,
            components: [
                {
                    type: 9,
                    accessory: {
                        type: 11,
                        media: {
                            url: "https://i.pinimg.com/736x/a3/01/df/a301dfae96a80e0eff36870dc8597567.jpg",
                            proxy_url: "https://i.pinimg.com/736x/a3/01/df/a301dfae96a80e0eff36870dc8597567.jpg"
                        },
                        description: null,
                        spoiler: false
                    },
                    components: [
                        {
                            type: 10,
                            content: "# Ficha no aceptada"
                        },
                        {
                            type: 10,
                            content: `*Hola <@${targetUserId}>*\n*El comité revisó con detalle tu ficha, pero me temo que en esta ocasión no fue posible aprobar tu ingreso. Para mantener los archivos en orden, tu solicitud fue retirada del registro temporalmente... pero no te desanimes, ¿sí? No tiene por qué ser un punto final.*`
                        }
                    ]
                },
                {
                    type: 14,
                    divider: true,
                    spacing: 1
                },
                {
                    type: 10,
                    content: `### » Motivo de la resolución:\n${motivo}`
                },
                {
                    type: 14,
                    divider: true,
                    spacing: 1
                },
                {
                    type: 10,
                    content: "-# Si crees que hubo algún malentendido con la directiva, no dudes en abrir un ticket en <#1545624833704984596> para aclararlo directamente con ellos.\n\n-# Ojalá te animes a ajustar los detalles y volver a intentarlo; me dará mucho gusto recibirte por aquí de nuevo. (✿◡‿◡)"
                }
            ]
        }
    ];
}

/**
 * Construye el ComponenteV2 que se enviará al hilo del foro con las correcciones requeridas.
 *
 * @param {Object} pj - Documento del personaje en CachePJ
 * @param {Array<Object>} correcciones - Lista de correcciones [{ campo, etiqueta, motivo }]
 * @returns {Array<Object>} ComponenteV2
 */
function construirMensajeCorreccionesHilo(pj, correcciones = []) {
    const userId = pj?._id || "";
    const components = [
        {
            type: 9,
            accessory: {
                type: 11,
                media: {
                    url: "https://i.pinimg.com/1200x/9b/7c/f5/9b7cf574cf3654894d4a8ab06f2e43ae.jpg",
                    proxy_url: "https://i.pinimg.com/1200x/9b/7c/f5/9b7cf574cf3654894d4a8ab06f2e43ae.jpg"
                },
                description: null,
                spoiler: false
            },
            components: [
                {
                    type: 10,
                    content: `# Corrección de datos\n¡Hola de nuevo <@!${userId}>!, *tu ficha ha sido revisada por el equipo de administración y antes de darle la bienvenida oficial, hay algunos detalles que me gustaría que ajustaras. ♡( ◡‿◡ )*`
                }
            ]
        }
    ];

    correcciones.forEach(c => {
        components.push({
            type: 14,
            divider: true,
            spacing: 1
        });
        components.push({
            type: 10,
            content: `### ${c.etiqueta || c.campo || "Campo"}\n-# Motivo: ${c.motivo || "Sin motivo especificado"}`
        });
    });

    components.push({
        type: 14,
        divider: true,
        spacing: 1
    })

    components.push({
        type: 10,
        content: "-# Para corregirlo, usa el comando `/rol configuración` y selecciona la opción \"Editar personaje\". Si tienes problemas al editar, puedes abrir una publicación en <#1319812744035438642>. y con gusto te ayudamos.\n\n-# Cuando termines, no olvides volver a enviar tu ficha para que pueda revisarla de nuevo. ¡Gracias por tu paciencia y dedicación! (✿◡‿◡)"
    });

    return [
        {
            type: 17,
            accent_color: 16759611,
            spoiler: false,
            components
        }
    ];
}

/**
 * Envía las correcciones al hilo del foro y aplica la etiqueta de cambios solicitados.
 *
 * @param {Object} params
 * @param {import('discord.js').Client} params.client
 * @param {Object} params.pj
 * @param {Array<Object>} params.correcciones
 * @returns {Promise<{ ok: boolean, hilo?: any, error?: string }>}
 */
async function solicitarCorreccionesHilo({ client, pj, correcciones }) {
    if (!pj.hiloId) {
        return { ok: false, error: "Esta ficha no tiene un hilo de revisión registrado en el foro." };
    }

    const hilo = await client.channels.fetch(pj.hiloId).catch(() => null);
    if (!hilo) {
        return { ok: false, error: `No se pudo acceder al hilo <#${pj.hiloId}>.` };
    }

    const componenteHilo = construirMensajeCorreccionesHilo(pj, correcciones);
    await hilo.send({
        components: componenteHilo,
        flags: ["IsComponentsV2"]
    });

    // Cambiar etiquetas del hilo a "cambios solicitados": 1545227893754306631
    await hilo.setAppliedTags([TAG_CAMBIOS_SOLICITADOS]).catch((e) => {
        console.error("Error al aplicar etiqueta de cambios solicitados al hilo:", e);
    });

    return { ok: true, hilo };
}

/**
 * Construye el ComponenteV2 para visualizar el detalle de una ficha seleccionada.
 *
 * @param {Object} pj - Documento del personaje de CachePJ
 * @param {string} userId - ID de Discord del staff que está revisando
 * @returns {Array<Object>} ComponenteV2
 */
function construirDetalleFicha(pj, userId) {
    const estadoRaw = pj?.status?.estado || "Pendiente";
    const estadoNormalizado = String(estadoRaw).toLowerCase().replace(/\s+/g, "_");
    const botonVerificarDisabled = estadoNormalizado === "solicita_cambio" || estadoNormalizado === "solicitacambio";

    const correcciones = Array.isArray(pj?.correcciones) ? pj.correcciones : [];
    const tieneCorregir = (id) => {
        const idLower = String(id || '').toLowerCase();
        return correcciones.some(c => {
            const cLower = String(c.campo || '').toLowerCase();
            return cLower === idLower || (MAPA_CAMPOS[cLower] && MAPA_CAMPOS[cLower].id.toLowerCase() === idLower);
        });
    };
    const tagCorregir = (id) => tieneCorregir(id) ? " `[Corregir]`" : "";

    const tagNombre = tagCorregir("nombre");
    const tagApodo = tagCorregir("apodo");
    const nombreApodo = `${pj?.nombre || "Desconocido"}${tagNombre}${pj?.apodo ? ` [${pj.apodo}]` : ""}${tagApodo}`;
    const hilo = pj?.hiloId ? `<#${pj.hiloId}>` : "No disponible";

    const tagFoto = (tieneCorregir("avatarURL") || tieneCorregir("foto")) ? "\n-# ⚠️ **Foto de perfil:** `[Corregir]`" : "";

    let resumenCorrecciones = "";
    if (correcciones.length > 0) {
        resumenCorrecciones = `-# **⚠️ Correcciones pendientes (${correcciones.length}):**\n` +
            correcciones.map(c => `-# • **${c.etiqueta || c.campo}:** ${c.motivo}`).join("\n");
    }

    const cabeceraTexto = (
        `-# **Ficha Seleccionada:** ${nombreApodo}\n` +
        `-# **Usuario:** <@!${pj?._id}>\n` +
        `-# **Estado:** \`${estadoRaw}\`\n` +
        `-# **Hilo de revisión:** ${hilo}` +
        `\n\n-# **Motivo:** ${pj?.status?.motivo || "No disponible"}`
    );

    const sexoPronombres = `${pj?.sexo || "** **"} ${pj?.pronombres ? `(${pj.pronombres})` : ""}`.trim() || "** **";
    const cumple = pj?.cumpleaños || (pj?.cumpleDia && pj?.cumpleMes ? `${String(pj.cumpleDia).padStart(2, '0')}/${String(pj.cumpleMes).padStart(2, '0')}` : "** **");
    const estatura = pj?.estatura ? `${pj.estatura}cm` : "** **";
    const peso = pj?.peso ? `${pj.peso}kg` : "** **";

    let infoTexto = (
        "## Información:\n\n" +
        `-# \`🎎\` **Sexo Biológico:** ${sexoPronombres}${tagCorregir("sexo")}\n` +
        `-# \`🍭\` **Edad:** ${pj?.edad || "** **"}${tagCorregir("edad")}\n` +
        `-# \`🎂\` **Cumple:** ${cumple}${tagCorregir("cumpleaños")}\n` +
        `-# \`🛫\` **C/Org:** ${pj?.ciudadOrg || "** **"}${tagCorregir("ciudadOrg")}\n` +
        `-# \`👑\` **Linaje Familiar:** ${pj?.familia || "** **"}${tagCorregir("familia")}\n` +
        `-# \`🎭\` **Personalidad:** ${pj?.personalidad || "** **"}${tagCorregir("personalidad")}\n` +
        `-# \`🏈\` **Especialidades:** ${pj?.especialidad || "** **"}${tagCorregir("especialidad")}\n\n` +
        `-# \`📏\` **Estatura:** ${estatura}${tagCorregir("estatura")}\n` +
        `-# \`🪨\` **Peso:** ${peso}${tagCorregir("peso")}`
    );

    if (tieneCorregir("historia")) {
        infoTexto += `\n-# \`📜\` **Historia:** \`[Corregir]\``;
    }

    const avatarUrl = pj?.avatarURL || "https://i.pinimg.com/736x/98/73/cd/9873cda69599c3949f70a1e66977856c.jpg";

    const componentesInternos = [
        {
            type: 9,
            accessory: {
                type: 11,
                media: {
                    url: avatarUrl,
                },
                description: null,
                spoiler: false
            },
            components: [
                {
                    type: 10,
                    content: "# Visualizando Ficha"
                },
                {
                    type: 10,
                    content: cabeceraTexto
                }
            ]
        }
    ];

    if (correcciones.length > 0) {
        componentesInternos.push(
            {
                type: 14,
                divider: true,
                spacing: 1
            },
            {
                type: 9,
                accessory: {
                    type: 2,
                    style: 2,
                    label: "Eliminar correcciones",
                    emoji: null,
                    disabled: false,
                    custom_id: crearCustomId({
                        action: "verificar_ficha",
                        userId: userId,
                        characterId: pj?._id,
                        extras: ["eliminar_correcciones", String(pj?._id)]
                    })
                },
                components: [
                    {
                        type: 10,
                        content: resumenCorrecciones
                    }
                ]
            }
        );
    }

    componentesInternos.push(
        {
            type: 14,
            divider: true,
            spacing: 1
        },
        {
            type: 9,
            accessory: {
                type: 2,
                style: 2,
                label: "Corregir Info.",
                emoji: null,
                disabled: false,
                custom_id: crearCustomId({
                    action: "verificar_ficha",
                    userId: userId,
                    characterId: pj?._id,
                    extras: ["corregir_info", String(pj?._id)]
                })
            },
            components: [
                {
                    type: 10,
                    content: infoTexto
                }
            ]
        },
        {
            type: 14,
            divider: true,
            spacing: 1
        },
        {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 3,
                    label: "Verificar",
                    emoji: null,
                    disabled: botonVerificarDisabled,
                    custom_id: crearCustomId({
                        action: "verificar_ficha",
                        userId: userId,
                        characterId: pj?._id,
                        extras: ["verificar", String(pj?._id)]
                    })
                },
                {
                    type: 2,
                    style: 4,
                    label: "Rechazar/Eliminar",
                    emoji: null,
                    disabled: false,
                    custom_id: crearCustomId({
                        action: "verificar_ficha",
                        userId: userId,
                        characterId: pj?._id,
                        extras: ["rechazar", String(pj?._id)]
                    })
                },
                {
                    type: 2,
                    style: 2,
                    label: "Regresar al menu",
                    emoji: null,
                    disabled: false,
                    custom_id: crearCustomId({
                        action: "verificar_ficha",
                        userId: userId,
                        characterId: pj?._id,
                        extras: ["regresar_menu", "1"]
                    })
                }
            ]
        }
    );

    return [
        {
            type: 17,
            accent_color: 13075967,
            spoiler: false,
            components: componentesInternos
        }
    ];
}

function normalizarCampo(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

/**
 * Comprueba si dos identificadores de campo representan el mismo dato de la ficha.
 *
 * @param {string} campo1 
 * @param {string} campo2 
 * @returns {boolean}
 */
function sonCamposEquivalentes(campo1, campo2) {
    if (!campo1 || !campo2) return false;
    const c1 = normalizarCampo(campo1);
    const c2 = normalizarCampo(campo2);
    if (c1 === c2) return true;

    const equivalencias = [
        ["ciudadorg", "ciudadorigen", "ciudad"],
        ["especialidad", "especialidades"],
        ["avatarurl", "foto", "fotoperfil", "avatar"],
        ["cumpleanos", "cumple", "cumpleanios"],
        ["familia", "apellido", "linajefamiliar"],
        ["sexo", "pronombres", "sexobiologico"]
    ];

    return equivalencias.some(grupo => {
        const g1 = grupo.some(x => normalizarCampo(x) === c1);
        const g2 = grupo.some(x => normalizarCampo(x) === c2);
        return g1 && g2;
    });
}

/**
 * Marca una corrección asignada como usada (consumo de permiso de 1 solo uso).
 *
 * @param {string} userId - ID del usuario propietario de la ficha
 * @param {string} campo - Nombre del campo editado
 * @returns {Promise<boolean>} Retorna true si se actualizó el permiso
 */
async function marcarCorreccionUsada(userId, campo) {
    if (!userId || !campo) return false;
    try {
        const pj = await Cachedb.findOne({ _id: userId });
        if (!pj || !Array.isArray(pj.correcciones) || pj.correcciones.length === 0) {
            return false;
        }

        let modificado = false;
        const correccionesActualizadas = pj.correcciones.map(c => {
            if (sonCamposEquivalentes(c.campo, campo) && !c.usado) {
                modificado = true;
                return {
                    ...c,
                    usado: true,
                    permisos: 0,
                    fechaUso: Date.now()
                };
            }
            return c;
        });

        if (modificado) {
            await Cachedb.updateOne(
                { _id: userId },
                { $set: { correcciones: correccionesActualizadas } }
            );
            return true;
        }
        return false;
    } catch (err) {
        console.error("Error en marcarCorreccionUsada:", err);
        return false;
    }
}

/**
 * Construye la interfaz de edición de ficha con correcciones para /rol configuracion.
 * Calca la estructura de previewCharacter de Crear ficha.js, integrando las correcciones solicitadas
 * y filtrando el StringSelectMenu para mostrar ÚNICAMENTE las opciones con permiso pendiente (1 solo uso).
 *
 * @param {Object} cachepj - Documento del personaje en CachePJ
 * @param {string} userId - ID del usuario de Discord
 * @returns {Array<Object>} ComponenteV2
 */
function construirEditorFichaCorreccion(cachepj, userId) {
    const Nombre = cachepj?.nombre || "**Tu nombre estara aqui**";
    const Apodo = cachepj?.apodo || "Sin apodo";
    const foto = cachepj?.avatarURL || "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/v1/Resources/unknowncharacter";
    const correcciones = Array.isArray(cachepj?.correcciones) ? cachepj.correcciones : [];

    const estadoCampo = (campo) => {
        const corr = correcciones.find(c => sonCamposEquivalentes(c.campo, campo));
        if (!corr) return null;
        return corr.usado ? "usado" : "pendiente";
    };

    const tagCorregir = (campo) => {
        const st = estadoCampo(campo);
        if (st === "pendiente") return " `[⚠️ Corregir]`";
        if (st === "usado") return " `[✅]`";
        return "";
    };

    const corrFoto = correcciones.find(c => sonCamposEquivalentes(c.campo, "avatarURL"));
    let botonFotoLabel = "Establecer foto";
    let botonFotoDisabled = true;

    if (corrFoto) {
        if (corrFoto.usado) {
            botonFotoLabel = "Foto corregida ✅";
            botonFotoDisabled = true;
        } else {
            botonFotoLabel = "Establecer foto [Corregir]";
            botonFotoDisabled = false;
        }
    }

    const tagNombre = tagCorregir("nombre");
    const tagApodo = tagCorregir("apodo");
    const nombreCompleto = `${Nombre}${tagNombre}${cachepj?.apodo ? ` [${Apodo}]` : ""}${tagApodo}`;

    const sexoPronombres = `${cachepj?.sexo || "** **"} ${cachepj?.pronombres ? `(${cachepj.pronombres})` : ""}`.trim() || "** **";
    const cumple = cachepj?.cumpleaños || (cachepj?.cumpleDia && cachepj?.cumpleMes ? `${String(cachepj.cumpleDia).padStart(2, '0')}/${String(cachepj.cumpleMes).padStart(2, '0')}` : "** **");
    const estatura = cachepj?.estatura ? `${cachepj.estatura}cm` : "** **";
    const peso = cachepj?.peso ? `${cachepj.peso}kg` : "** **";

    let infoTexto = (
        "# Información: \n" +
        `-# \`🎎\` **Sexo Biológico:** ${sexoPronombres}${tagCorregir("sexo")}\n` +
        `-# \`🍭\` **Edad:** ${cachepj?.edad || "** **"}${tagCorregir("edad")}\n` +
        `-# \`🎂\` **Cumple:** ${cumple}${tagCorregir("cumpleaños")}\n` +
        `-# \`🛫\` **C/Org:** ${cachepj?.ciudadOrg || "** **"}${tagCorregir("ciudadOrg")}\n` +
        `-# \`👑\` **Linaje Familiar:** ${cachepj?.familia || "** **"}${tagCorregir("familia")}\n` +
        `-# \`🎭\` **Personalidad:** ${cachepj?.personalidad || "** **"}${tagCorregir("personalidad")}\n` +
        `-# \`🏈\` **Especialidades:** ${cachepj?.especialidad || "** **"}${tagCorregir("especialidad")}\n\n` +
        `-# \`📏\` **Estatura:** ${estatura}${tagCorregir("estatura")}\n` +
        `-# \`🪨\` **Peso:** ${peso}${tagCorregir("peso")}`
    );

    if (estadoCampo("historia")) {
        infoTexto += `\n-# \`📜\` **Historia:**${tagCorregir("historia")}`;
    }

    // Resumen visual de correcciones
    let resumenCorrecciones = "### ⚠️ Correcciones solicitadas por Administración:\n";
    if (correcciones.length > 0) {
        resumenCorrecciones += correcciones.map(c => {
            const estadoIcon = c.usado ? "✅ Corregido" : "⚠️ Pendiente";
            return `-# • **${c.etiqueta || c.campo}:** ${c.motivo || "Sin motivo especificado"} — *(${estadoIcon})*`;
        }).join("\n");
    } else {
        resumenCorrecciones += "-# No se encontraron correcciones pendientes.";
    }

    const TODAS_LAS_OPCIONES = [
        { campo: "nombre", label: "» Nombre .ᐟ.ᐟ", value: "nombre", description: "El nombre de tu personaje" },
        { campo: "apodo", label: "» Apodo (opcional) .ᐟ.ᐟ", value: "apodo", description: "El apodo de tu personaje" },
        { campo: "sexo", label: "» Sexo & Pronombres .ᐟ.ᐟ", value: "sexo", description: "Sexo biológico y pronombres de tu personaje" },
        { campo: "edad", label: "» Edad .ᐟ.ᐟ", value: "edad", description: "La edad de tu personaje" },
        { campo: "cumpleaños", label: "» Cumpleaños .ᐟ.ᐟ", value: "cumpleaños", description: "Día de cumpleaños (DD/MM)" },
        { campo: "ciudadOrg", label: "» Ciudad de origen .ᐟ.ᐟ", value: "ciudadorg", description: "Ciudad en la que nació" },
        { campo: "familia", label: "» Linaje Familiar (opcional) .ᐟ.ᐟ", value: "apellido", description: "Apellido / Linaje familiar" },
        { campo: "personalidad", label: "» Personalidad .ᐟ.ᐟ", value: "personalidad", description: "Estructura MBTI" },
        { campo: "especialidad", label: "» Especialidades (opcional).ᐟ.ᐟ", value: "especialidades", description: "Actividades en las que es bueno" },
        { campo: "peso", label: "» Peso (opcional).ᐟ.ᐟ", value: "peso", description: "El peso de tu personaje (kg)" },
        { campo: "estatura", label: "» Estatura (opcional).ᐟ.ᐟ", value: "estatura", description: "Que tan alto o bajo es tu personaje" },
        { campo: "historia", label: "» Establecer historia (opcional)", value: "historia", description: "El trasfondo del personaje" },
        { campo: "aspiracion", label: "» Aspiración (opcional)", value: "aspiracion", description: "¿Cuál es tu propósito?" }
    ];

    // Opciones señaladas para la edición que tengan !c.usado
    const opcionesFiltradas = TODAS_LAS_OPCIONES.filter(opt => {
        return correcciones.some(c => sonCamposEquivalentes(c.campo, opt.campo) && !c.usado);
    });

    const todasCompletadas = correcciones.length > 0 && correcciones.every(c => c.usado);

    let componenteSelect;
    if (opcionesFiltradas.length > 0) {
        componenteSelect = {
            type: 1,
            components: [
                {
                    type: 3,
                    custom_id: crearCustomId({
                        action: "crear_ficha",
                        userId: userId
                    }),
                    options: opcionesFiltradas.map(opt => ({
                        label: opt.label,
                        value: opt.value,
                        description: opt.description,
                        emoji: null,
                        default: false
                    })),
                    placeholder: "Selecciona el campo a corregir (1 solo uso)",
                    min_values: 1,
                    max_values: 1,
                    disabled: false
                }
            ]
        };
    } else {
        componenteSelect = {
            type: 1,
            components: [
                {
                    type: 3,
                    custom_id: crearCustomId({
                        action: "crear_ficha",
                        userId: userId,
                        extras: ["notOpcion"]
                    }),
                    options: [
                        {
                            label: "¡Todas las correcciones completadas!",
                            value: "notOpcion",
                            description: "Ya has completado todos los cambios requeridos",
                            emoji: null,
                            default: false
                        }
                    ],
                    placeholder: "¡Todas las correcciones completadas!",
                    min_values: 1,
                    max_values: 1,
                    disabled: true
                }
            ]
        };
    }

    const componentes = [
        {
            type: 10,
            content: `<@!${userId}>`
        },
        {
            type: 17,
            accent_color: 16759611,
            spoiler: false,
            components: [
                {
                    type: 9,
                    accessory: {
                        type: 11,
                        media: {
                            url: foto
                        },
                        description: null,
                        spoiler: false
                    },
                    components: [
                        {
                            type: 10,
                            content: `# ${nombreCompleto}`
                        },
                        {
                            type: 10,
                            content: cachepj?.historia
                                ? "-# `Historia:`\n\n" + `${formatearTextoLim(cachepj.historia, 270)}`
                                : "-# `Historia:`\n-# *in rol / no establecida*"
                        }
                    ]
                },
                {
                    type: 9,
                    accessory: {
                        type: 2,
                        style: 2,
                        label: botonFotoLabel,
                        emoji: null,
                        disabled: botonFotoDisabled,
                        custom_id: crearCustomId({
                            action: "crear_ficha",
                            userId: userId,
                            extras: ["foto"]
                        })
                    },
                    components: [
                        {
                            type: 10,
                            content: "** **"
                        }
                    ]
                },
                {
                    type: 14,
                    divider: true,
                    spacing: 1
                },
                {
                    type: 10,
                    content: infoTexto
                },
                {
                    type: 14,
                    divider: true,
                    spacing: 1
                },
                {
                    type: 10,
                    content: resumenCorrecciones
                },
                {
                    type: 14,
                    divider: true,
                    spacing: 1
                },
                componenteSelect,
                {
                    type: 14,
                    divider: true,
                    spacing: 1
                },
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 3,
                            label: "Enviar ficha",
                            emoji: null,
                            disabled: !todasCompletadas,
                            custom_id: crearCustomId({
                                action: "crear_ficha",
                                userId: userId,
                                extras: ["enviar_ficha_corregida"]
                            })
                        }
                    ]
                }
            ]
        }
    ];

    return componentes;
}

module.exports = crearStringSelectMenu({
    customId: "verificar_ficha",
    soloAutor: true,

    ejecutar: async ({ client, interaction }) => {
        const userIdSeleccionado = interaction.values?.[0];
        if (!userIdSeleccionado || userIdSeleccionado === "ninguna") {
            return interaction.deferUpdate().catch(() => { });
        }

        const pj = await Cachedb.findOne({ _id: userIdSeleccionado });
        if (!pj) {
            return interaction.reply({
                content: "No se encontró la ficha seleccionada en la base de datos.",
                flags: ["Ephemeral"]
            });
        }

        const components = construirDetalleFicha(pj, interaction.user.id);
        return await interaction.update({ components });
    },

    construirDetalleFicha,
    construirMensajeCorreccionesHilo,
    construirMensajeRechazoMD,
    solicitarCorreccionesHilo,
    construirEditorFichaCorreccion,
    marcarCorreccionUsada,
    sonCamposEquivalentes,
    TAG_RECHAZO,
    TAG_CAMBIOS_SOLICITADOS,
    TAG_PENDIENTE,
    TAG_VERIFICADO,
    MAPA_CAMPOS
});
