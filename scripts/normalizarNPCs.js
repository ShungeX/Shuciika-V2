require('dotenv').config({ path: __dirname + '/../.env' });
const { MongoClient } = require('mongodb');

async function normalizarNPCs() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error("No MONGODB_URI found in .env!");
        return;
    }
    const client = new MongoClient(mongoUri, { family: 4 });

    try {
        await client.connect();
        console.log("Conectado exitosamente a MongoDB para normalizar la base de datos de NPCs...");
        const db = client.db("Rol_db");
        const npcsCol = db.collection("NPCs");

        const npcs = await npcsCol.find({}).toArray();
        console.log(`Analizando ${npcs.length} NPCs en la colección NPCs...`);

        let modificados = 0;

        for (const npc of npcs) {
            let update = false;
            const setFields = {};

            // 1. nivelMagico
            if (typeof npc.nivelMagico === 'undefined' || npc.nivelMagico === null) {
                const fe = npc.restrictions?.fe_min || npc.stats?.nivelMagico || 1;
                setFields.nivelMagico = Number(fe);
                update = true;
            }

            // 2. Elemento
            if (!npc.Elemento) {
                setFields.Elemento = npc.elemento || "Neutro";
                update = true;
            }

            // 3. Normalizar stats
            const stats = npc.stats || {};
            const newStats = { ...stats };

            const hpMax = Number(stats.hpMax || npc.HP || 100);
            const manaMax = Number(stats.manaMax || npc.Mana || 50);
            const resFis = Number(stats.resFisica ?? stats.resistenciaFisica ?? 5);
            const resMag = Number(stats.resMagica ?? stats.resistenciaMagica ?? 5);

            newStats.resFisica = resFis;
            newStats.resistenciaFisica = resFis;
            newStats.resMagica = resMag;
            newStats.resistenciaMagica = resMag;
            newStats.hpMax = hpMax;
            newStats.manaMax = manaMax;
            newStats.fuerza = Number(stats.fuerza || 5);
            newStats.agilidad = Number(stats.agilidad || 5);
            newStats.sabiduria = Number(stats.sabiduria || 5);
            newStats.inteligencia = Number(stats.inteligencia || 5);
            newStats.sintonia = Number(stats.sintonia || 1);
            newStats.precision = Number(stats.precision || 100);

            if (JSON.stringify(newStats) !== JSON.stringify(stats)) {
                setFields.stats = newStats;
                update = true;
            }

            // 4. Normalizar ataques
            if (Array.isArray(npc.ataques) && npc.ataques.length > 0) {
                const nuevosAtaques = npc.ataques.map((atk, idx) => {
                    const normAtk = { ...atk };
                    normAtk.fases = normAtk.fases || [1];
                    normAtk.probabilidad = Number(normAtk.probabilidad || 50);
                    normAtk.targeting = normAtk.targeting || 'random';
                    normAtk.objetivosCant = Number(normAtk.objetivosCant || 1);

                    // Si es referencia (type 1) pero no tiene hechizoId válido -> convertir a inline ataque físico
                    if (Number(normAtk.type) === 1 && (!normAtk.hechizoId || String(normAtk.hechizoId).trim() === '')) {
                        normAtk.type = 2; // Convertir a inline
                        normAtk.name = normAtk.name || "Ataque Básico";
                        normAtk.damage = {
                            base: 10,
                            scaling: { stats: "fuerza", multi: 1.0 }
                        };
                    }
                    // Si es inline (type 2) sin mecánicas definidas -> dar mecánicas por defecto
                    else if (Number(normAtk.type) === 2 && !normAtk.damage && !normAtk.healing && !normAtk.Efectos) {
                        if (String(normAtk.name || '').toLowerCase().includes('defen')) {
                            normAtk.name = normAtk.name || "Defensa";
                        } else {
                            normAtk.name = normAtk.name || "Ataque Básico";
                            normAtk.damage = {
                                base: 10,
                                scaling: { stats: "fuerza", multi: 1.0 }
                            };
                        }
                    }
                    return normAtk;
                });

                if (JSON.stringify(nuevosAtaques) !== JSON.stringify(npc.ataques)) {
                    setFields.ataques = nuevosAtaques;
                    update = true;
                }
            } else {
                setFields.ataques = [{
                    id: 'atk_default',
                    name: 'Ataque Básico',
                    type: 2,
                    probabilidad: 100,
                    targeting: 'random',
                    objetivosCant: 1,
                    fases: [1],
                    damage: { base: 10, scaling: { stats: 'fuerza', multi: 1.0 } }
                }];
                update = true;
            }

            if (update) {
                await npcsCol.updateOne({ _id: npc._id }, { $set: setFields });
                console.log(`✓ NPC ${npc._id} (${npc.Nombre}) normalizado correctamente.`);
                modificados++;
            }
        }

        console.log(`\n¡Proceso de normalización finalizado! ${modificados} de ${npcs.length} NPCs fueron actualizados en la base de datos MongoDB.`);
    } catch (err) {
        console.error("Error durante la normalización de la base de datos de NPCs:", err);
    } finally {
        await client.close();
    }
}

normalizarNPCs();
