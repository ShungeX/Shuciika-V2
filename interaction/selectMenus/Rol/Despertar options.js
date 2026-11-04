const { EmbedBuilder } = require("discord.js")
const { promisify } = require("util")
const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente")
const { crearCustomId } = require("../../../utils/constructores/customId")
const { souls: Soul } = require("../../../utils/getDataCharacters")
const { aplicarVinculos } = require("../../../functions/dialogoVinculos")

const sleep = promisify(setTimeout)
const ACTION = "despertarOptions"

/**
 * StringSelectMenu del despertar de alma: el tramo final del evento "despertar",
 * después de que el sistema de diálogos haya orquestado las preguntas.
 * customId: despertarOptions-{user_id}-{character_id}
 * value:    {etapa}*{respuesta}
 *
 * Etapas:
 *  - rf  → Sintonía inicial: afinidad natural, lienzo en blanco o aleatorio
 *  - rf2 → Sello del alma: elección del elemento, cierra el despertar
 *
 * La resonancia, disonancia e hilos lunares los suma el diálogo con sus variables
 * vinculadas (ver functions/dialogoVinculos); despertarAlma los escribe en el Soul.
 */

// ─── Datos ───────────────────────────────────────────────────────────────────

// lienzo = true: el alma es un "Lienzo en blanco" (necesita un artefacto mágico como foco)
const SINTONIAS = {
    afinidad: { lienzo: false, nombre: "Afinidad natural", detalle: "resonancia" },
    disonancia: { lienzo: true, nombre: "Lienzo en blanco", detalle: "disonancia" },
}

const ELEMENTOS = [
    { value: "Pyro", nombre: "Pyró", emoji: "🔥", hechizo: "Pyro-001" },
    { value: "Aqua", nombre: "Aqua", emoji: "💧", hechizo: "Aqua-001" },
    { value: "Lapis", nombre: "Lapis", emoji: "⛰️", hechizo: "Lapis-001" },
    { value: "Rakau", nombre: "Rakau", emoji: "🌳", hechizo: "Rakau-001" },
    { value: "Electro", nombre: "Electro", emoji: "⚡", hechizo: "Electro-001" },
    { value: "Kryo", nombre: "Krýo", emoji: "❄️", hechizo: "Kryo-001" },
    { value: "Wind", nombre: "Wind", emoji: "🌪️", hechizo: "Wind-001" },
    { value: "Lux", nombre: "Lux", emoji: "✨", hechizo: "Lux-001" },
]

const IMAGENES = {
    sintonia: "https://i.pinimg.com/736x/82/99/61/829961dfade29dd40544a38ca9e1914b.jpg",
    afinidad: "https://i.pinimg.com/736x/a5/06/1c/a5061c5ecc1328673e203d03661c86d3.jpg",
    lienzo: "https://i.pinimg.com/736x/09/05/84/09058455b5164376600524ec2d5db1b6.jpg",
    sello: "https://i.pinimg.com/736x/06/9f/8f/069f8fe5bd337125bbea58b326ab794e.jpg",
    vozUnificada: "https://i.pinimg.com/736x/36/21/7c/36217c5fa43326dfaef86e1c50e28a33.jpg",
}

// [descripción del embed, espera tras mostrarla]
const NARRACION_ALEATORIA = [
    ["Asi que... en el momento de tu primer gran decisión, en el instante de la primera pincelada... **eliges no tomar el pincel**", 10000],
    ["**Interesante.** ", 4000],
    ["Una Voluntad que cede su voluntad. ¿Es una muestra de confianza absoluta en el tejido del destino? ¿O es el miedo a la responsabilidad de la creación? Quizás no hay diferencia.", 8000],
    ["No importa. Tu no-elección es, en sí misma, una directriz. Has ordenado al recipiente que busque su propio cauce, que se deje llevar por la primera marea de poder que lo toque.", 8000],
    ["Observa, dibujante. Tu silencio ha dejado que las dos posibilidades luchen por el dominio.", 8000],
]

const ECOS = {
    equilibrio: "El Lienzo en Blanco.\n-# Al despertar, la última sensación que te acompaña es la del silencio absoluto. Ni la paz de un propósito, ni la inquietud de una duda. Solo un vasto potencial y el peso de una libertad total. Tu camino no está escrito; cada paso será una elección enteramente tuya.",
    resonancia: "-# Un Pilar para el Mundo\n\nAl despertar, una última sensación perdura en tu mente: la paz de un propósito claro. Sientes que cada fibra de tu ser está exactamente en su lugar, como una nota perfecta en una sinfonía eterna. Tu camino está trazado.",
    disonancia: "-# Un Eco en el Silencio\n\nAl despertar, una última sensación te inquieta: el eco de una pregunta sin respuesta. Sientes un sutil anhelo, un llamado hacia algo que sabes que existe más allá de los muros del jardín. Tu camino apenas comienza, y ya te atrae lo desconocido.",
}

/** Documento base de Soul para un personaje que aún no ha despertado */
function soulInicial(characterId, ownerID) {
    return {
        _id: characterId,
        ownerID,
        nucleo: {
            HP: 100, Mana: 50, Elemento: "Ninguno",
            energy: 0, lastEnergyUpdate: 0, energiaAlmica: 0,
        },
        stats: {
            hpMax: 100, manaMax: 50, fuerza: 1, resFisica: 1, resMagica: 1, agilidad: 1,
            sabiduria: 1, inteligencia: 1, sintoniaElemental: 1, percepcion: 1,
            determinacion: 1, regeneracion: 1, paradoja: 0, destino: 0,
        },
        dominio: { hechizos: [], transforaciones: [], equipo: [], debilidades: {} },
        sendero: { hilosLunares: 0, StelarFragments: 0,StelarFragmentsTotal: 0, resplandor: 'I', firmamento: [], heraldo: null, resonancia: 0, disonancia: 0 },
        registros: { npcDefeat: [] },
        isFinish: false,
    }
}

// ─── Componentes V2 ──────────────────────────────────────────────────────────

const texto = (content) => ({ type: 10, content })
const separador = () => ({ type: 14, divider: true, spacing: 1 })
const seccion = (url, ...contenidos) => ({
    type: 9,
    accessory: { type: 11, media: { url } },
    components: contenidos.map(texto),
})
const contenedor = (...components) => [{ type: 17, components }]

/** Fila con el select del despertar. `elegido` marca la opción por defecto (útil al deshabilitarlo) */
function selectDespertar({ userId, characterId, placeholder, opciones, elegido, disabled = false }) {
    return {
        type: 1,
        components: [{
            type: 3,
            custom_id: crearCustomId({ action: ACTION, userId, characterId }),
            placeholder,
            min_values: 1,
            max_values: 1,
            disabled,
            options: opciones.map(({ label, value, description }) => ({
                label,
                value,
                ...(description && { description }),
                default: value === elegido,
            })),
        }],
    }
}

function uiSintonia({ userId, characterId, elegido, disabled }) {
    return contenedor(
        seccion(IMAGENES.sintonia,
            "# La Sintonía inicial",
            "Has escuchado nuestro eco y has sentido nuestra armonía.\n\n-# Ahora, **dibujante**, es momento de darnos forma y el contorno único de ti\n-# Traza el primer y más importante destino de nuestra alma.\n\n**¿Cómo fluirá el poder a través de este ser?**"
        ),
        separador(),
        seccion(IMAGENES.afinidad,
            "**Afinidad natural** *(resonancia)*\n\n-# ¿Harás que esta alma resuene en perfecta sintonía con uno de los Ocho Pilares de la Realidad?\n-# Una melodía innata, un propósito claro que la ancla a la creación desde su nacimiento. Un camino de claridad, pero definido por una sola nota."
        ),
        separador(),
        seccion(IMAGENES.lienzo,
            "**Lienzo en blanco** *(disonancia)*\n\n-# ¿O prefieres que esta alma sea un \"Alma Desafinada\" , un silencio lleno de un potencial vasto pero indefinido? \n-# No tendrá una canción propia, pero será capaz de aprender a interpretar la de otros a través de un foco externo. "
        ),
        separador(),
        texto("-# Los ecos de estas verdades y sus consecuencias resuenan en los archivos del conocimiento. Puedes consultarlos antes de tomar tu decisión final.\n- -# [Afinidad natural](https://discord.com/channels/716342375303217285/1335496371603509288)\n- -# [Lienzo en blanco](https://discord.com/channels/716342375303217285/1339089897172107315)\n"),
        separador(),
        selectDespertar({
            userId, characterId, elegido, disabled,
            placeholder: "Moldea su alma...",
            opciones: [
                { label: "Afinidad natural", value: "rf*afinidad", description: "(Resonancia)" },
                { label: "Lienzo en blanco", value: "rf*disonancia", description: "(Disonancia)" },
                { label: "Que el destino eliga", value: "rf*aleatorio", description: "(Aleatorio)" },
            ],
        }),
    )
}

function uiSello({ userId, characterId, elegido, disabled }) {
    return contenedor(
        seccion(IMAGENES.sello,
            "# El Sello del Alma",
            "-# Has aceptado tu lugar en el gran diseño. Tu alma, forjada con un propósito, resuena con una de las Esencias Primordiales.\n-# Ahora, es momento de nombrar esa verdad. De sellar el pacto.\n\n¿Cuál de los Ocho Pilares de la Realidad es el núcleo de tu Portador?"
        ),
        separador(),
        texto("`[🔥]` **Pyrós:** *La Llama Primordial. Símbolo de poder, civilización y voluntad inquebrantable. *\n\n`[💧]` **Aqua:** *La Fuente de Vida. Una esencia pura con el poder de sanar las heridas y purificar la corrupción. *\n\n`[⛰️]` **Lapis:** *El Pilar del Mundo. Otorga un dominio sólido sobre la roca y los minerales de la tierra.* \n`[🌳]` **Rakau:** *El Aliento de la Naturaleza. Canaliza la energía vital, acelerando los ciclos de la vida y el crecimiento. *\n\n`[⚡]` **Electro:** *La Chispa de Pureza. Una voluntad veloz y certera, un vector de poder que se dispara hacia su objetivo. *\n\n`[❄️]` **Krýo:** *El Vacío Helado. El poder que nace de la disciplina, la paz interior y la calma absoluta de la mente. *\n\n`[🌪️]` **Wind:** *El Aliento del Mundo. La esencia más armónica, un catalizador universal que fluye entre los demás elementos para potenciarlos. *\n\n`[✨]` **Lux:** *El Don de la Sanación. La manifestación más pura del amor del Eón Creador, un abrazo que reconforta el espíritu.*"),
        separador(),
        selectDespertar({
            userId, characterId, elegido, disabled,
            placeholder: "Selecciona tu pilar",
            opciones: ELEMENTOS.map(e => ({ label: `[${e.emoji}] ${e.nombre}`, value: `rf2*${e.value}` })),
        }),
        texto("Para un conocimiento más profundo de las Esencias Primordiales, los archivos del Instituto están a tu disposición en [Los 8 pilares de la realidad](https://canary.discord.com/channels/716342375303217285/1335496371603509288)"),
    )
}

function uiFinal(soul) {
    const naturaleza = soul.nucleo.artefactoMagico === true ? "Lienzo en blanco" : "Alma en resonancia (afinada)"

    return contenedor(
        texto("# En busca de un lugar en las estrellas"),
        texto("Tu poder ha despertado, portador. Tu alma ha sido reconocida.\n\nCada lección, cada desafío y cada acto de lealtad te acercará a tu destino final: **la Ascensión.** \nEsfuérzate, mantén tu *resonancia pura* y reclama el lugar que te espera entre los protectores de nuestro firmamento. "),
        separador(),
        texto(`- -# Naturaleza anímica: ${naturaleza} \n- -# Pilar de la realidad: ${soul.nucleo.Elemento}\n- -# FE Inicial: ${soul.nucleo.nivelMagico}`),
        { type: 12, items: [{ media: { url: IMAGENES.sintonia } }] },
        separador(),
        texto("-# *Tu perfil ha sido actualizado en los Archivos del Instituto, usa `/rol perfil` para visualizar dichos cambios*"),
    )
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

const responderEfimero = (interaction, content) => interaction.reply({ content, flags: ["Ephemeral"] })

function enviarTemporal(user, content, ms = 10000) {
    return user.send({ content })
        .then(m => setTimeout(() => m.delete().catch(() => { }), ms))
        .catch(e => console.warn("[Despertar] No se pudo enviar el mensaje temporal:", e.message))
}

function ecoDelSendero({ resonancia, disonancia }) {
    if (resonancia === disonancia) return ECOS.equilibrio
    return resonancia > disonancia ? ECOS.resonancia : ECOS.disonancia
}

// ─── Etapas ──────────────────────────────────────────────────────────────────

/** rf: fija la naturaleza del alma y muestra el Sello del alma */
async function elegirSintonia({ interaction, character, soul, respuesta }) {
    if (!soul) {
        soul = soulInicial(character._id, interaction.user.id)
        await Soul.insertOne(soul)
    }

    const ids = { userId: interaction.user.id, characterId: character._id }
    await interaction.update({ components: uiSintonia({ ...ids, elegido: `rf*${respuesta}`, disabled: true }) })

    let sintonia = respuesta
    if (respuesta === "aleatorio") {
        sintonia = await destinoAleatorio(interaction)
        // El select muestra lo que le tocó, no "Que el destino eliga", y queda constancia aparte
        const { nombre, detalle } = SINTONIAS[sintonia]
        await interaction.editReply({ components: uiSintonia({ ...ids, elegido: `rf*${sintonia}`, disabled: true }) })
        await interaction.followUp({ content: `El destino eligió por ti: **${nombre}** *(${detalle})*`, flags: ["Ephemeral"] })
    }

    if (!(sintonia in SINTONIAS)) {
        return interaction.followUp({ content: "Esa sintonía no existe, intenta nuevamente.", flags: ["Ephemeral"] })
    }

    await Soul.updateOne({ _id: character._id }, { $set: { "nucleo.artefactoMagico": SINTONIAS[sintonia].lienzo } })

    // Valores que el diálogo escribió en el Soul con sus variables vinculadas
    const { resonancia, disonancia } = soul.sendero ?? {}
    if (resonancia === undefined || disonancia === undefined) {
        return interaction.followUp({ content: "No se ha podido asignar los valores a tu personaje, intenta nuevamente. Si el error persiste contacta con administracion", flags: ["Ephemeral"] })
    }
    enviarTemporal(interaction.user, ecoDelSendero({ resonancia, disonancia }))

    await sleep(6000)
    await interaction.editReply({ components: uiSello(ids), flags: ["IsComponentsV2"] })
}

/** Narración de "Que el destino eliga". Devuelve la sintonía resultante */
async function destinoAleatorio(interaction) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: "Voz unificada" })
        .setThumbnail(IMAGENES.vozUnificada)
        .setColor("DarkPurple")

    let mensaje
    for (const [descripcion, espera] of NARRACION_ALEATORIA) {
        embed.setDescription(descripcion)
        mensaje = mensaje
            ? await mensaje.edit({ embeds: [embed] })
            : await interaction.followUp({ embeds: [embed] })
        await sleep(espera)
    }

    await mensaje.edit({ content: "Las dos llamas danzan y giran una alrededor de la otra en una lucha silenciosa. Finalmente, una de ellas consume a la otra.", embeds: [] })
    await sleep(9000)

    const sintonia = Math.random() < 0.5 ? "disonancia" : "afinidad"
    await mensaje.edit({
        content: sintonia === "disonancia"
            ? "El destino decidió que su alma suena en una nota desafinada."
            : "El destino decidió que su alma resuena en perfecta armonía.",
    })
    await sleep(7000)
    mensaje.delete().catch(() => { })

    return sintonia
}

/** rf2: sella el elemento y cierra el despertar */
async function elegirElemento({ interaction, character, respuesta }) {
    const elemento = ELEMENTOS.find(e => e.value === respuesta)
    if (!elemento) {
        return responderEfimero(interaction, "No se ha podido asignar el elemento a tu personaje, intenta nuevamente. Si el error persiste contacta con administracion")
    }

    await Soul.updateOne({ _id: character._id }, { $set: { "nucleo.Elemento": elemento.nombre } })

    const ids = { userId: interaction.user.id, characterId: character._id }
    await interaction.update({ components: uiSello({ ...ids, elegido: `rf2*${elemento.value}`, disabled: true }) })
    await interaction.followUp({ content: `Tu personaje ha sido bendecido por el éon de la creacion. Ahora posee el elemento **${elemento.nombre}**`, flags: ["Ephemeral"] })

    await sleep(5000)
    await finalizarDespertar(interaction.user, character._id, elemento)
}

async function finalizarDespertar(user, characterId, elemento) {
    await user.send({ content: "El claro se desvanece. Las luces de tu alma comienzan a apagarse, cómo si de un teatro se tratara. Dejando solo un foco sobre ti, el jugador. El silencio es total..." })
    .then(m => setTimeout(() => m.delete().catch(() => { }), 12000))

    await Soul.updateOne({ _id: characterId }, {
        $set: {
            "metadata.Despertado": Math.floor(Date.now() / 1000),
            isFinish: true,
            "dominio.equipo": [{ ID: 748, Region: "TOB-01", Type: 1 }],
            "dominio.hechizos": [{ ID: elemento.hechizo, InCombat: true }],
        },
        $unset: { messageTemp: "" },
    })

    await sleep(9000)

    const soul = await Soul.findOne({ _id: characterId })
    await user.send({ components: uiFinal(soul), flags: ["IsComponentsV2"] })
}

// ─── Entrada desde el diálogo ────────────────────────────────────────────────

/**
 * Deja el Soul listo para la Sintonía: lo crea si falta y escribe los vínculos del diálogo.
 * Un despertar que se quedó a medias empieza de cero en los campos vinculados, para que
 * repetir el evento no acumule resonancia de intentos anteriores.
 * @returns {Promise<boolean>} false si el personaje ya despertó
 */
async function prepararSoul(characterId, ownerID, vinculos = []) {
    const soul = await Soul.findOne({ _id: characterId })
    if (soul?.isFinish === true) return false

    if (!soul) {
        await Soul.insertOne(soulInicial(characterId, ownerID))
    } else if (vinculos.length) {
        await Soul.updateOne({ _id: characterId }, { $set: Object.fromEntries(vinculos.map(v => [v.destino, 0])) })
    }

    await aplicarVinculos(vinculos, characterId)
    return true
}

/**
 * Envía la Sintonía inicial. Lo llama el hook `despertar_alma` al terminar el diálogo "despertar".
 * Si la interacción ya no admite respuesta (o no existe), se envía por MD.
 * @param {Object} params
 * @param {import('discord.js').Interaction} [params.interaction]
 * @param {import('discord.js').User} [params.user]
 * @param {Object} [params.charDoc] - Personaje del diálogo
 * @param {Object} [params.context] - Variables del diálogo
 * @param {{ pendientes: object[] }} [params.vinculos] - Variables vinculadas que el hook debe escribir
 */
async function despertarAlma({ interaction, user, charDoc, context = {}, vinculos }) {
    const destinatario = user ?? interaction?.user
    const characterId = charDoc?._id ?? context.characterId

    if (characterId === undefined || characterId === null) {
        console.error(`[Despertar] No se pudo identificar el personaje de ${destinatario?.id}: no se envía la Sintonía.`)
        return null
    }

    if (!await prepararSoul(characterId, destinatario?.id, vinculos?.pendientes)) {
        return destinatario?.send({ content: "Una estrella guarda aquello que resuena en tu alma." })
    }

    const mensaje = {
        components: uiSintonia({ userId: destinatario?.id ?? context.user_id, characterId }),
        flags: ["IsComponentsV2"],
    }

    try {
        if (interaction?.deferred || interaction?.replied) return await interaction.followUp(mensaje)
        if (interaction) return await interaction.reply(mensaje)
    } catch (error) {
        console.warn("[Despertar] No se pudo responder a la interacción, se envía por MD:", error.message)
    }

    return destinatario?.send(mensaje)
}

// ─── Handler ─────────────────────────────────────────────────────────────────

module.exports = crearStringSelectMenu({
    customId: ACTION,
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true },
    },
    optionNames: ["seleccion"],

    ejecutar: async function ({ interaction, character, soul, options: { seleccion } }) {
        const [etapa, respuesta] = String(seleccion ?? "").split("*")

        if (soul?.isFinish === true) {
            return responderEfimero(interaction, "Una estrella guarda aquello que resuena en tu alma.")
        }

        const ctx = { interaction, character, soul, respuesta }

        if (etapa === "rf") return elegirSintonia(ctx)
        if (etapa === "rf2") return elegirElemento(ctx)
        // Las preguntas R1..R5 del despertar antiguo ahora las lleva el sistema de diálogos
        return responderEfimero(interaction, "Esta opción ya no está disponible. Inicia el evento de nuevo.")
    },

    despertarAlma,
})
