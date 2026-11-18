// ─── El Anfitrión (jefe oculto del Salón de los Espejos): constantes y balance ─
// Referencia: Anfitrion_Jefe_Sosias.md. Todo lo marcado ⚙ vive aquí.

const ANFITRION = Object.freeze({
    // III. Activación
    PELEAS_PARA_ACTIVAR: 10,          // tras 10 peleas contra Sosias, la 11.ª es El Anfitrión
    FACTOR_HUIDA: 0.5,                // ⚙ huir o rendirse antes de la Ruptura: el contador se reduce a la mitad
    NPC_BASE: "NPC-004",              // Sosias

    // IV. Fases (porcentaje de vida del jefe tras la Ruptura)
    RUPTURA_PCT: 0.01,                // Fase I: al dejarlo al 1% no muere, se rompe el espejo
    FASE_III_PCT: 0.65,
    FASE_IV_PCT: 0.35,

    // VI. Vida y escalado (no depende de la vida actual del jugador)
    ESCALADO: 2.5,                    // ⚙ individual: vidaMaxJugador × 2.5
    ESCALADO_GRUPO: 2.0,              // ⚙ grupo: suma de vidas máximas × 2.0
    DANIO_POR_BLOQUE: 0.30,           // ⚙ +30% de daño por cada 2 jugadores adicionales
    CASILLAS_POR_BLOQUE: 1,           // ⚙ su cinta (el compás) gana 1 casilla por cada 2 jugadores adicionales
    CAMBIO_JUGADOR_TURNOS: 3,         // ⚙ en grupo, cada cuántos turnos copia a otro jugador (PENDIENTE "X")

    // XI. Memoria de 5 turnos
    VENTANA: 5,
    PESOS: Object.freeze([0.10, 0.15, 0.20, 0.25, 0.30]),   // ⚙ más peso a lo reciente
    UMBRAL_CONFIANZA: 0.5,            // ⚙ por encima contraataca; por debajo duda

    // Fase II
    MIEDO_TURNOS: 3,
    MIEDO_SOLO_COPIADO: true,         // PENDIENTE del documento: el miedo se aplica solo al jugador copiado
    INVERSION_CADA: 3,                // cada 3 turnos sus ataques usan el pilar que contrarresta al tuyo
    FACTOR_CASTIGO: 1.3,              // ⚙ golpe que castiga una curación, un apoyo o un objeto previsto
    FACTOR_DUDA: 0.6,                 // ⚙ con baja confianza actúa a menos del máximo
    PROB_DEFENDER: 0.35,              // ⚙ con qué frecuencia se cubre al leerte (nunca dos turnos seguidos)
    FALLOS_PARA_DUDA: 3,              // ⚙ acciones inesperadas seguidas antes de que hable de duda
    COMBO_PARA_BONUS: 2,              // ⚙ acciones seguidas que no te adivina para que entre el bonus
    MULT_COMBO: 2,                    // ⚙ con el combo vivo, tus golpes y hechizos le entran al doble

    // Fase III
    REFLEJOS: Object.freeze(["El Anfitrión Cortés", "El Anfitrión Impaciente", "El Anfitrión Callado",
        "El Anfitrión Curioso", "El Anfitrión Sereno", "El Anfitrión Hambriento"]),   // provisionales
    DANIO_SENUELO: 0.25,              // ⚙ cada señuelo hace ~25% del daño
    DANIO_RECIBIDO_SENUELO: 6,        // ⚙ los señuelos tienen la misma vida que el real, pero reciben ×6 de daño
    CURA_SENUELO_PCT: 0.01,           // ⚙ un señuelo no se cura más de un 1% de su vida máxima por golpe
    ECO_PESO_ULTIMA: 0.5,             // ⚙ probabilidad de que un reflejo repita tu última acción
    PROB_FOCO: 0.6,                   // ⚙ en grupo, cuánto insiste en el jugador que está copiando
    RECOMPONER_TURNOS: 2,             // los señuelos caídos se recomponen tras 2 turnos del real
    MAX_ROBOS: 2,                     // ⚙ (propuesta) robos simultáneos

    // Fase IV
    PROB_AJENO: 0.6,                  // ⚙ cuánto usa hechizos que no son tuyos (si no, tu acción menos usada)
    ESCALON_MAX_AJENO: 3,             // ⚙ escalón máximo de esos hechizos prestados

    // VIII. Recompensas
    POLVO_X_HERALDO: 3,               // ⚙ primera vez: 3× el Polvo de un Heraldo de tu Resplandor
    POLVO_REPETICION: 0.3,            // ⚙ repeticiones: ×0.3 de eso
    COOLDOWN_REPETICION_DIAS: 7,      // ⚙ PENDIENTE del documento: recompensa de repetición, una por semana y cuenta

    // Prueba (solo administradores): El Anfitrión elegible en las salas contra NPCs del dashboard.
    // Es un NPC real de Rol_db.NPCs (scripts/seedAnfitrion.js), oculto para el resto de usuarios.
    // No cuenta peleas, no da recompensas ni Invitación.
    PRUEBA: Object.freeze({ ID: "NPC-ANFITRION", ADMINS: Object.freeze(["665421882694041630"]) }),

    // Objetos (TOB-01)
    OBJETOS: Object.freeze({
        INVITACION: Object.freeze({ ID: 1029, Region: "TOB-01" }),
        ESPEJO_DE_MANO: Object.freeze({ ID: 1030, Region: "TOB-01" }),
        ESQUIRLA: Object.freeze({ ID: 1031, Region: "TOB-01" }),
    }),

    // VII. Voz
    VIDA_BAJA_PCT: 0.30,
})

module.exports = { ANFITRION }
