const clientdb = require('../../Server');
const { crearCustomId } = require('../../utils/constructores/customId');
const {
    eliminarRolClase,
    calcularPenalizacion,
    finalizarClase
} = require('../../utils/clasesService');
const {
    volcarSesionesAMongo,
    reconstruirSesionesDesdeDB
} = require('../../functions/clases/evaluadorClases');

// Cargar plantillas de UI Components V2
let plantillaMismoDia;
try {
    plantillaMismoDia = require('../../data/UI_ComponentsV2/notificaciónClases.js');
} catch (e) {
    try {
        plantillaMismoDia = require('../../data/UI_ComponentsV2/notificacionClases.js');
    } catch (err) {
        console.error("[verificadorClases] Error cargando plantilla de notificación de clases:", err.message);
    }
}

const {
    generarPayloadDocente30,
    generarPayloadAsistenciaDocente
} = require('../../data/UI_ComponentsV2/notificacionDocente.js');

const HILO_NOTIFICACIONES_ID = "1562184724032659536";

/**
 * Comprueba si dos fechas corresponden al mismo día natural en la zona horaria de México (UTC-6).
 */
function esMismoDiaMexico(fechaA, fechaB) {
    try {
        const formateador = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Mexico_City',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        return formateador.format(fechaA) === formateador.format(fechaB);
    } catch {
        return fechaA.toDateString() === fechaB.toDateString();
    }
}

/**
 * Genera el payload de UI Components V2 para el recordatorio del mismo día.
 */
function generarPayloadMismoDia(clase) {
    if (!plantillaMismoDia) return null;
    const root = JSON.parse(JSON.stringify(plantillaMismoDia));
    const inicioSec = Math.floor(new Date(clase.inicioProgramado).getTime() / 1000);

    try {
        const textComp = root[0].components[0].components[1];
        textComp.content = textComp.content
            .replace('{Título de la clase}', clase.titulo || 'Clase de la Academia')
            .replace('TIMESTAMP', String(inicioSec))
            .replace('{Profesor.id}', `<@${clase.profesorUserId}>`)
            .replace('{#salon}', `<#${clase.salonId}>`);
    } catch (err) {
        console.error("[verificadorClases] Error formateando plantillaMismoDia:", err.message);
    }

    return root;
}

/**
 * Módulo principal del evento clientReady.
 */
module.exports = async (client) => {
    let tickEnEjecucion = false;

    const ejecutarTick = async () => {
        if (tickEnEjecucion) return;
        tickEnEjecucion = true;

        try {
            const dbRol = clientdb.db("Rol_db");
            const dbServer = clientdb.db("Server_db");
            const clasesCol = dbRol.collection("Clases");
            const configColl = dbServer.collection("config");
            const personajesCol = dbRol.collection("Personajes");

            const ahora = new Date();
            const ahoraMs = ahora.getTime();

            // Volcar agregados en memoria de clases activas a MongoDB (copia de seguridad cada 60s)
            await volcarSesionesAMongo(dbRol).catch(err => {
                console.error("[verificadorClases] Error en volcado de agregados:", err.message);
            });

            // Limpieza de roles de Discord pendientes para clases finalizadas/canceladas (resiliencia ante caídas)
            const clasesConRolPendiente = await clasesCol.find({
                estado: { $in: ['cerrada', 'no_presentada', 'cancelada', 'invalida'] },
                discordRoleId: { $exists: true, $ne: null },
                rolEliminado: { $ne: true }
            }).toArray();

            for (const c of clasesConRolPendiente) {
                await eliminarRolClase(client, dbRol, c);
            }

            // Buscar clases activas (programada o en_curso)
            const clasesActivas = await clasesCol.find({
                estado: { $in: ['programada', 'en_curso'] }
            }).toArray();

            for (const clase of clasesActivas) {
                const inicioMs = new Date(clase.inicioProgramado).getTime();
                const finMs = new Date(clase.finProgramado).getTime();
                const diffInicioMs = inicioMs - ahoraMs;

                // -------------------------------------------------------------
                // 1. RECORDATORIO DEL MISMO DÍA (Canal de notificaciones / Hilo)
                // -------------------------------------------------------------
                if (clase.estado === 'programada' && !clase.avisos?.mismoDia) {
                    const fechaInicio = new Date(clase.inicioProgramado);
                    const esHoy = esMismoDiaMexico(ahora, fechaInicio);

                    // Si es el mismo día y la clase aún no ha comenzado (mínimo más de 30m para cancelar)
                    if (esHoy && diffInicioMs > 0) {
                        const resUpdate = await clasesCol.updateOne(
                            { _id: clase._id, "avisos.mismoDia": { $ne: true }, estado: 'programada' },
                            { $set: { "avisos.mismoDia": true } }
                        );

                        if (resUpdate.modifiedCount > 0) {
                            try {
                                const hilo = client.channels.cache.get(HILO_NOTIFICACIONES_ID) ||
                                             await client.channels.fetch(HILO_NOTIFICACIONES_ID).catch(() => null);
                                if (hilo) {
                                    const components = generarPayloadMismoDia(clase);
                                    if (components) {
                                        await hilo.send({ components, flags: ["IsComponentsV2"] });
                                        console.log(`[verificadorClases] Recordatorio mismo día enviado para la clase "${clase.titulo}"`);
                                    }
                                }
                            } catch (errMismoDia) {
                                console.error(`[verificadorClases] Error enviando recordatorio del mismo día (${clase._id}):`, errMismoDia.message);
                            }
                        }
                    }
                }

                // -------------------------------------------------------------
                // 2. RECORDATORIO DE 30 MINUTOS AL PROFESOR EN MD
                // -------------------------------------------------------------
                if (clase.estado === 'programada' && !clase.avisos?.profe30) {
                    if (diffInicioMs <= 30 * 60 * 1000 && diffInicioMs > 0) {
                        const resUpdate = await clasesCol.updateOne(
                            { _id: clase._id, "avisos.profe30": { $ne: true }, estado: 'programada' },
                            { $set: { "avisos.profe30": true } }
                        );

                        if (resUpdate.modifiedCount > 0) {
                            try {
                                const docenteUser = client.users.cache.get(clase.profesorUserId) ||
                                                    await client.users.fetch(clase.profesorUserId).catch(() => null);
                                if (docenteUser) {
                                    const components = generarPayloadDocente30(clase);
                                    if (components) {
                                        const dmChannel = docenteUser.dmChannel || await docenteUser.createDM();
                                        let msgEnviado = null;

                                        // Si ya existía un mensaje previo (por ejemplo aviso previo), intentar editarlo
                                        if (clase.docenteMensajeId) {
                                            try {
                                                const msgPrevio = await dmChannel.messages.fetch(clase.docenteMensajeId).catch(() => null);
                                                if (msgPrevio) {
                                                    await msgPrevio.edit({ components, flags: ["IsComponentsV2"] });
                                                    msgEnviado = msgPrevio;
                                                }
                                            } catch (e) {
                                                msgEnviado = null;
                                            }
                                        }

                                        // Si no existía, enviar el primer mensaje y almacenar su ID en DB para modificarlo después
                                        if (!msgEnviado) {
                                            msgEnviado = await dmChannel.send({ components, flags: ["IsComponentsV2"] });
                                            await clasesCol.updateOne(
                                                { _id: clase._id },
                                                { $set: { docenteMensajeId: msgEnviado.id, docenteDmChannelId: dmChannel.id } }
                                            );
                                        }
                                        console.log(`[verificadorClases] Recordatorio 30m enviado/actualizado a docente (${clase.profesorUserId}), msgId: ${msgEnviado.id}`);
                                    }
                                }
                            } catch (errProfe30) {
                                console.error(`[verificadorClases] Error enviando MD de 30m al docente (${clase.profesorUserId}):`, errProfe30.message);
                            }
                        }
                    }
                }

                // -------------------------------------------------------------
                // 3. ÚLTIMO RECORDATORIO (1 MINUTO ANTES) AL PROFESOR EN MD
                // -------------------------------------------------------------
                if (clase.estado === 'programada' && !clase.avisos?.profe1) {
                    if (diffInicioMs <= 1 * 60 * 1000 && diffInicioMs > -15 * 60 * 1000) {
                        const resUpdate = await clasesCol.updateOne(
                            { _id: clase._id, "avisos.profe1": { $ne: true }, estado: 'programada' },
                            { $set: { "avisos.profe1": true } }
                        );

                        if (resUpdate.modifiedCount > 0) {
                            try {
                                const docenteUser = client.users.cache.get(clase.profesorUserId) ||
                                                    await client.users.fetch(clase.profesorUserId).catch(() => null);
                                if (docenteUser) {
                                    // Consultar saldo actual del profesor para estimar penalización X
                                    const profeChar = await personajesCol.findOne({ _id: clase.profesorId });
                                    const saldoActual = profeChar?.economia?.Lumens ?? 0;
                                    const saldoRef = Math.max(clase.saldoAlCrear || 0, saldoActual);
                                    const numInscritos = Array.isArray(clase.inscritos) ? clase.inscritos.length : 0;
                                    const { penalizacion } = calcularPenalizacion(saldoRef, numInscritos);

                                    const customId = crearCustomId({
                                        action: "asistencia_docente",
                                        userId: String(clase.profesorUserId),
                                        characterId: String(clase.profesorId || ""),
                                        extras: [String(clase._id)]
                                    });

                                    const salonChan = client.channels.cache.get(clase.salonId);
                                    const guildId = salonChan?.guildId || salonChan?.guild?.id || client.guilds.cache.first()?.id || "channels";
                                    const salonUrl = `https://discord.com/channels/${guildId}/${clase.salonId}`;

                                    const components = generarPayloadAsistenciaDocente(clase, penalizacion, customId, salonUrl);
                                    if (components) {
                                        const dmChannel = docenteUser.dmChannel || await docenteUser.createDM();
                                        let msgEnviado = null;

                                        // Reutilizar el mensaje original guardado para evitar saturar de spam el MD
                                        if (clase.docenteMensajeId) {
                                            try {
                                                const msgPrevio = await dmChannel.messages.fetch(clase.docenteMensajeId).catch(() => null);
                                                if (msgPrevio) {
                                                    await msgPrevio.edit({ components, flags: ["IsComponentsV2"] });
                                                    msgEnviado = msgPrevio;
                                                    console.log(`[verificadorClases] Mensaje MD previo (${clase.docenteMensajeId}) editado con asistencia para docente (${clase.profesorUserId})`);
                                                }
                                            } catch (e) {
                                                msgEnviado = null;
                                            }
                                        }

                                        // Si no existía mensaje previo, enviar uno nuevo y almacenar su ID
                                        if (!msgEnviado) {
                                            msgEnviado = await dmChannel.send({ components, flags: ["IsComponentsV2"] });
                                            await clasesCol.updateOne(
                                                { _id: clase._id },
                                                { $set: { docenteMensajeId: msgEnviado.id, docenteDmChannelId: dmChannel.id } }
                                            );
                                            console.log(`[verificadorClases] Recordatorio 1m enviado como nuevo a docente (${clase.profesorUserId}), msgId: ${msgEnviado.id}`);
                                        }
                                    }
                                }
                            } catch (errProfe1) {
                                console.error(`[verificadorClases] Error enviando MD de 1m al docente (${clase.profesorUserId}):`, errProfe1.message);
                            }
                        }
                    }
                }

                // -------------------------------------------------------------
                // 4. [SI NO ASISTE] EXPIRAR A NO PRESENTADA A LOS 15 MINUTOS
                // -------------------------------------------------------------
                if (clase.estado === 'programada' && !clase.asistenciaConfirmada) {
                    if (ahoraMs >= inicioMs + 15 * 60 * 1000) {
                        const resUpdate = await clasesCol.updateOne(
                            { _id: clase._id, estado: 'programada', asistenciaConfirmada: { $ne: true } },
                            {
                                $set: {
                                    estado: 'no_presentada',
                                    expiradaEn: ahora.toISOString()
                                }
                            }
                        );

                        if (resUpdate.modifiedCount > 0) {
                            console.log(`[verificadorClases] Clase ${clase._id} ("${clase.titulo}") expirada a "no_presentada". Aplicando sanciones.`);

                            try {
                                // 1. Calcular compensaciones y sanciones
                                const profeChar = await personajesCol.findOne({ _id: clase.profesorId });
                                const saldoActual = profeChar?.economia?.Lumens ?? 0;
                                const saldoRef = Math.max(clase.saldoAlCrear || 0, saldoActual);
                                const numInscritos = Array.isArray(clase.inscritos) ? clase.inscritos.length : 0;
                                const { penalizacion, bolsa, aporteServidor } = calcularPenalizacion(saldoRef, numInscritos);

                                let deudaGenerada = 0;
                                let aCobrar = penalizacion;

                                if (saldoActual >= aCobrar) {
                                    await personajesCol.updateOne(
                                        { _id: clase.profesorId },
                                        { $inc: { "economia.Lumens": -aCobrar } }
                                    );
                                } else {
                                    deudaGenerada = aCobrar - saldoActual;
                                    await personajesCol.updateOne(
                                        { _id: clase.profesorId },
                                        {
                                            $set: { "economia.Lumens": 0 },
                                            $inc: { "economia.deuda": deudaGenerada }
                                        }
                                    );
                                }

                                // Sanción de reputación (-10 en estado.Reputacion)
                                await personajesCol.updateOne(
                                    { _id: clase.profesorId },
                                    { $inc: { "estado.Reputacion": -10 } }
                                );

                                // Compensación a los inscritos / esperando
                                const presentes = (Array.isArray(clase.esperando) && clase.esperando.length > 0)
                                    ? clase.esperando
                                    : (clase.inscritos || []).map(ins => ins.userId || ins);
                                const cantPresentes = presentes.length;
                                let porAlumno = 0;

                                if (cantPresentes > 0 && bolsa > 0) {
                                    porAlumno = Math.min(Math.floor(bolsa / cantPresentes), 40);
                                    for (const stId of presentes) {
                                        await personajesCol.updateOne(
                                            { userId: String(stId), activo: true },
                                            { $inc: { "economia.Lumens": porAlumno } }
                                        );
                                    }
                                }

                                // Registrar desglose en la clase
                                await clasesCol.updateOne(
                                    { _id: clase._id },
                                    {
                                        $set: {
                                            compensacion: {
                                                penalizacion: aCobrar,
                                                deudaGenerada,
                                                bolsa,
                                                aporteServidor,
                                                porAlumno,
                                                cantPresentes
                                            }
                                        }
                                    }
                                );

                                // 2. Bloquear hilo del salón y archivar
                                if (clase.salonId && client.channels) {
                                    try {
                                        const thread = client.channels.cache.get(clase.salonId) ||
                                                       await client.channels.fetch(clase.salonId).catch(() => null);
                                        if (thread) {
                                            await thread.send({
                                                content: `🔒 **Clase no presentada:** La clase **${clase.titulo}** ha expirado a los 15 minutos porque el docente no se presentó.\nSe han aplicado las compensaciones correspondientes a los alumnos y este salón ha sido liberado.`
                                            }).catch(() => null);

                                            if (thread.isThread && thread.isThread()) {
                                                await thread.setLocked(true).catch(() => null);
                                                await thread.setArchived(true).catch(() => null);
                                            }
                                        }
                                    } catch (errHilo) {
                                        console.error("[verificadorClases] Error bloqueando hilo no presentado:", errHilo.message);
                                    }
                                }

                                // 3. Liberar el ID del salón ocupado
                                if (clase.salonId) {
                                    await configColl.updateOne(
                                        { _id: "rol" },
                                        {
                                            $pull: { salonesOcupados: String(clase.salonId) },
                                            $addToSet: { salonesDisponibles: String(clase.salonId) }
                                        }
                                    );
                                }

                                // 4. Eliminar rol de Discord temporal
                                await eliminarRolClase(client, dbRol, clase);

                                // 5. Actualizar el MD del docente para deshabilitar botón y reflejar expiración
                                if (clase.docenteMensajeId && client.users) {
                                    try {
                                        const docenteUser = client.users.cache.get(clase.profesorUserId) || await client.users.fetch(clase.profesorUserId).catch(() => null);
                                        if (docenteUser) {
                                            const dm = docenteUser.dmChannel || await docenteUser.createDM();
                                            const msg = await dm.messages.fetch(clase.docenteMensajeId).catch(() => null);
                                            if (msg) {
                                                await msg.edit({
                                                    content: `⌛ **Clase no presentada:** La clase **${clase.titulo}** ha expirado tras los 15 minutos de gracia por inasistencia. Se han aplicado las sanciones correspondientes.`,
                                                    components: []
                                                }).catch(() => null);
                                            }
                                        }
                                    } catch (errDmExpirada) {}
                                }
                            } catch (errSancion) {
                                console.error(`[verificadorClases] Error procesando sanciones de no_presentada (${clase._id}):`, errSancion);
                            }
                        }
                    }
                }

                // -------------------------------------------------------------
                // 5. CERRAR LA CLASE A LA HORA DE FIN PROGRAMADA
                // -------------------------------------------------------------
                if (clase.estado === 'en_curso') {
                    if (ahoraMs >= finMs) {
                        console.log(`[verificadorClases] Clase ${clase._id} ("${clase.titulo}") alcanzada hora de fin programada. Finalizando.`);
                        await finalizarClase({
                            client,
                            dbRol,
                            dbServer,
                            claseId: clase._id,
                            finalizadoPorProfesor: false
                        });
                    }
                }
            }
        } catch (errTick) {
            console.error("[verificadorClases] Error en el ciclo de verificación:", errTick);
        } finally {
            tickEnEjecucion = false;
        }
    };

    const iniciarIntervalo = async () => {
        console.log("⏱️ [verificadorClases] Ticker de clases iniciado (cada 60s).");
        // Reconstruir en memoria las clases en curso tras reinicio del bot
        try {
            const dbRol = clientdb.db("Rol_db");
            await reconstruirSesionesDesdeDB(dbRol);
        } catch (errRec) {
            console.error("[verificadorClases] Error reconstruyendo sesiones en arranque:", errRec.message);
        }

        // Ejecutar una primera pasada al iniciar para atrapar eventos atrasados
        ejecutarTick().catch(() => {});
        setInterval(ejecutarTick, 60000);
    };

    if (client.listo) {
        iniciarIntervalo();
    } else {
        client.once('cargaCompleta', iniciarIntervalo);
    }
};
