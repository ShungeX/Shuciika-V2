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
const { moverLumens } = require("./lumens")
const { esCombateAmistoso, serializarEfectos } = require("../Duelo/efectosPersistentes")
const { aplicarCalor } = require("./sistemaCalor")
const updateInventario = require("../updateInventario")
const catalogoObjetos = require("../catalogoObjetos")
const utilidadesTexto = require("../../utils/utilidadesTexto")

/** "30-50" → entero al azar en el rango; "5" → 5 */
function tirarCantidad(texto) {
    const [a, b] = String(texto ?? "1").split("-").map(n => Number(n.trim()))
    const min = Number.isFinite(a) ? a : 1
    const max = Number.isFinite(b) ? b : min
    return Math.floor(min + Math.random() * (Math.max(min, max) - min + 1))
}


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

            // ── Guardar HP, Maná y efectos activos de todos en Soul ───────
            // Los efectos se quedan en el personaje salvo en combates amistosos
            const amistoso = esCombateAmistoso(sesion);
            await Promise.all(
                sesion.getAllCombatientes()
                    .filter(c => !c.isNPC)
                    .map(c => {
                        const set = { "nucleo.HP": c.HP, "nucleo.Mana": c.Mana };
                        if (!amistoso) set["nucleo.efectos"] = serializarEfectos(c.statusEffect);
                        return souls.updateOne({ _id: Number(c.ID) }, { $set: set });
                    })
            );

            // ── Calor: cualquier combate real cuenta como actividad del día ──
            const calores = new Map(await Promise.all(
                sesion.getAllCombatientes()
                    .filter(c => !c.isNPC)
                    .map(async c => [Number(c.ID), await aplicarCalor(c.ID).catch(err => {
                        console.error("[RewardCalculator] Error aplicando calor:", err);
                        return null;
                    })])
            ));

            // PvP = ningún NPC en combate (salas clásicas, amistosas, retos directos): solo apuestas
            const esPvP = !sesion.getAllCombatientes().some(c => c.isNPC);
            if (esPvP) {
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
            const subtipo = this._subtipoCombate(sesion);

            const procesarCombatiente = async(combatiente, isWinner) => {
                if(combatiente.isNPC) return;

                // Un combatiente marcado afk: true cuenta como derrota personal para efectos de recompensas,
                // sin importar si su equipo termina ganando o perdiendo el duelo.
                const esAFK = combatiente.afk === true || (sesion.esAFK && sesion.esAFK(combatiente.ID));
                const esGanadorEfectivo = isWinner && !esAFK;

                const historialPersonal = (sesion.historialAcciones || [])
                    .filter(a => a.ID === combatiente.ID)
                    .map(a => a.accion);

                const jugador = await this._contextoJugador(combatiente, calores.get(Number(combatiente.ID)));

                // Base: el loot de Polvo/Lumens de los NPCs rivales (si lo tienen); si no, la tabla del documento
                const esExploracion = String(sesion.type || "").toLowerCase() === "exploration";
                const rivales = this._npcsRivales(sesion, combatiente);
                const baseNPC = this._baseLootNPC(rivales);

                // Escaramuza (exploración): retornos menguantes por combate del día
                let factor = { polvo: 1, lumens: 1 };
                if (esExploracion) {
                    const n = await this._siguienteEscaramuza(combatiente.ID);
                    const fDia = calculadorPVEstelar.factorEscaramuza(n);
                    const { ESCARAMUZA } = calculadorPVEstelar;
                    // El recorte de escaramuza solo aplica a la tabla; el loot del NPC ya es su propia base
                    factor = {
                        polvo: fDia * (baseNPC.polvo === undefined ? ESCARAMUZA.polvo : 1),
                        lumens: fDia * (baseNPC.lumens === undefined ? ESCARAMUZA.lumens : 1),
                    };
                }

                const { polvo: polvoEstelar = 0, lumens = 0 } = await calculadorPVEstelar.calcularRecompensas(
                    "combate",
                    subtipo,
                    jugador,
                    { historialAcciones: historialPersonal,
                    esGanador: esGanadorEfectivo,
                    base: baseNPC,
                    factor }
                );

                // Objetos del loot de los NPCs: solo para el ganador (en exploración van al talismán)
                const objetosNPC = esGanadorEfectivo
                    ? await this._entregarObjetosNPC(rivales, combatiente.ID, esExploracion)
                    : [];
                const lootPool = esGanadorEfectivo ? lootSystem.generarLootFinal(
                    enemigo,
                    combatiente,
                    calculadorPVEstelar._calcularEntropia(historialPersonal)
                ) : null;
                const loot = [...objetosNPC, ...(Array.isArray(lootPool) ? lootPool : [])];

                const incSoul = { "nucleo.polvoEstelar": polvoEstelar };
                if (sesion.enemigoId && combatiente.pity !== undefined && combatiente.pity !== null && !isNaN(Number(combatiente.pity))) {
                    incSoul[`pity.${sesion.enemigoId}`] = Number(combatiente.pity);
                }

                await Promise.all([
                    souls.updateOne({ _id: Number(combatiente.ID) }, { $inc: incSoul }),
                    lumens > 0 && moverLumens({
                        personajeId: Number(combatiente.ID), delta: lumens, motivo: "combate",
                        opId: `combate:${sesion.sessionId}:${combatiente.ID}`,
                        ref: { tipo: sesion.type, subtipo: sesion.subtype, enemigo, gano: esGanadorEfectivo },
                    })
                ]).catch(err => console.error("[RewardCalculator] Error actualizando DB para combatiente:", err));

                recompensas.set(Number(combatiente.ID), { polvo: polvoEstelar, lumens, loot: loot.length ? loot : null, isWinner: esGanadorEfectivo });
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

    /**
     * Subtipo de recompensa del combate (tablas de "Sistema de Polvo Estelar"):
     * heraldo si hay un NPC heraldo, grieta si hay un jefe, duelo en cualquier otro caso.
     * Si la sesión ya trae un subtipo explícito, se respeta.
     */
    _subtipoCombate(sesion) {
        if (sesion.subtype) return sesion.subtype;
        const npcs = sesion.getAllCombatientes().filter(c => c.isNPC);
        if (npcs.some(n => n.esHeraldo)) return "heraldo";
        if (npcs.some(n => n.esJefe)) return "grieta";
        return "duelo";
    }

    /**
     * Datos del jugador que pesan en el Polvo: Resplandor (Soul.sendero),
     * Calor y antigüedad (Personajes). Se leen frescos de la BD al terminar el combate.
     */
    async _contextoJugador(combatiente, calor = null) {
        const id = Number(combatiente.ID);
        const [soul, personaje] = await Promise.all([
            souls.findOne({ _id: id }, { projection: { "sendero.resplandor": 1 } }),
            characters.findOne({ _id: id }, { projection: { "actividad.calor.puntos": 1, "metadata.fechaCreacion": 1 } })
        ]);
        const creadoSeg = Number(personaje?.metadata?.fechaCreacion);
        return {
            resplandor: soul?.sendero?.resplandor ?? combatiente.resplandor ?? "I",
            // El Calor recién actualizado (con enfriamiento aplicado) tiene prioridad sobre el guardado
            calor: Number(calor?.puntos ?? personaje?.actividad?.calor?.puntos) || 0,
            diasRegistrado: Number.isFinite(creadoSeg) && creadoSeg > 0
                ? (Date.now() - creadoSeg * 1000) / 86400000
                : undefined,
            bonuses: combatiente.bonuses || [],
        };
    }

    /** NPCs del bando contrario al combatiente (los aliados no sueltan loot). */
    _npcsRivales(sesion, combatiente) {
        const equipo = (sesion.teams || []).find(t => t.some(c => c === combatiente || String(c.ID) === String(combatiente.ID)));
        return (sesion.teams || []).filter(t => t !== equipo).flat().filter(c => c?.isNPC);
    }

    /**
     * Tira el loot de Polvo/Lumens de los NPCs rivales y lo suma como base de la fórmula.
     * Un campo queda undefined si ningún rival tiene ese tipo de loot (entonces se usa la tabla).
     */
    _baseLootNPC(rivales) {
        const base = {};
        for (const npc of rivales) {
            for (const l of npc.loot || []) {
                const tipo = l.typeLoot === "polvo" ? "polvo" : l.typeLoot === "lumens" ? "lumens" : null;
                if (!tipo) continue;
                base[tipo] = base[tipo] ?? 0;
                if (Math.random() < Number(l.dropRate ?? 1)) base[tipo] += tirarCantidad(l.quantity);
            }
        }
        return base;
    }

    /** Número de escaramuza de hoy del personaje (el contador se reinicia a las 00:00 México). */
    async _siguienteEscaramuza(characterId) {
        const id = Number(characterId);
        const dia = utilidadesTexto.reinicio24hrs(Math.floor(Date.now() / 1000));
        const pj = await characters.findOne({ _id: id }, { projection: { "actividad.escaramuzas": 1 } });
        const previo = pj?.actividad?.escaramuzas;
        const n = previo?.reinicio === dia ? (Number(previo.hoy) || 0) + 1 : 1;
        await characters.updateOne({ _id: id }, { $set: { "actividad.escaramuzas": { reinicio: dia, hoy: n } } });
        return n;
    }

    /** Tira y entrega los objetos del loot de los NPCs rivales. Devuelve [{ nombre, cantidad }] para la UI. */
    async _entregarObjetosNPC(rivales, characterId, aTalisman) {
        const entregados = [];
        for (const npc of rivales) {
            for (const l of npc.loot || []) {
                if (l.typeLoot !== "item" || !Array.isArray(l.itemId)) continue;
                if (Math.random() >= Number(l.dropRate ?? 0)) continue;
                const [region, id] = l.itemId;
                const cantidad = tirarCantidad(l.quantity);
                const def = catalogoObjetos.getObjetoPorId(region, Number(id));
                const r = await updateInventario(null, null, Number(characterId), {
                    isItem: true, ID: Number(id), Region: region, cantidad, isTalisman: aTalisman,
                }).catch(err => ({ success: false, messages: err?.message }));
                if (r?.success === false) {
                    console.warn(`[RewardCalculator] No se pudo entregar ${region}:${id} a ${characterId}:`, r?.messages);
                    continue;
                }
                entregados.push({ nombre: def?.Nombre || `Objeto ${id}`, cantidad });
            }
        }
        return entregados;
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

            // Libro de Lumens: lo que pasa de perdedores a ganadores es transferencia; lo que el pozo
            // paga de más (apuestas de admin) es fuente y lo que nadie cobra es sumidero. Así M cuadra.
            const sid = sesion.sessionId
            const premioPrevisto = totalGanadores > 0 ? pozoLumens : 0
            let porTransferir = premioPrevisto   // cupo que los perdedores aún pueden mandar como transferencia
            let transferido = 0                  // lo que de verdad salió de perdedores como transferencia

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

                    // Lumens: del congelado si apostó congelando, si no del saldo activo (sin pasar de lo que tiene)
                    const disponible = hasFrozen ? (char.economia?.congelado?.lumens ?? 0) : (char.economia?.Lumens ?? 0)
                    const aCobrar = Math.min(lumensADescontar, Math.max(0, disponible))
                    const parteTransfer = Math.min(aCobrar, porTransferir)
                    const parteSumidero = aCobrar - parteTransfer
                    porTransferir -= parteTransfer
                    if (parteTransfer > 0) {
                        const r = await moverLumens({
                            personajeId: Number(loser.ID), delta: -parteTransfer, tipo: "transferencia", motivo: "duelo",
                            transferId: sid, opId: `duelo:${sid}:pierde:${loser.ID}`, desdeCongelado: hasFrozen,
                        })
                        if (r.ok) transferido += parteTransfer
                    }
                    if (parteSumidero > 0) {
                        await moverLumens({
                            personajeId: Number(loser.ID), delta: -parteSumidero, motivo: "duelo",
                            opId: `duelo:${sid}:pierde_sin_ganador:${loser.ID}`, desdeCongelado: hasFrozen,
                        })
                    }

                    if (hasFrozen) {
                        // Remover objetos congelados sin restaurarlos al inventario activo
                        await congelarHelper.removerCongeladoSinRestaurar(Number(loser.ID), objetosADescontar);
                    } else {
                        // Si no estaba congelado (ej: creador admin), descontar objetos del activo

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
                // Lumens del pozo: primero lo que mandaron los perdedores (transferencia), el resto es fuente
                if (prize.lumens > 0) {
                    const deTransfer = Math.min(prize.lumens, transferido)
                    const deFuente = prize.lumens - deTransfer
                    transferido -= deTransfer
                    if (deTransfer > 0) {
                        await moverLumens({
                            personajeId: Number(winner.ID), delta: deTransfer, tipo: "transferencia", motivo: "duelo",
                            transferId: sid, opId: `duelo:${sid}:gana:${winner.ID}`,
                        })
                    }
                    if (deFuente > 0) {
                        await moverLumens({
                            personajeId: Number(winner.ID), delta: deFuente, motivo: "duelo",
                            opId: `duelo:${sid}:premio:${winner.ID}`, ref: { adminLumens: Boolean(apuestas.adminLumens) },
                        })
                    }
                }

                if (prize.objetos.length > 0) {
                    const charActualizado = await characters.findOne({ _id: Number(winner.ID) });
                    if (charActualizado) {

                        const inventario = charActualizado.economia?.Inventario || [];
                        // Máximo en inventario: el ganador solo recibe lo que le cabe; lo demás se pierde con el duelo
                        const { limitarEntradas } = require("../Objetos/limiteInventario");
                        const limitePremio = await limitarEntradas(charActualizado, prize.objetos);
                        if (limitePremio.aviso) {
                            console.log(`[Duelo] ${winner.ID} no recibió parte del premio por el máximo en inventario: ${limitePremio.aviso}`);
                            prize.objetos = limitePremio.admitidos;
                            prize.avisoInventario = limitePremio.aviso;
                        }
                        for (const o of limitePremio.admitidos) {
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
                                "economia.Inventario": inventario
                            }
                        });
                    }
                }

                recompensas.set(Number(winner.ID), {
                    lumens: prize.lumens,
                    objetos: prize.objetos,
                    avisoInventario: prize.avisoInventario || null,
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