// Vista (Components V2) del comando /ping. Recibe el diagnóstico de functions/diagnostico.js
// y la latencia de respuesta medida por quien la llama (comando o botón).

const { crearCustomId } = require("../../utils/constructores/customId")
const { clasificar } = require("../../functions/diagnostico")

const ICONO = { ok: "🟢", lento: "🟡", critico: "🔴", fallo: "⚫" }
const VEREDICTO = {
    operativo: { icono: "🟢", titulo: "Operativo", color: 0x3fb27f },
    degradado: { icono: "🟡", titulo: "Degradado", color: 0xe6b450 },
    critico: { icono: "🔴", titulo: "Con problemas", color: 0xe66767 },
}
const UMBRAL_RESPUESTA = { bien: 400, lento: 1200 }

const separador = { type: 14, divider: true, spacing: 1 }
const texto = (content) => ({ type: 10, content })
const numero = (n) => Number(n || 0).toLocaleString("es-MX")

function lineaServicio(s) {
    const icono = ICONO[s.estado] || "⚪"
    if (s.estado === "fallo") return `${icono} **${s.nombre}** · sin respuesta\n-# ${s.error || "error desconocido"}`
    if (s.sinLatido) return `${icono} **${s.nombre}** · ${s.conexion}\n-# Aún sin latido medido (tarda ~40 s tras conectar)`

    let linea = `${icono} **${s.nombre}** · \`${s.ms} ms\``
    const notas = []
    if (s.conexion) notas.push(s.conexion)
    if (s.muestras > 1) notas.push(`${s.muestras} muestras: ${s.min}–${s.max} ms`)
    else if (s.max != null && s.min == null) notas.push(`pico de ${s.max} ms`)
    if (notas.length) linea += `\n-# ${notas.join(" · ")}`
    return linea
}

/**
 * @param {object} diagnostico resultado de obtenerDiagnostico()
 * @param {{ userId: string, respuestaMs: number, internoMs?: number|null, confirmacionMs?: number|null }} datos
 * @returns {object[]} componentes V2 listos para enviar con flags: ["IsComponentsV2"]
 */
function menuPing(diagnostico, { userId, respuestaMs, internoMs = null, confirmacionMs = null }) {
    const v = VEREDICTO[diagnostico.estado] || VEREDICTO.critico
    const { servicios, proceso } = diagnostico

    const respuesta = {
        nombre: "Respuesta al comando",
        estado: clasificar(respuestaMs, UMBRAL_RESPUESTA),
        ms: Math.max(0, Math.round(respuestaMs)),
    }
    // De ese total, cuánto es trabajo del bot y cuánto es esperar a que Discord confirme
    if (internoMs != null && confirmacionMs != null) {
        respuesta.conexion = `Navi tardó ${internoMs < 1 ? "menos de 1" : Math.round(internoMs)} ms en procesarlo · Discord tardó ${Math.round(confirmacionMs)} ms en confirmar`
    }
    const latencias = [respuesta, servicios.gateway, servicios.api, servicios.mongo, servicios.cloudinary, servicios.bucle]
        .map(lineaServicio).join("\n")

    const componentes = [
        texto(`# 🏓 Pong!\n${v.icono} **${v.titulo}** — ${diagnostico.resumen}`),
        separador,
        texto(`### Latencias\n${latencias}`),
    ]

    if (diagnostico.avisos.length) {
        componentes.push(separador, texto(`### Avisos\n${diagnostico.avisos.map(a => `- ${a}`).join("\n")}`))
    }

    const m = proceso.memoria
    componentes.push(
        separador,
        texto(
            `### Navi${proceso.version ? ` v${proceso.version}` : ""}\n` +
            `- **Encendida:** <t:${Math.floor(proceso.iniciadoEn / 1000)}:R>` +
            (servicios.gateway.conectadoDesde ? ` · conectada a Discord <t:${Math.floor(servicios.gateway.conectadoDesde / 1000)}:R>` : "") + "\n" +
            `- **Memoria:** ${m.rssMB} MB en uso (heap ${m.heapMB} de ${m.heapTotalMB} MB)\n` +
            `- **Alcance:** ${numero(proceso.servidores)} ${proceso.servidores === 1 ? "servidor" : "servidores"} · ${numero(proceso.miembros)} miembros\n` +
            `- **En caché:** ${numero(proceso.cache.miembros)} miembros · ${numero(proceso.cache.canales)} canales · ${numero(proceso.cache.mensajes)} mensajes`
        ),
        texto(`-# Node ${proceso.node} · discord.js ${proceso.discordjs} · medido <t:${Math.floor(diagnostico.medidoEn / 1000)}:T> en ${diagnostico.duracionMs} ms`),
        {
            type: 1,
            components: [{
                type: 2,
                style: 2,
                label: "Volver a medir",
                emoji: { name: "🔄" },
                custom_id: crearCustomId({ action: "ping_button", userId }),
            }],
        },
    )

    return [{ type: 17, accent_color: v.color, components: componentes }]
}

module.exports = { menuPing }
