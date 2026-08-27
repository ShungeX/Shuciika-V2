const clientdb = require("../../Server")
const db_rol = clientdb.db("Rol_db")
const personajes = db_rol.collection("Personajes")
const souls = db_rol.collection("Soul")

class Economy {

    // ─── Lumens ───────────────────────────────────────────────────────────────

    /**
     * Agrega o resta lumens a un personaje
     * @param {Number} characterId - _id del Personaje
     * @param {Number} cantidad - positivo = agregar, negativo = restar
     */
    async ajustarLumens(characterId, cantidad) {
        try {
            const update = {
                $inc: {
                    "economia.Lumens": cantidad,
                }
            }

            // Tracker histórico solo sube (solo si es ganancia)
            if (cantidad > 0) {
                update.$inc["estado.progresoAcumulativo.lumens"] = cantidad
            }

            await personajes.updateOne({ _id: characterId }, update)
            return { success: true }
        } catch (e) {
            console.error("Economy.ajustarLumens error:", e)
            return { success: false }
        }
    }

    // ─── XP ───────────────────────────────────────────────────────────────────

    /**
     * Agrega XP a un personaje y verifica si sube de nivel
     * @param {Number} characterId - _id del Soul (= _id del Personaje)
     * @param {Number} cantidad - XP a agregar
     * @param {String} fuente - "pvp" | "pve" | "mision" | "evento"
     * @param {Number} bonus - multiplicador (default 1)
     * @returns {{ success, levelUp, embed }}
     */
    async addXP(characterId, cantidad, fuente = "pvp", bonus = 1) {
        try {
            const xpFinal = Math.floor(cantidad * bonus)

            // Actualizar Soul
            await souls.updateOne({ _id: characterId }, {
                $inc: { "nucleo.polvoEstelar": xpFinal }
            })

            // Trackers históricos en Personaje
            const trackerUpdate = {
                $inc: {
                    "estado.progresoAcumulativo.xp": xpFinal
                }
            }

            if (fuente === "pvp") {
                trackerUpdate.$inc["estado.progresoAcumulativo.xpPvP"] = xpFinal
            } else if (fuente === "pve") {
                trackerUpdate.$inc["estado.progresoAcumulativo.xpPvE"] = xpFinal
            }

            await personajes.updateOne({ _id: characterId }, trackerUpdate)

            // Verificar nivel
            const soul = await souls.findOne({ _id: characterId })
            const currentPolvo = soul?.nucleo?.polvoEstelar ?? soul?.polvoEstelar ?? soul?.XP ?? 0;
            if (soul && currentPolvo >= (soul.xpRequired || soul.nucleo?.xpRequired || 1)) {
                return await this._subirNivel(soul, characterId)
            }

            return { success: true, levelUp: false }

        } catch (e) {
            console.error("Economy.addXP error:", e)
            return { success: false, levelUp: false }
        }
    }

    /**
     * Lógica de subida de nivel
     * @private
     */
    async _subirNivel(soul, characterId) {
        try {
            const nivelNuevo = soul.nivelMagico + 1
            const nextXPRequired = 50 + (nivelNuevo * (20 * nivelNuevo))
            const newHPMax = Math.floor(100 + (nivelNuevo ** 1.7) * 7)

            await souls.updateOne({ _id: characterId }, {
                $set: {
                    xpRequired: nextXPRequired,
                    "stats.hpMax": newHPMax,
                    HP: newHPMax           // se cura al subir de nivel
                },
                $inc: {
                    nivelMagico: 1,
                    StelarFragments: 1
                }
            })

            const embed = this._buildLevelUpEmbed(nivelNuevo)
            return { success: true, levelUp: true, nivelNuevo, embed }

        } catch (e) {
            console.error("Economy._subirNivel error:", e)
            return { success: false, levelUp: false }
        }
    }

    // ─── Combates ─────────────────────────────────────────────────────────────

    /**
     * Registra el resultado de un combate en los trackers
     * @param {Number} characterId
     * @param {Boolean} gano
     */
    async registrarCombate(characterId, gano) {
        try {
            const inc = { "estado.progresoAcumulativo.combatesJugados": 1 }
            if (gano) inc["estado.progresoAcumulativo.combatesGanados"] = 1

            await personajes.updateOne({ _id: characterId }, { $inc: inc })
            return { success: true }
        } catch (e) {
            console.error("Economy.registrarCombate error:", e)
            return { success: false }
        }
    }

    // ─── Recompensa de combate ────────────────────────────────────────────────

    /**
     * Aplica todas las recompensas/penalizaciones al terminar un combate
     * @param {Array} equipoGanador - array de Combatientes
     * @param {Array} equipoPerdedor - array de Combatientes
     * @param {Object} sesion
     */
    async combat(equipoGanador, equipoPerdedor, sesion) {
        const apuestas = sesion.apuestas
        const fuente = (sesion.type && sesion.type.toLowerCase() === "pve") ? "pve" : "pvp"
        const xpGanador = fuente === "pve" ? 30 : 10
        const xpPerdedor = fuente === "pve" ? 10 : 3  // recompensa de consolación

        const ops = []

        // ── Ganadores ─────────────────────────────────────────────────────
        for (const c of equipoGanador) {
            ops.push(this.addXP(c.ID, xpGanador, fuente))
            ops.push(this.registrarCombate(c.ID, true))

            if (apuestas?.tipo === "lumens" && apuestas.monto > 0) {
                ops.push(this.ajustarLumens(c.ID, apuestas.monto))
            }
        }

        // ── Perdedores ────────────────────────────────────────────────────
        for (const c of equipoPerdedor) {
            ops.push(this.addXP(c.ID, xpPerdedor, fuente))
            ops.push(this.registrarCombate(c.ID, false))

            if (apuestas?.tipo === "lumens" && apuestas.monto > 0) {
                ops.push(this.ajustarLumens(c.ID, -apuestas.monto))
            }
        }

        const resultados = await Promise.all(ops)

        // Verificar si alguien subió de nivel
        const levelUps = resultados.filter(r => r?.levelUp)

        return { success: true, levelUps }
    }

    // ─── UI de nivel ──────────────────────────────────────────────────────────

    _buildLevelUpEmbed(nivelNuevo) {
        const { EmbedBuilder } = require("discord.js")

        const titulos = [
            "Una estrella nace en tu interior.",
            "Un ascenso hacia las estrellas",
            "Las estrellas te observan con atención",
        ]

        const descripciones = [
            "«El universo susurra: 'Eres luz hecha forma'»",
            "«Las galaxias giran en torno a tu voluntad.»",
            "«Los cielos premian a los audaces.»",
        ]

        const gifs = [
            "https://c.tenor.com/lwazM6r0VtIAAAAd/tenor.gif",
            "https://c.tenor.com/H3dQ4D3SiKoAAAAC/tenor.gif",
            "https://c.tenor.com/4MBK5F7GgowAAAAd/tenor.gif",
        ]

        const titulo = titulos[Math.floor(Math.random() * titulos.length)]
        const desc = descripciones[Math.floor(Math.random() * descripciones.length)]
        const gif = gifs[Math.floor(Math.random() * gifs.length)]

        return new EmbedBuilder()
            .setTitle(titulo)
            .setDescription(
                `**¡Felicidades! Has subido al nivel \`${nivelNuevo}\`**\n` +
                `*Tus estadísticas han aumentado*\n\n` +
                `-# ${desc}`
            )
            .addFields({ name: "Has obtenido", value: "<a:KrisJojos:1350664814414004395> **1** *Fragmento estelar*" })
            .setColor("Random")
            .setImage(gif)
            .setTimestamp()
    }
}

module.exports = new Economy()