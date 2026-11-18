// scripts/probarBoost.js
// Prueba el anuncio de boost sin tener que quitar y volver a poner el rol.
//
// Uso:
//   node scripts/probarBoost.js --listar          → anuncios guardados (solo lectura)
//   node scripts/probarBoost.js --refrescar       → re-dibuja los anuncios existentes con el diseño actual
//   node scripts/probarBoost.js <ID de Discord>   → borra sus anuncios y simula un boost nuevo (sobre por MD + anuncio)
//
// Abre su propia conexión al gateway y a Mongo (no carga Server.js) y se cierra al terminar.
// Los botones los atiende el bot principal: reinícialo para que use el código nuevo.

const path = require("path")
require("dotenv").config({ path: path.resolve(__dirname, "../.env") })
const { MongoClient } = require("mongodb")
const { Client, GatewayIntentBits } = require("discord.js")

// functions/Premium/boost.js usa Server.js; se sustituye por un cliente de Mongo ligero
const mongo = new MongoClient(process.env.MONGODB_URI, { family: 4 })
require.cache[require.resolve("../Server")] = { id: "Server", loaded: true, exports: mongo }
// getDataCharacters también importa Server: ya queda resuelto con el cliente de arriba

const boost = require("../functions/Premium/boost")
const GUILD_ID = "716342375303217285"

async function main() {
    const arg = process.argv[2]
    if (!arg) throw new Error("Falta un argumento: --listar, --refrescar o un ID de Discord")

    await mongo.connect()
    const col = mongo.db("Server_db").collection("boost_mensajes")

    if (arg === "--listar") {
        const docs = await col.find({}).toArray()
        for (const d of docs) console.log(`${d._id} · booster ${d.boosterId} · ${d.agradecidos?.length || 0} gracias · carta fallida: ${!!d.cartaFallida}`)
        if (!docs.length) console.log("No hay anuncios guardados")
        return
    }

    const client = new Client({ intents: [GatewayIntentBits.Guilds] })
    await client.login(process.env.TOKEN_BOT)
    try {
        if (arg === "--refrescar") {
            const docs = await col.find({}).toArray()
            for (const d of docs) {
                const canal = await client.channels.fetch(d.canalId)
                const mensaje = await canal.messages.fetch(d._id)
                await mensaje.edit({ components: boost.construirAnuncio(d), flags: ["IsComponentsV2"], allowedMentions: { parse: [] } })
                console.log(`Re-dibujado ${d._id}`)
            }
            return
        }

        const guild = await client.guilds.fetch(GUILD_ID)
        const member = await guild.members.fetch(arg)
        await boost.retirarBoost(client, member.id)
        await boost.anunciarBoost(client, member)
        const doc = await col.findOne({ boosterId: member.id })
        console.log(`Anuncio enviado (${doc?._id}) · carta por MD: ${doc?.cartaFallida ? "falló" : "enviada"}`)
    } finally {
        await client.destroy()
    }
}

main()
    .catch(err => { console.error(err); process.exitCode = 1 })
    .finally(() => mongo.close())
