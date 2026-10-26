/**
 * evaluadorClases.js
 * 
 * Sistema de evaluación y puntuación en vivo para clases del Instituto Mágico Shuciika.
 * Los mensajes se puntúan en memoria en tiempo real (microsegundos por mensaje)
 * y se vuelcan a MongoDB periódicamente como copia de seguridad.
 * 
 * NOTA DE DISEÑO:
 * No se almacenan los textos de los mensajes para evitar saturación de memoria
 * y base de datos con un alto volumen de usuarios. Únicamente se acumulan los
 * puntos por usuario y por ventana temporal de 5 minutos.
 */

// Map en memoria: channelId / threadId -> EstadoSesion
const sesiones = new Map();

/**
 * Limpia menciones, URLs, emojis de Discord y caracteres especiales para medir caracteres útiles.
 */
function limpiarTextoUtil(rawContent) {
    if (!rawContent || typeof rawContent !== 'string') return "";
    let t = rawContent.trim();

    // Quitar prefijos comunes de tuppers al inicio (ej: "p: ", "h: ", "[c] ", "{ana} ")
    t = t.replace(/^[a-zA-Z0-9_\u00C0-\u017F]{1,8}:\s*/, '');
    t = t.replace(/^(\[[a-zA-Z0-9_\u00C0-\u017F]{1,8}\]|\{[a-zA-Z0-9_\u00C0-\u017F]{1,8}\})\s*/, '');

    // Quitar URLs
    t = t.replace(/https?:\/\/\S+/gi, '');

    // Quitar menciones de usuarios, roles, canales (<@123>, <@&123>, <#123>)
    t = t.replace(/<@!?\d+>|<@&\d+>|<#\d+>/g, '');

    // Quitar custom emojis de discord (<:nombre:123> o <a:nombre:123>)
    t = t.replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, '');

    // Quitar emojis unicode
    t = t.replace(/[\p{Extended_Pictographic}\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    // Colapsar espacios y saltos de línea
    t = t.replace(/[\s\r\n]+/g, ' ');

    return t.trim();
}

/**
 * Hash numérico de 32 bits (DJB2) para detectar repeticiones consecutivas sin almacenar texto en memoria ni en BD.
 */
function hashRapido(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i) | 0;
    }
    return hash;
}

/**
 * Abre una sesión de clase en memoria y en Mongo cuando el docente confirma asistencia.
 * @param {Object} clase Documento de la clase en Mongo
 * @param {Date} [ahora] Fecha de inicio real
 */
function abrirSesionClase(clase, ahora = new Date()) {
    if (!clase?.salonId) return null;
    const threadId = String(clase.salonId);
    const ahoraMs = ahora instanceof Date ? ahora.getTime() : new Date(ahora).getTime();

    const estado = {
        claseId: String(clase._id),
        threadId,
        profesorUserId: String(clase.profesorUserId),
        profesorId: String(clase.profesorId || ""),
        inicioReal: ahoraMs,
        ultimaActividadProfesor: ahoraMs,
        usuarios: {} // Almacena únicamente puntos y métricas numéricas por userId
    };

    sesiones.set(threadId, estado);
    console.log(`[evaluadorClases] Sesión en vivo iniciada para clase "${clase.titulo}" en canal ${threadId}`);
    return estado;
}

/**
 * Puntúa un mensaje en memoria con todas las validaciones requeridas.
 * Se ejecuta en microsegundos y descarta de inmediato mensajes irrelevantes.
 * Únicamente almacena puntos y métricas numéricas, omitiendo cualquier texto.
 * @param {import('discord.js').Message} msg
 */
function puntuarMensaje(msg) {
    if (!msg || !msg.channelId) return;

    // Fast-path: casi todos los mensajes del servidor terminan aquí
    const s = sesiones.get(msg.channelId);
    if (!s) return;

    // 1. Descartar bots o webhooks (proxies de Tupperbox)
    // Se cuenta el mensaje original del usuario que trae su author.id real y se ignora el tupper proxy
    if (msg.author?.bot || msg.webhookId) return;

    const rawContent = msg.content || "";
    const contentTrim = rawContent.trim();
    if (!contentTrim) return;

    // Descartar comandos de tupperbox o prefijos de comandos comunes
    if (contentTrim.toLowerCase().startsWith("tul!")) return;
    if (/^[!/$.,\-]/.test(contentTrim)) return;

    // 2. Extraer texto útil y verificar mínimo 10 caracteres
    const textoUtil = limpiarTextoUtil(rawContent);
    if (textoUtil.length < 10) return;

    const userId = String(msg.author.id);
    const ahora = Date.now();

    // Inicializar agregados del usuario (únicamente puntos y valores numéricos)
    if (!s.usuarios[userId]) {
        s.usuarios[userId] = {
            puntos: 0,
            ultimoMensajeTimestamp: 0,
            puntosPorVentana: {},
            mensajesValidos: 0,
            ultimoHash: 0
        };
    }
    const u = s.usuarios[userId];

    // 3. Cooldown: descartar si pasaron menos de 10 segundos desde el último mensaje válido
    if (ahora - u.ultimoMensajeTimestamp < 10000) return;

    // 4. Duplicados: comprobación numérica vía hash sin almacenar strings
    const hashActual = hashRapido(textoUtil.toLowerCase());
    if (u.ultimoHash && u.ultimoHash === hashActual) {
        return; // Mensaje repetido consecutivamente
    }

    // 5. Comprobar actividad del profesor:
    // Los mensajes de los alumnos solo cuentan si el profesor estuvo activo en los últimos 10 minutos
    const esProfesor = (userId === s.profesorUserId);
    if (esProfesor) {
        s.ultimaActividadProfesor = ahora;
    } else {
        if (ahora - s.ultimaActividadProfesor > 10 * 60 * 1000) {
            // Conteo en pausa: profesor inactivo
            return;
        }
    }

    // 6. Valor del mensaje: min(caracteresUtiles, 250)
    const puntosMensaje = Math.min(textoUtil.length, 250);

    // 7. Ventana de tiempo (5 minutos) y límite de 400 puntos por ventana
    const ventana = Math.max(0, Math.floor((ahora - s.inicioReal) / (5 * 60 * 1000)));
    const puntosActualesVentana = u.puntosPorVentana[ventana] || 0;
    const cupoDisponible = Math.max(0, 400 - puntosActualesVentana);
    if (cupoDisponible <= 0) return; // Ya llenó el cupo de esta ventana

    const puntosASumar = Math.min(puntosMensaje, cupoDisponible);

    // 8. Actualizar únicamente puntos y contadores numéricos (sin almacenar textos)
    u.puntos += puntosASumar;
    u.puntosPorVentana[ventana] = puntosActualesVentana + puntosASumar;
    u.ultimoMensajeTimestamp = ahora;
    u.mensajesValidos = (u.mensajesValidos || 0) + 1;
    u.ultimoHash = hashActual;

    if (esProfesor) {
        s.ultimaActividadProfesor = ahora;
    }
}

/**
 * Vuelca los agregados de todas las clases activas a MongoDB (llamado cada 60s por el ticker).
 * Únicamente se guardan puntos y métricas numéricas.
 * @param {import('mongodb').Db} dbRol
 */
async function volcarSesionesAMongo(dbRol) {
    if (!dbRol || sesiones.size === 0) return;
    const clasesCol = dbRol.collection("Clases");
    const ahoraIso = new Date().toISOString();

    for (const s of sesiones.values()) {
        try {
            await clasesCol.updateOne(
                { _id: s.claseId },
                {
                    $set: {
                        "evaluacion.inicioReal": s.inicioReal,
                        "evaluacion.ultimaActividadProfesor": s.ultimaActividadProfesor,
                        "evaluacion.usuarios": s.usuarios,
                        "evaluacion.ultimoVolcado": ahoraIso
                    }
                }
            );
        } catch (err) {
            console.error(`[evaluadorClases] Error volcando agregados de clase ${s.claseId}:`, err.message);
        }
    }
}

/**
 * Reconstruye el Map de sesiones en memoria a partir de las clases en_curso en MongoDB.
 * Se llama al arrancar el bot para tolerar reinicios.
 * @param {import('mongodb').Db} dbRol
 */
async function reconstruirSesionesDesdeDB(dbRol) {
    if (!dbRol) return;
    try {
        const clasesCol = dbRol.collection("Clases");
        const clasesEnCurso = await clasesCol.find({ estado: 'en_curso' }).toArray();
        let cargadas = 0;

        for (const c of clasesEnCurso) {
            if (c.salonId) {
                const threadId = String(c.salonId);
                const inicioReal = c.inicioReal ? new Date(c.inicioReal).getTime() : Date.now();
                const ultimaAct = c.evaluacion?.ultimaActividadProfesor || inicioReal;
                const usuarios = c.evaluacion?.usuarios || {};

                // Asegurar que no hayan residuos de textos
                for (const uid of Object.keys(usuarios)) {
                    if (usuarios[uid].ultimosTextos) {
                        delete usuarios[uid].ultimosTextos;
                    }
                }

                sesiones.set(threadId, {
                    claseId: String(c._id),
                    threadId,
                    profesorUserId: String(c.profesorUserId),
                    profesorId: String(c.profesorId || ""),
                    inicioReal,
                    ultimaActividadProfesor: ultimaAct,
                    usuarios
                });
                cargadas++;
            }
        }
        console.log(`[evaluadorClases] Reconstruidas ${cargadas} clases activas en memoria desde MongoDB (solo puntos).`);
    } catch (err) {
        console.error("[evaluadorClases] Error reconstruyendo sesiones:", err.message);
    }
}

/**
 * Hace el guardado final obligatorio a Mongo y saca la clase del Map en memoria.
 * Debe llamarse ANTES de calcular la paga.
 * @param {string} claseId
 * @param {import('mongodb').Db} dbRol
 * @returns {Promise<Object>} Datos finales de evaluación (solo puntos)
 */
async function guardarYFinalizarSesion(claseId, dbRol) {
    const clasesCol = dbRol.collection("Clases");

    // Buscar la sesión en el Map
    let sesionActiva = null;
    let foundThreadId = null;
    for (const [threadId, s] of sesiones.entries()) {
        if (s.claseId === String(claseId)) {
            sesionActiva = s;
            foundThreadId = threadId;
            break;
        }
    }

    let evaluacionData = null;

    if (sesionActiva) {
        evaluacionData = {
            inicioReal: sesionActiva.inicioReal,
            ultimaActividadProfesor: sesionActiva.ultimaActividadProfesor,
            usuarios: sesionActiva.usuarios,
            finalizadoEn: new Date().toISOString()
        };

        // Guardado final en Mongo
        await clasesCol.updateOne(
            { _id: String(claseId) },
            { $set: { evaluacion: evaluacionData } }
        );

        // Sacar del Map
        if (foundThreadId) {
            sesiones.delete(foundThreadId);
        }
    } else {
        // Si no estaba en memoria (por ejemplo finalizada tras reinicio sin sesión previa), leer de Mongo
        const claseDoc = await clasesCol.findOne({ _id: String(claseId) });
        evaluacionData = claseDoc?.evaluacion || {
            inicioReal: claseDoc?.inicioReal ? new Date(claseDoc.inicioReal).getTime() : Date.now(),
            ultimaActividadProfesor: Date.now(),
            usuarios: {},
            finalizadoEn: new Date().toISOString()
        };
    }

    return evaluacionData;
}

/**
 * Evalúa los agregados registrados para determinar la validez del profesor,
 * los alumnos válidos, bonos, factores y cálculo final de la paga.
 * Trabaja exclusivamente con puntos y métricas numéricas.
 */
function evaluarParticipacionClase({ clase, evaluacion, duracionRealMin, duracionProgramadaMin }) {
    const durRealMin = Math.max(0, duracionRealMin || 0);
    const durProgMin = Math.max(1, duracionProgramadaMin || clase?.duracionMinutos || 60);
    const totalVentanas = Math.max(1, Math.ceil(durRealMin / 5));

    const usuarios = evaluacion?.usuarios || {};
    const profesorUserId = String(clase.profesorUserId);

    // 1. Evaluar al profesor
    const profeStats = usuarios[profesorUserId] || { puntos: 0, puntosPorVentana: {}, mensajesValidos: 0 };
    const ventanasProfeActivas = Object.values(profeStats.puntosPorVentana || {}).filter(pts => pts >= 30).length;
    const minVentanasProfe = totalVentanas <= 2 ? 1 : Math.max(2, Math.ceil(totalVentanas * 0.60));
    const minPuntosProfe = Math.max(250, totalVentanas * 50);

    const profesorValido = (profeStats.puntos >= minPuntosProfe) && (ventanasProfeActivas >= minVentanasProfe);

    // 2. Evaluar a los alumnos
    const minVentanasAlumno = totalVentanas <= 2 ? 1 : Math.max(2, Math.ceil(totalVentanas * 0.25));
    const minPuntosAlumno = Math.min(150, Math.max(60, totalVentanas * 35));

    const alumnosValidos = [];
    const alumnosEvaluados = [];

    const inscritosArray = Array.isArray(clase.inscritos) ? clase.inscritos : [];

    for (const [uid, udata] of Object.entries(usuarios)) {
        if (uid === profesorUserId) continue; // El profesor no es alumno de su propia clase

        const ventanasAlumno = Object.values(udata.puntosPorVentana || {}).filter(pts => pts >= 25).length;
        const esValido = (udata.puntos >= minPuntosAlumno) && (ventanasAlumno >= minVentanasAlumno);

        // Identificar si estaba inscrito
        const inscripcion = inscritosArray.find(ins => String(ins.userId || ins) === String(uid));

        const infoAlumno = {
            userId: uid,
            personajeId: inscripcion?.personajeId || null,
            personajeNombre: inscripcion?.personajeNombre || null,
            inscrito: Boolean(inscripcion),
            puntos: udata.puntos,
            ventanasActivas: ventanasAlumno,
            mensajesValidos: udata.mensajesValidos || 0,
            esValido
        };

        alumnosEvaluados.push(infoAlumno);
        if (esValido) {
            alumnosValidos.push(infoAlumno);
        }
    }

    // 3. Validez global de la clase
    let claseValida = true;
    let razonInvalida = null;

    if (durRealMin < 15) {
        claseValida = false;
        razonInvalida = "Duración real menor a 15 minutos";
    } else if (!profesorValido) {
        claseValida = false;
        razonInvalida = `Participación insuficiente del docente (puntos: ${profeStats.puntos}/${minPuntosProfe}, ventanas activas: ${ventanasProfeActivas}/${minVentanasProfe})`;
    } else if (alumnosValidos.length === 0) {
        claseValida = false;
        razonInvalida = "No hubo alumnos válidos que cumplieran la participación mínima repartida";
    }

    // 4. Cálculo de factor de duración
    const r = durRealMin / durProgMin;
    let factorDuracion = 1;
    if (r < 0.95) {
        factorDuracion = Math.pow(r / 0.95, 2);
    }
    if (!claseValida) {
        factorDuracion = 0;
    }

    // 5. Bono por alumnos válidos (Sección 9: solo aplica con más de 6 alumnos válidos, max en 30)
    const n = alumnosValidos.length;
    let bono = 1;
    if (n > 6) {
        bono = 1 + 0.01 * (Math.min(n, 30) - 6);
    }

    const factorRepeticion = 1; // 1.0 estándar
    const base = clase?.pago?.base || 50;

    const pagoTotal = claseValida
        ? Math.max(0, Math.round(base * factorDuracion * bono * factorRepeticion))
        : 0;

    return {
        claseValida,
        razonInvalida,
        totalVentanas,
        duracionRealMin: durRealMin,
        duracionProgramadaMin: durProgMin,
        profesor: {
            userId: profesorUserId,
            puntos: profeStats.puntos,
            ventanasActivas: ventanasProfeActivas,
            minVentanasRequeridas: minVentanasProfe,
            minPuntosRequeridos: minPuntosProfe,
            valido: profesorValido
        },
        alumnosValidos,
        alumnosEvaluados,
        totalAlumnosValidos: alumnosValidos.length,
        base,
        factorDuracion: Number(factorDuracion.toFixed(4)),
        bono: Number(bono.toFixed(4)),
        factorRepeticion,
        pagoTotal
    };
}

module.exports = {
    sesiones,
    limpiarTextoUtil,
    abrirSesionClase,
    puntuarMensaje,
    volcarSesionesAMongo,
    reconstruirSesionesDesdeDB,
    guardarYFinalizarSesion,
    evaluarParticipacionClase
};
