// functions/Miembros/bienvenida.js
// Mensaje de bienvenida (canal, Components V2) y la carta de bienvenida por MD, con su reenvío desde un botón.

const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js")
const clientdb = require("../../Server")

const db = clientdb.db("Server_db")
// Una entrada por usuario al que ya le llegó la carta por MD (al entrar o desde el botón): solo se envía una vez
const bienvenidasMD = db.collection("bienvenidas_md")

const CANAL_BIENVENIDA = "716342375743488052"
const ROL_PING_BIENVENIDA = "795804715476320256"
const ACCION_REENVIAR = "bienvenidaReenviar"

const URL_NORMAS = "https://discord.com/channels/716342375303217285/1571966740970213387"
const URL_GUIA_FICHA = "https://discord.com/channels/716342375303217285/1339103959855661096"

const GIFS = [
    "https://media1.tenor.com/m/o9Ak0TpPek0AAAAd/aikatsu-aikatsu-hello.gif",
    "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/f2/e9/nrrL8Ph8GG9Z1UJOs.gif",
    "https://static2.klipy.com/ii/c3a19a0b747a76e98651f2b9a3cca5ff/11/e2/ibW4yLT1.gif",
    "https://static2.klipy.com/ii/c44064a00e4b7451969381d90dea1769/b7/28/GuXA3R6I.gif",
    "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/ac/68/mp1bfGGeELeJ6.gif",
    "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/18/ec/b4uvaZkUMVK4e3PF4.gif",
    "https://static2.klipy.com/ii/da290b156d64898341638f3c299e7478/90/3e/ll5bjwcb.gif",
    "https://static2.klipy.com/ii/da290b156d64898341638f3c299e7478/74/40/nw7p74Pc.gif",
    "https://static2.klipy.com/ii/71b2873e478b9d8d0482ea3ec777ba7f/72/4f/0lUD3uEh.gif",
    "https://static2.klipy.com/ii/a8ada81afc59159ea5c8927feffa2e31/b4/91/hLCpJqCz92RG2BY4r2z5.gif",
    "https://static2.klipy.com/ii/2fd1ee858360694ebc7272832a866c2b/c3/90/YK00NLcSOZRE1.gif",
    "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/cf/d3/UWu81ZDQDpgxGwIdghB.gif",
    "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/0f/a8/RwcJFfORKBZ8ejF.gif",
    "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/06/10/GUkWU3aKbGRlz.gif",
    "https://static2.klipy.com/ii/c3a19a0b747a76e98651f2b9a3cca5ff/88/a8/UB0vXWjY.gif",
    "https://static2.klipy.com/ii/ce286d05b8e1a47cd4f32b0e1b6dec0e/de/fb/PsQKexOY.gif",
    "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/15/e8/OoSgLrV6SYFv0tB9qyNW.gif",
]

const aleatorio = (lista) => lista[Math.floor(Math.random() * lista.length)]

/** Mensaje V2 del canal de bienvenida. El ping al rol va en letra chica con spoiler: V2 no admite `content`. */
function construirBienvenida(member) {
    const contador = member.guild?.memberCount ?? "?"

    return [
        {
            type: 17,
            accent_color: 9109393,
            spoiler: false,
            components: [
                {
                    type: 9,
                    accessory: {
                        type: 11,
                        media: { url: member.user.displayAvatarURL({ extension: "png", size: 256 }) },
                        description: null,
                        spoiler: false
                    },
                    components: [
                        { type: 10, content: `# Bienvenido/a, <@${member.id}> <:Z_Bienvenida:763855060735885324>` },
                        {
                            type: 10,
                            content: `-# Instituto Mágico Shuciika · シュシカ ・ NIX\n\n¡<@${member.id}>, ya eres parte de esta comunidad mágica! (o^▽^o)ﾉ\nAquí todos nos alegramos de tenerte y esperamos que tu estancia se llene de aventuras y descubrimientos.\n\n**Para empezar:**\n・ Lee las normas en <#1571966740970213387>\n・ Crea tu personaje en [La guía de creación de personajes](${URL_GUIA_FICHA}): tu ficha es tu carta de ingreso\n\n <:TSH_VOhayoViena:853349999151677490>  Te enviamos un mensaje encantado a tu bandeja de entrada.\n-# Solo llega si tienes los mensajes directos abiertos.`
                        }
                    ]
                },
                { type: 14, divider: true, spacing: 1 },
                {
                    type: 12,
                    items: [{ media: { url: aleatorio(GIFS) }, description: null, spoiler: false }]
                },
                { type: 14, divider: true, spacing: 1 },
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 2,
                            custom_id: ACCION_REENVIAR,
                            label: "Reenviar mi bienvenida",
                            emoji: { id: "853352412013264926", name: "TSH_KwaiiGpensando" }
                        },
                        {
                            type: 2,
                            style: 5,
                            url: URL_NORMAS,
                            label: "Normas",
                            emoji: { id: "763871721551691837" }
                        },
                        {
                            type: 2,
                            style: 5,
                            url: URL_GUIA_FICHA,
                            label: "Crear mi ficha",
                            emoji: { id: "798393303359291432", name: "TSH_GEQiqiUh" }
                        }
                    ]
                },
                { type: 10, content: `-# Gracias a ti ahora somos ${contador} magos ＼(^▽^)／\n-# ||<@&${ROL_PING_BIENVENIDA}>||` }
            ]
        }
    ]
}

/** Publica la bienvenida en el canal. Menciona al miembro y al rol de ping, nada más. */
async function enviarBienvenidaCanal(client, member) {
    const canal = client.channels.cache.get(CANAL_BIENVENIDA) ?? await client.channels.fetch(CANAL_BIENVENIDA).catch(() => null)
    if (!canal) return console.error("[bienvenida] No se encontró el canal de bienvenida")

    await canal.send({
        components: construirBienvenida(member),
        flags: ["IsComponentsV2"],
        allowedMentions: { users: [member.id], roles: [ROL_PING_BIENVENIDA] }
    })
}

/** Contenido de la carta por MD (embed + menú del lobby + invitación). */
function construirCartaMD(user, nombreServidor) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`selectLobby-${user.id}`)
        .setPlaceholder("Selecciona una opción para ver...")
        .setMaxValues(1)
        .addOptions(
            { label: "Ver la introducción", description: "Una pequeña introducción hecha con cariño (｡•̀ᴗ-)✧", value: "introduccion", emoji: "✨" },
            { label: "Ver las normas", description: "Siempre es importante conocerlas =.=", value: "normas", emoji: "🚓" },
            { label: "Manual del estudiante", description: "Un breve manual por los diferentes canales del servidor", value: "manual", emoji: "📖" }
        )

    const embed = new EmbedBuilder()
        .setTitle(`Bienvenido/a al ${nombreServidor}`)
        .setThumbnail(user.displayAvatarURL())
        .setDescription(` ¡Hola ${user}!. Soy Shuciika, tu guía en este mundo mágico. (｡•̀ᴗ-)✧✨\n`)
        .addFields(
            { name: "Tema del servidor. ✨", value: "Este es un espacio de rol de fantasía mágica donde podrás crear un personaje único y vivir aventuras, aunque también puedes simplemente convivir con la comunidad sin participar en el rol.\n ¡Lo importante es que disfrutes a tu manera!|･ω･)✿" },
            { name: "Progreso del server", value: "El servidor aún está en desarrollo, así que agradecemos tu paciencia.\n \n**Owner:** Gracias por unirte! Juntos haremos una comunidad grande y bonita. ♡" }
        )
        .setFooter({ text: "Se libre de explorar y descubrir cada cosa del servidor. (Abajo de este mensaje hay un menu interactivo)" })
        .setTimestamp()
        .setColor("Random")

    return [
        { content: `${user}`, embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] },
        { content: "`Tambien te dejo la invitacion permanente al servidor:`||✿ ･ ω ･) ~ https://discord.gg/yxNehRsmgJ (Si no sirve, envia un mensaje al desarollador <@!665421882694041630>)" }
    ]
}

/** true si la carta ya le llegó alguna vez a este usuario. */
async function cartaYaEnviada(userId) {
    return !!(await bienvenidasMD.findOne({ _id: String(userId) }))
}

/**
 * Envía la carta por MD. Solo la registra como enviada si llegó el primer mensaje.
 * @param {import('discord.js').User} user
 * @param {string} nombreServidor
 * @param {"entrada"|"boton"|"simulacion"} origen  "simulacion" envía la carta sin registrarla
 * @returns {Promise<boolean>} false si el usuario tiene los MD cerrados
 */
async function enviarCartaMD(user, nombreServidor, origen) {
    const [carta, invitacion] = construirCartaMD(user, nombreServidor)
    try {
        await user.send(carta)
    } catch {
        return false
    }
    await user.send(invitacion).catch(() => { })
    if (origen === "simulacion") return true
    await bienvenidasMD.updateOne(
        { _id: String(user.id) },
        { $setOnInsert: { enviada: new Date(), origen } },
        { upsert: true }
    ).catch(e => console.error("[bienvenida] No se pudo registrar la carta enviada:", e))
    return true
}

module.exports = {
    ACCION_REENVIAR,
    construirBienvenida,
    enviarBienvenidaCanal,
    enviarCartaMD,
    cartaYaEnviada,
}
