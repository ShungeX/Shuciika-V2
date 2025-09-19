const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")

class MailSystem {

    constructor(collection) {

    }

    async buildFilters(filters = {}) {
        const query = []

        if(filters.tipo) query['buzon.tipo'] = filters.tipo
        if(filters.leido !== undefined) query['buzon.leido'] = filters.leido;
        if(filters.reclamado !== undefined) query['buzon.reclamado'] = filters.reclamado
        if(filters.remitente) query['buzon.remitente.ID'] = filters.remitente;
        if (filters.expirados) query['buzon.expiracion'] = { $lt: new Date() };

        console.log(query)

        return query
    }

    async enviarCorreo(data) {
        const newMail = {
            ID: `${data.personaje.ID}${data.date}`,
            Nombre: `${data.titulo || `Sin titulo`}` ,
            remitente: {
                ID: data.personaje.ID,
                Nombre: data.personaje.Nombre,
                avatarURL: data.personaje.avatarURL
            },
            tipo: data.tipo,
            mensaje: {
                texto: data.mensaje.texto || null,
                adjuntos: data.mensaje?.adjuntos?.slice(0,2) || null,
            },
            contenido: data?.contenido || null,
            fechaEnvio: data.date,
            leido: false,
            reclamado: false,
            expiracion: data.expirationDate,
            isEspecial: false,
        }

        await characters.updateOne({ID: data.personajeSend}, 
            {
                $push: { buzon: { $each: [newMail], $slice: -100}}
            },
            {
                upsert: true
            }
        )

        return {message: "Se ha enviado correctamente el correo", isSuccess: true}
    }

    async getMail(characterId, filters, pagination = {page: 1, limit: 10}) {
        const pipeline = [
            {$match: {ID: characterId}},
            {$unwind: '$buzon'},
            {$match: this.buildFilters(filters)},
            {$sort: {'buzon.fechaEnvio': -1}},
            { $skip: (pagination.page - 1) * pagination.limit },
            { $limit: pagination.limit },
            {$group: {_id: "$_id",ID: {$first: '$ID'}, buzon: { $push: '$buzon' }, total: {$sum: 1} } },
            {$project: {_id: 0, ID: 1, buzon: 1, total: 1 }}
        ]

        const result = await characters.aggregate(pipeline).next()

        return result || { buzon: [], total: 0};
    }
}

const mailSystem = new MailSystem(db2)
module.exports = {mailSystem}