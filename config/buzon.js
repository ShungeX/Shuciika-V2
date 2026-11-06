// ─────────────────────────────────────────────────────────────────────────────
// Buzón del personaje (/rol buzon): una sola bandeja de NOTIFICACIONES.
//
// Todo vive en Rol_db.buzon, un documento por notificación y por PERSONAJE
// (campo `para`). El campo `tipo` dice qué es:
//   • "regalo"  → lo crea /rol regalar (functions/Regalos/regalos.js). Los
//                 documentos viejos sin `tipo` también son regalos.
//   • "carta" | "paquete" | "sistema" → avisos genéricos con título y texto
//                 (functions/Buzon/buzon.js → notificar).
//
// Estados: los regalos usan pendiente | reportado | abierto | devuelto |
// descartado. Las demás notificaciones usan nueva | leida.
// ─────────────────────────────────────────────────────────────────────────────

const TIPOS = {
    regalo: { nombre: "Regalos", emoji: "🎁" },
    carta: { nombre: "Cartas", emoji: "💌" },
    paquete: { nombre: "Paquetes", emoji: "📦" },
    sistema: { nombre: "Sistema", emoji: "🤖" },
}

// Lo que cuenta como "sin abrir" y lo que se ve en "Todo".
// (devuelto/descartado ya no son del destinatario: nunca se listan)
const ESTADOS_NUEVOS = ["pendiente", "reportado", "nueva"]
const ESTADOS_TODOS = [...ESTADOS_NUEVOS, "abierto", "leida"]

const LISTA = 10                     // notificaciones por página                   // ⚙
const TEXTO_MAX = 1500               // texto de una carta/aviso genérico            // ⚙ PROVISIONAL
// Las notificaciones genéricas ya leídas se purgan pasado este tiempo. Los
// regalos tienen su propia retención (config/regalos.js → RETENCION_DIAS).
const RETENCION_LEIDAS_DIAS = 30                                                    // ⚙ PROVISIONAL

module.exports = { TIPOS, ESTADOS_NUEVOS, ESTADOS_TODOS, LISTA, TEXTO_MAX, RETENCION_LEIDAS_DIAS }
