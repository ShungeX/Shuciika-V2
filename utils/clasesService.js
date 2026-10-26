const { generarPayloadDocenteFinalizada } = require('../data/UI_ComponentsV2/notificacionDocente');
const {
    guardarYFinalizarSesion,
    evaluarParticipacionClase
} = require('../functions/clases/evaluadorClases');

/**
 * Elimina el rol temporal de Discord asociado a la clase y actualiza la bandera en MongoDB.
 * @param {import('discord.js').Client} client 
 * @param {import('mongodb').Db} dbRol 
 * @param {Object} clase 
 */
async function eliminarRolClase(client, dbRol, clase) {
    if (!clase?.discordRoleId) return;
    try {
        let guild = null;
        if (clase.salonId && client?.channels) {
            const canal = client.channels.cache.get(clase.salonId) || await client.channels.fetch(clase.salonId).catch(() => null);
            if (canal) guild = canal.guild;
        }
        if (!guild && client?.guilds) {
            guild = client.guilds.cache.first();
        }

        let eliminado = false;
        if (guild) {
            const role = await guild.roles.fetch(clase.discordRoleId).catch(() => null);
            if (role) {
                await role.delete(`Limpieza de rol temporal por finalización de clase ${clase._id}`).catch((err) => {
                    console.warn(`[clasesService] Error al borrar rol ${clase.discordRoleId}:`, err.message);
                });
                eliminado = true;
                console.log(`[clasesService] Rol temporal ${clase.discordRoleId} eliminado para la clase ${clase._id}`);
            } else {
                eliminado = true; // Ya no existía en Discord
            }
        }

        if (dbRol) {
            await dbRol.collection("Clases").updateOne(
                { _id: clase._id },
                { $set: { rolEliminado: eliminado } }
            );
        }
    } catch (err) {
        console.error(`[clasesService] Error en eliminarRolClase (${clase._id}):`, err.message);
    }
}

/**
 * Calcula la penalización y bolsa de compensación según la sección 13 del documento de diseño.
 */
function calcularPenalizacion(saldoReferencia, numInscritos) {
    let pct = 0.03;
    let cap = 150;
    if (numInscritos >= 15) {
        pct = 0.05;
        cap = 500;
    } else if (numInscritos >= 10) {
        pct = 0.04;
        cap = 300;
    }
    const penalizacionCalculada = Math.min(Math.floor(saldoReferencia * pct), cap);
    const bolsa = numInscritos > 0 ? Math.max(100, penalizacionCalculada) : 0;
    const aporteServidor = Math.max(0, bolsa - penalizacionCalculada);

    return {
        penalizacion: penalizacionCalculada,
        bolsa,
        aporteServidor
    };
}

/**
 * Finaliza una clase formalmente o anticipadamente:
 * 1. Hace el guardado final obligatorio de agregados a Mongo antes del cálculo.
 * 2. Evalúa la participación (profesor válido, alumnos válidos por ventanas y puntos).
 * 3. Determina validez de la clase, factor de duración, bono y liquidación de pago.
 * 4. Acredita Lumens al docente y recompensas únicamente a alumnos válidos.
 * 5. Libera el salón, bloquea el hilo, borra el rol temporal y actualiza el MD del docente.
 */
async function finalizarClase({ client, dbRol, dbServer, claseId, finalizadoPorProfesor = false, interaction = null }) {
    const clasesCol = dbRol.collection("Clases");
    const personajesCol = dbRol.collection("Personajes");
    const configColl = dbServer.collection("config");

    const clase = await clasesCol.findOne({ _id: String(claseId) });
    if (!clase) {
        return { error: "Clase no encontrada" };
    }

    if (clase.estado === 'cerrada' || clase.estado === 'invalida' || clase.estado === 'no_presentada' || clase.estado === 'cancelada') {
        return { yaFinalizada: true, clase };
    }

    const ahora = new Date();
    const ahoraMs = ahora.getTime();

    // 1. Guardado final de agregados en memoria a Mongo ANTES de evaluar la paga
    const evaluacionFinal = await guardarYFinalizarSesion(clase._id, dbRol);

    // 2. Duraciones
    const inicioRealMs = clase.inicioReal ? new Date(clase.inicioReal).getTime() : new Date(clase.inicioProgramado).getTime();
    const duracionRealMin = Math.max(0, Math.round((ahoraMs - inicioRealMs) / 60000));

    const inicioProgMs = new Date(clase.inicioProgramado).getTime();
    const finProgMs = new Date(clase.finProgramado).getTime();
    const duracionProgMin = clase.duracionMinutos || Math.max(1, Math.round((finProgMs - inicioProgMs) / 60000));

    // 3. Evaluación de participación y validez de la clase
    const evaluacionRes = evaluarParticipacionClase({
        clase,
        evaluacion: evaluacionFinal,
        duracionRealMin,
        duracionProgramadaMin: duracionProgMin
    });

    const nuevoEstado = evaluacionRes.claseValida ? 'cerrada' : 'invalida';
    const pagoTotal = evaluacionRes.pagoTotal || 0;

    // 4. Actualización atómica en MongoDB
    const resUpdate = await clasesCol.updateOne(
        { _id: clase._id, estado: { $nin: ['cerrada', 'invalida', 'cancelada', 'no_presentada'] } },
        {
            $set: {
                estado: nuevoEstado,
                finReal: ahora.toISOString(),
                pago: {
                    base: evaluacionRes.base,
                    factorDuracion: evaluacionRes.factorDuracion,
                    bono: evaluacionRes.bono,
                    factorRepeticion: evaluacionRes.factorRepeticion,
                    total: pagoTotal,
                    invalida: !evaluacionRes.claseValida,
                    motivoInvalida: evaluacionRes.razonInvalida || null
                },
                evaluacionResumen: {
                    profesor: evaluacionRes.profesor,
                    totalAlumnosValidos: evaluacionRes.totalAlumnosValidos,
                    alumnosValidos: evaluacionRes.alumnosValidos,
                    alumnosEvaluados: evaluacionRes.alumnosEvaluados
                },
                finalizadoPorProfesor: Boolean(finalizadoPorProfesor)
            }
        }
    );

    if (resUpdate.modifiedCount === 0) {
        return { yaFinalizada: true, clase };
    }

    console.log(`[clasesService] Clase ${clase._id} ("${clase.titulo}") finalizada como ${nuevoEstado}. Duración: ${duracionRealMin} min. Alumnos válidos: ${evaluacionRes.totalAlumnosValidos}. Pago docente: ${pagoTotal} Lumens.`);

    // 5. Pagar al profesor y liquidar deuda si la hubiera
    if (evaluacionRes.claseValida && pagoTotal > 0 && clase.profesorId) {
        try {
            const profeChar = await personajesCol.findOne({ _id: clase.profesorId });
            const deudaActual = profeChar?.economia?.deuda || 0;
            if (deudaActual > 0) {
                if (pagoTotal >= deudaActual) {
                    const sobrante = pagoTotal - deudaActual;
                    await personajesCol.updateOne(
                        { _id: clase.profesorId },
                        {
                            $set: { "economia.deuda": 0 },
                            $inc: { "economia.Lumens": sobrante, "estado.Reputacion": 2 }
                        }
                    );
                } else {
                    await personajesCol.updateOne(
                        { _id: clase.profesorId },
                        {
                            $inc: { "economia.deuda": -pagoTotal, "estado.Reputacion": 2 }
                        }
                    );
                }
            } else {
                await personajesCol.updateOne(
                    { _id: clase.profesorId },
                    {
                        $inc: { "economia.Lumens": pagoTotal, "estado.Reputacion": 2 }
                    }
                );
            }
        } catch (errPago) {
            console.error("[clasesService] Error procesando pago del profesor:", errPago);
        }
    } else if (!evaluacionRes.claseValida && clase.profesorId && !evaluacionRes.profesor.valido) {
        // Si el profesor no cumplió su participación mínima, sanción leve de reputación
        try {
            await personajesCol.updateOne(
                { _id: clase.profesorId },
                { $inc: { "estado.Reputacion": -5 } }
            );
        } catch (errRep) {}
    }

    // 6. Recompensas a alumnos (únicamente a los alumnos que cumplieron participación válida)
    if (evaluacionRes.claseValida && evaluacionRes.alumnosValidos.length > 0) {
        const recompensas = clase.recompensas || { gradoPuntos: 3, fragmentoEstelar: 1 };
        for (const alumno of evaluacionRes.alumnosValidos) {
            try {
                const charId = alumno.personajeId;
                const userId = alumno.userId;
                const filter = charId ? { _id: charId } : { userId: String(userId), activo: true };

                await personajesCol.updateOne(filter, {
                    $inc: {
                        "instituto.gradoPuntos": recompensas.gradoPuntos || 3,
                        "inventario.fragmentoEstelar": recompensas.fragmentoEstelar || 1
                    }
                });
            } catch (errIns) {
                console.error("[clasesService] Error otorgando recompensa a alumno válido:", errIns);
            }
        }
    }

    // 7. Actualizar el estado en personajes.instituto.clases para los alumnos inscritos
    if (Array.isArray(clase.inscritos) && clase.inscritos.length > 0) {
        for (const ins of clase.inscritos) {
            try {
                const uid = String(ins.userId || ins);
                const fueValido = evaluacionRes.alumnosValidos.some(v => String(v.userId) === uid);
                const estadoAlumno = fueValido ? 'completada' : 'incompleta';

                const charFilter = ins.personajeId ? { _id: ins.personajeId } : { userId: uid, activo: true };
                await personajesCol.updateOne(
                    { ...charFilter, "instituto.clases.claseId": clase._id },
                    { $set: { "instituto.clases.$.estado": estadoAlumno } }
                );
            } catch (errHist) {}
        }
    }

    // 8. Bloquear hilo del salón y archivar
    if (clase.salonId && client?.channels) {
        try {
            const thread = client.channels.cache.get(clase.salonId) || await client.channels.fetch(clase.salonId).catch(() => null);
            if (thread) {
                const motivoTexto = finalizadoPorProfesor
                    ? `🔔 **Clase finalizada:** El docente ha concluido la sesión de **${clase.titulo}** anticipadamente.`
                    : `🔔 **Clase finalizada:** La sesión de **${clase.titulo}** ha concluido al llegar su hora de fin programada.`;

                const detalleTexto = evaluacionRes.claseValida
                    ? `✨ **Sesión completada:** Duración de **${duracionRealMin} minutos** (${evaluacionRes.totalVentanas} ventanas). ${evaluacionRes.totalAlumnosValidos} alumno(s) alcanzaron participación válida y recibieron sus recompensas.`
                    : `⚠️ **Sesión registrada como inválida:** ${evaluacionRes.razonInvalida}.`;

                await thread.send({
                    content: `${motivoTexto}\n${detalleTexto}`
                }).catch(() => null);

                if (thread.isThread && thread.isThread()) {
                    await thread.setLocked(true).catch(() => null);
                    await thread.setArchived(true).catch(() => null);
                }
            }
        } catch (errHilo) {
            console.error("[clasesService] Error bloqueando hilo del salón:", errHilo.message);
        }
    }

    // 9. Liberar el ID del salón ocupado
    if (clase.salonId && configColl) {
        try {
            await configColl.updateOne(
                { _id: "rol" },
                {
                    $pull: { salonesOcupados: String(clase.salonId) },
                    $addToSet: { salonesDisponibles: String(clase.salonId) }
                }
            );
        } catch (errSalon) {
            console.error("[clasesService] Error liberando salón ocupado:", errSalon.message);
        }
    }

    // 10. Eliminar el rol temporal de Discord
    await eliminarRolClase(client, dbRol, clase);

    // 11. Actualizar mensaje en MD del docente (modificando el mensaje existente guardado para evitar spam)
    const salonChan = client?.channels?.cache?.get(clase.salonId);
    const guildId = salonChan?.guildId || salonChan?.guild?.id || client?.guilds?.cache?.first()?.id || "channels";
    const salonUrl = `https://discord.com/channels/${guildId}/${clase.salonId}`;
    const payloadFinal = generarPayloadDocenteFinalizada(clase, duracionRealMin, pagoTotal, salonUrl, {
        invalida: !evaluacionRes.claseValida,
        razonInvalida: evaluacionRes.razonInvalida,
        totalVentanas: evaluacionRes.totalVentanas,
        totalAlumnosValidos: evaluacionRes.totalAlumnosValidos
    });

    if (interaction?.message && payloadFinal) {
        try {
            await interaction.message.edit({ components: payloadFinal, flags: ["IsComponentsV2"] });
        } catch (e) {
            try {
                if (interaction.isRepliable && interaction.isRepliable()) {
                    await interaction.editReply({ components: payloadFinal, flags: ["IsComponentsV2"] }).catch(() => null);
                }
            } catch (errEdit) {}
        }
    } else if (clase.docenteMensajeId && client?.users && payloadFinal) {
        try {
            const docenteUser = client.users.cache.get(clase.profesorUserId) || await client.users.fetch(clase.profesorUserId).catch(() => null);
            if (docenteUser) {
                const dm = docenteUser.dmChannel || await docenteUser.createDM();
                const msg = await dm.messages.fetch(clase.docenteMensajeId).catch(() => null);
                if (msg) {
                    await msg.edit({ components: payloadFinal, flags: ["IsComponentsV2"] }).catch(() => null);
                    console.log(`[clasesService] Mensaje MD del docente (${clase.docenteMensajeId}) actualizado con resumen de clase.`);
                }
            }
        } catch (errDm) {
            console.warn("[clasesService] No se pudo editar el mensaje de MD del docente al finalizar:", errDm.message);
        }
    }

    return {
        success: true,
        duracionRealMin,
        duracionProgMin,
        pagoTotal,
        invalida: !evaluacionRes.claseValida,
        razonInvalida: evaluacionRes.razonInvalida,
        totalAlumnosValidos: evaluacionRes.totalAlumnosValidos,
        alumnosValidos: evaluacionRes.alumnosValidos
    };
}

module.exports = {
    eliminarRolClase,
    calcularPenalizacion,
    finalizarClase
};
