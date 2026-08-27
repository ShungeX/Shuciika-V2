const clientdb = require("../../Server")
const db_rol = clientdb.db("Rol_db")
const souls = db_rol.collection("Soul")
const characters = db_rol.collection("Personajes")
const dbobjetos = db_rol.collection("Objetos_globales")
const Economy = require("./Economia")
const CombatUI = require("../Duelo/combateUI")
const calculadorPVEstelar = require("./calculadorPVEstelar.js")
const lootSystem = require("./lootSystem.js")
const congelarHelper = require("./congelarHelper")


class RewardCalculator {

    /**
     * Resuelve el fin de combate completo:
     * recompensas, MongoDB, UI y limpieza de sesión
     * @param {sesionCombate} sesion
     * @param {Array} equipoGanador
     * @param {Array} equipoPerdedor  
     * @param {Client} client
     */
    async resolve(sesion, equipoGanador = [], equipoPerdedor = [], client) {
        try {
            const winTeam = Array.isArray(equipoGanador) ? equipoGanador : [];
            const lossTeam = Array.isArray(equipoPerdedor) ? equipoPerdedor : [];

            // Excepción especial "Todos AFK": nadie pierde recompensas ni cuenta como derrota
            if (sesion.typeWin === "afk" || (sesion.todosCombatientesAFK && sesion.todosCombatientesAFK())) {
                console.log(`[RewardCalculator] El combate ${sesion.sessionId} finalizó por 'todos AFK'. Omitiendo recompensas y derrotas (resolución neutral).`);
                return { recompensas: new Map() };
            }

            // Solo establecer HP en 0 para los que fueron realmente derrotados (HP <= 0), los que se rindieron o quedaron vivos conservan su HP
            lossTeam.forEach(c => {
                if (c && c.HP <= 0) c.HP = 0;
            });

            if (sesion.modeTest) {
                console.log(`[RewardCalculator] La sesión ${sesion.sessionId} está en modo prueba (modeTest: true). Omitiendo procesamiento de recompensas y guardado de HP/Mana.`);
                return { recompensas: new Map() };
            }

            // ── Guardar HP y Maná de todos en Soul ────────────────────────
            await Promise.all(
                sesion.getAllCombatientes()
                    .filter(c => !c.isNPC)
                    .map(c => 
                        souls.updateOne({ _id: Number(c.ID) }, {
                            $set: { "nucleo.HP": c.HP, "nucleo.Mana": c.Mana }
                        })
                    )
            );

            if (sesion.type && sesion.type.toLowerCase() === "pvp") {
                if (sesion.apuestas) {
                    const recompensasApuesta = await this._resolverApuesta(sesion, equipoGanador, equipoPerdedor);
                    console.log(recompensasApuesta);
                    return recompensasApuesta;
                } else {
                    return { recompensas: new Map() };
                }
            }

            const recompensas = new Map();
            const enemigo = sesion.enemigoId ?? "base";

            const procesarCombatiente = async(combatiente, isWinner) => {
                if(combatiente.isNPC) return;

                // Un combatiente marcado afk: true cuenta como derrota personal para efectos de recompensas,
                // sin importar si su equipo termina ganando o perdiendo el duelo.
                const esAFK = combatiente.afk === true || (sesion.esAFK && sesion.esAFK(combatiente.ID));
                const esGanadorEfectivo = isWinner && !esAFK;

                const historialPersonal = (sesion.historialAcciones || [])
                    .filter(a => a.ID === combatiente.ID)
                    .map(a => a.accion);

                const {polvoEstelar = 0, lumens = 0} = await calculadorPVEstelar.calcularRecompensas(
                    sesion.type,
                    sesion.subtype,
                    combatiente,
                    { historialAcciones: historialPersonal,
                    esGanador: esGanadorEfectivo }
                );

                const loot = esGanadorEfectivo ? lootSystem.generarLootFinal(
                    enemigo,
                    combatiente,
                    calculadorPVEstelar._calcularEntropia(historialPersonal)
                ) : null;

                const incSoul = { "nucleo.polvoEstelar": polvoEstelar };
                if (sesion.enemigoId && combatiente.pity !== undefined && combatiente.pity !== null && !isNaN(Number(combatiente.pity))) {
                    incSoul[`pity.${sesion.enemigoId}`] = Number(combatiente.pity);
                }

                await Promise.all([
                    souls.updateOne({ _id: Number(combatiente.ID) }, { $inc: incSoul }),
                    characters.updateOne({ _id: Number(combatiente.ID) }, { $inc: { "economia.Lumens": lumens } })
                ]).catch(err => console.error("[RewardCalculator] Error actualizando DB para combatiente:", err));

                recompensas.set(Number(combatiente.ID), { polvo: polvoEstelar, lumens, loot, isWinner: esGanadorEfectivo });
            };

            await Promise.all([
                ...winTeam.map(c => procesarCombatiente(c, true)),
                ...lossTeam.map(c => procesarCombatiente(c, false))
            ]);

            const result = { recompensas };
            sesion.rewardsMap = result;
            return result;

        } catch (e) {
            console.error("RewardCalculator.resolve error:", e);
            const fallback = { recompensas: new Map() };
            sesion.rewardsMap = fallback;
            return fallback;
        }
    }

    async _resolverApuesta(sesion, equipoGanador, equipoPerdedor) {
        try {
            const apuestas = sesion.apuestas;
            const tipoApuesta = sesion.tipoApuesta || 'espejo';

            const totalGanadores = equipoGanador.length;
            const totalPerdedores = equipoPerdedor.length;

            const creadorCharacter = sesion.teams[0] && sesion.teams[0][0]; 
            const creadorId = creadorCharacter ? Number(creadorCharacter.ID) : null;

            const recompensas = new Map();

            // 1. Determinar el POZO TOTAL de lumens y objetos que se disputan
            let pozoLumens = 0;
            let pozoObjetos = []; // Array de { id, nombre, cantidad }

            if (apuestas.adminObjetos) {
                // Si es admin objetos, el pozo de objetos siempre se genera del config del creador
                pozoObjetos = (apuestas.objetos || []).map(o => ({
                    id: o.id ?? o.ID,
                    nombre: o.nombre ?? o.Nombre,
                    cantidad: Number(o.cantidad ?? o.Cantidad) || 0
                }));
            }

            if (apuestas.adminLumens) {
                // Si es admin lumens, el pozo siempre se genera de la apuesta del creador
                pozoLumens = Number(apuestas.lumens) || 0;
            }

            if (!apuestas.adminLumens) {
                if (tipoApuesta === 'libre') {
                    const creadorPerdio = equipoPerdedor.some(c => Number(c.ID) === creadorId);
                    if (creadorPerdio) {
                        pozoLumens = Number(apuestas.lumens) || 0;
                    }
                } else {
                    pozoLumens = totalPerdedores * (Number(apuestas.lumens) || 0);
                }
            }

            if (!apuestas.adminObjetos) {
                if (tipoApuesta === 'libre') {
                    const creadorPerdio = equipoPerdedor.some(c => Number(c.ID) === creadorId);
                    if (creadorPerdio) {
                        pozoObjetos = (apuestas.objetos || []).map(o => ({
                            id: o.id ?? o.ID,
                            nombre: o.nombre ?? o.Nombre,
                            cantidad: Number(o.cantidad ?? o.Cantidad) || 0
                        }));
                    }
                } else {
                    if (tipoApuesta === 'espejo') {
                        for (const o of (apuestas.objetos || [])) {
                            pozoObjetos.push({
                                id: o.id ?? o.ID,
                                nombre: o.nombre ?? o.Nombre,
                                cantidad: (Number(o.cantidad ?? o.Cantidad) || 0) * totalPerdedores
                            });
                        }
                    } else if (tipoApuesta === 'fijo') {
                        const creadorPerdio = equipoPerdedor.some(c => Number(c.ID) === creadorId);
                        if (creadorPerdio) {
                            pozoObjetos = (apuestas.objetos || []).map(o => ({
                                id: o.id ?? o.ID,
                                nombre: o.nombre ?? o.Nombre,
                                cantidad: Number(o.cantidad ?? o.Cantidad) || 0
                            }));
                        }
                    }
                }
            }

            // 2. Procesar las pérdidas de los perdedores y acumular objetos de Rareza Equivalente
            for (const loser of equipoPerdedor) {
                let lumensPerdidos = 0;
                let objetosPerdidos = [];

                if (tipoApuesta === 'libre') {
                    if (Number(loser.ID) === creadorId) {
                        lumensPerdidos = apuestas.lumens || 0;
                        objetosPerdidos = (apuestas.objetos || []).map(o => ({
                            id: o.id ?? o.ID,
                            nombre: o.nombre ?? o.Nombre,
                            cantidad: o.cantidad ?? o.Cantidad ?? 0
                        }));
                    }
                } else {
                    lumensPerdidos = apuestas.lumens || 0;

                    if (tipoApuesta === 'espejo') {
                        objetosPerdidos = (apuestas.objetos || []).map(o => ({
                            id: o.id ?? o.ID,
                            nombre: o.nombre ?? o.Nombre,
                            cantidad: o.cantidad ?? o.Cantidad ?? 0
                        }));
                    } else if (tipoApuesta === 'fijo') {
                        if (Number(loser.ID) === creadorId) {
                            objetosPerdidos = (apuestas.objetos || []).map(o => ({
                                id: o.id ?? o.ID,
                                nombre: o.nombre ?? o.Nombre,
                                cantidad: o.cantidad ?? o.Cantidad ?? 0
                            }));
                        }
                    } else if (tipoApuesta === 'equivalente') {
                        // Buscar objeto equivalente en congelados o en el inventario activo del perdedor
                        const character = await characters.findOne({ _id: Number(loser.ID) });
                        const inventario = character?.economia?.Inventario || [];
                        const congeladoObj = character?.economia?.congelado?.objetos || [];

                        const creadorChar = creadorId ? await characters.findOne({ _id: Number(creadorId) }) : null;
                        const creadorInv = creadorChar?.economia?.Inventario || [];

                        for (const reqObj of (apuestas.objetos || [])) {
                            const reqId = reqObj.id ?? reqObj.ID;
                            const reqNombre = reqObj.nombre ?? reqObj.Nombre;
                            const reqCantidad = reqObj.cantidad ?? reqObj.Cantidad ?? 0;

                            const creatorItem = creadorInv.find(i => 
                                (i.ID !== undefined && String(i.ID) === String(reqId)) ||
                                (i.Nombre && reqNombre && i.Nombre.toLowerCase() === reqNombre.toLowerCase())
                            );
                            const requiredRarity = creatorItem?.Rareza;

                            if (requiredRarity) {
                                // Buscar primero en congelado
                                const matchingItem = congeladoObj.find(i => 
                                    ((i.id !== undefined && String(i.id) === String(reqId)) ||
                                    (i.nombre && reqNombre && i.nombre.toLowerCase() === reqNombre.toLowerCase())) &&
                                    (i.cantidad ?? i.Cantidad ?? 0) >= reqCantidad
                                );
                                if (matchingItem) {
                                    const itemPerdido = {
                                        id: matchingItem.id,
                                        nombre: matchingItem.nombre,
                                        cantidad: reqCantidad
                                    };
                                    objetosPerdidos.push(itemPerdido);
                                    pozoObjetos.push({ ...itemPerdido });
                                } else {
                                    // Si no estaba congelado por algún motivo, buscar en inventario
                                    const matchingInv = inventario.find(i => 
                                        i.Rareza === requiredRarity && 
                                        (i.Cantidad ?? i.cantidad ?? 0) >= reqCantidad
                                    );
                                    if (matchingInv) {
                                        const itemPerdido = {
                                            id: matchingInv.ID || matchingInv.id,
                                            nombre: matchingInv.Nombre || matchingInv.nombre,
                                            cantidad: reqCantidad
                                        };
                                        objetosPerdidos.push(itemPerdido);
                                        pozoObjetos.push({ ...itemPerdido });
                                    }
                                }
                            }
                        }
                    }
                }

                // Si los recursos fueron creados en Modo Admin, no se le descuentan al creador
                const esCreadorPerdedor = Number(loser.ID) === creadorId;
                const lumensADescontar = (esCreadorPerdedor && apuestas.adminLumens) ? 0 : lumensPerdidos;
                const objetosADescontar = (esCreadorPerdedor && apuestas.adminObjetos) ? [] : objetosPerdidos;

                // Aplicar pérdidas al perdedor
                const char = await characters.findOne({ _id: Number(loser.ID) });
                if (char) {
                    const hasFrozen = char.economia?.congelado && 
                        ((char.economia.congelado.lumens || 0) > 0 || (char.economia.congelado.objetos || []).length > 0);

                    if (hasFrozen) {
                        // Descongelar y remover de congelados sin restaurar a inventario activo
                        await congelarHelper.removerCongeladoSinRestaurar(Number(loser.ID), lumensADescontar, objetosADescontar);
                    } else {
                        // Si no estaba congelado (ej: creador admin), descontar del activo
                        let currentLumens = char.economia?.Lumens ?? 0;
                        currentLumens = Math.max(0, currentLumens - lumensADescontar);

                        const inventario = char.economia?.Inventario || [];
                        for (const o of objetosADescontar) {
                            const itemIdx = inventario.findIndex(i => 
                                (i.ID !== undefined && String(i.ID) === String(o.id)) || 
                                (i.Nombre && o.nombre && i.Nombre.toLowerCase() === o.nombre.toLowerCase())
                            );
                            if (itemIdx !== -1) {
                                const cant = inventario[itemIdx].Cantidad ?? inventario[itemIdx].cantidad ?? 0;
                                const nuevaCant = Math.max(0, cant - o.cantidad);
                                if (nuevaCant === 0) {
                                    inventario.splice(itemIdx, 1);
                                } else {
                                    if (typeof inventario[itemIdx].Cantidad !== 'undefined') inventario[itemIdx].Cantidad = nuevaCant;
                                    else inventario[itemIdx].cantidad = nuevaCant;
                                }
                            }
                        }

                        await characters.updateOne({ _id: Number(loser.ID) }, {
                            $set: {
                                "economia.Lumens": currentLumens,
                                "economia.Inventario": inventario
                            }
                        });
                    }
                }

                recompensas.set(Number(loser.ID), {
                    lumens: -lumensPerdidos,
                    objetos: objetosPerdidos.map(o => ({ ...o, cantidad: -o.cantidad })),
                    isWinner: false
                });
            }

            // 3. Distribución del POZO a los Ganadores (Con división exacta y sorteo de residuo)
            const winnerPrizes = new Map();
            for (const winner of equipoGanador) {
                winnerPrizes.set(winner.ID, { lumens: 0, objetos: [] });
            }

            // Distribuir lumens del pozo
            if (pozoLumens > 0 && totalGanadores > 0) {
                const baseLumens = Math.floor(pozoLumens / totalGanadores);
                const residueLumens = pozoLumens % totalGanadores;

                for (const winner of equipoGanador) {
                    winnerPrizes.get(winner.ID).lumens += baseLumens;
                }

                if (residueLumens > 0) {
                    const luckyWinner = equipoGanador[Math.floor(Math.random() * totalGanadores)];
                    winnerPrizes.get(luckyWinner.ID).lumens += residueLumens;
                }
            }

            // Distribuir objetos del pozo sin duplicar (sin garantía de mínimo 1)
            if (pozoObjetos.length > 0 && totalGanadores > 0) {
                for (const o of pozoObjetos) {
                    const baseQty = Math.floor(o.cantidad / totalGanadores);
                    const residueQty = o.cantidad % totalGanadores;

                    if (baseQty > 0) {
                        for (const winner of equipoGanador) {
                            winnerPrizes.get(winner.ID).objetos.push({
                                id: o.id,
                                nombre: o.nombre,
                                cantidad: baseQty
                            });
                        }
                    }

                    if (residueQty > 0) {
                        const luckyWinner = equipoGanador[Math.floor(Math.random() * totalGanadores)];
                        const wObjList = winnerPrizes.get(luckyWinner.ID).objetos;
                        const existingIdx = wObjList.findIndex(item => item.id === o.id || item.nombre === o.nombre);
                        if (existingIdx !== -1) {
                            wObjList[existingIdx].cantidad += residueQty;
                        } else {
                            wObjList.push({
                                id: o.id,
                                nombre: o.nombre,
                                cantidad: residueQty
                            });
                        }
                    }
                }
            }

            // 4. Aplicar premios y ganancias (descongelando primero recursos propios si aplica)
            for (const winner of equipoGanador) {
                const prize = winnerPrizes.get(winner.ID);

                // Primero, si tenía recursos propios en el congelado, descongelarlos y devolverlos
                const char = await characters.findOne({ _id: Number(winner.ID) });
                if (char && char.economia?.congelado) {
                    await congelarHelper.descongelar(Number(winner.ID), char.economia.congelado.lumens, char.economia.congelado.objetos);
                }

                // Sumar premios ganados del pozo al activo
                if (prize.lumens > 0 || prize.objetos.length > 0) {
                    const charActualizado = await characters.findOne({ _id: Number(winner.ID) });
                    if (charActualizado) {
                        let currentLumens = charActualizado.economia?.Lumens ?? 0;
                        currentLumens += prize.lumens;

                        const inventario = charActualizado.economia?.Inventario || [];
                        for (const o of prize.objetos) {
                            const itemIdx = inventario.findIndex(i => 
                                (i.ID !== undefined && String(i.ID) === String(o.id)) || 
                                (i.Nombre && o.nombre && i.Nombre.toLowerCase() === o.nombre.toLowerCase())
                            );
                            if (itemIdx !== -1) {
                                if (typeof inventario[itemIdx].Cantidad !== 'undefined') inventario[itemIdx].Cantidad += o.cantidad;
                                else inventario[itemIdx].cantidad += o.cantidad;
                            } else {
                                // Buscar plantilla completa del objeto en Objetos_globales por su ID
                                const globalItemDoc = await dbobjetos.findOne(
                                    {
                                        $or: [
                                            { "Objetos.ID": o.id },
                                            { "Objetos.ID": Number(o.id) },
                                            { "Objetos.ID": String(o.id) }
                                        ]
                                    },
                                    { projection: { _id: 1, "Objetos.$": 1 } }
                                );
                                const globalItem = globalItemDoc?.Objetos?.[0];
                                if (globalItem) {
                                    inventario.push({
                                        ID: Number(globalItem.ID),
                                        Nombre: String(globalItem.Nombre),
                                        Region: String(globalItemDoc._id),
                                        Tipo: globalItem.Tipo,
                                        Cantidad: Number(o.cantidad),
                                        Fecha: new Date().toISOString()
                                    });
                                } else {
                                    inventario.push({
                                        ID: Number(o.id) || o.id,
                                        Nombre: String(o.nombre),
                                        Cantidad: Number(o.cantidad),
                                        Fecha: new Date().toISOString()
                                    });
                                }
                            }
                        }

                        await characters.updateOne({ _id: Number(winner.ID) }, {
                            $set: {
                                "economia.Lumens": currentLumens,
                                "economia.Inventario": inventario
                            }
                        });
                    }
                }

                recompensas.set(Number(winner.ID), {
                    lumens: prize.lumens,
                    objetos: prize.objetos,
                    isWinner: true
                });
            }

            return { recompensas };
        } catch (error) {
            console.error("Error al resolver apuestas de PvP:", error);
            return { recompensas: new Map() };
        }
    }
}

module.exports = new RewardCalculator()