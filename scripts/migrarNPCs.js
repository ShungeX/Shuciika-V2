const { MongoClient, Int32, Double } = require("mongodb");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("Error: MONGODB_URI no está definido en el archivo .env");
    process.exit(1);
}

async function run() {
    const client = new MongoClient(uri, { family: 4 });
    try {
        await client.connect();
        console.log("Conectado exitosamente a MongoDB.");
        
        const db = client.db("Rol_db");
        const collection = db.collection("NPCs");
        
        const docs = await collection.find({}).toArray();
        console.log(`Encontrados ${docs.length} NPCs.`);

        let modificadosCount = 0;

        for (const doc of docs) {
            // Verificar si ya está migrado
            const isMigrated = doc.ataques !== undefined && doc.restrictions !== undefined && doc.attacks === undefined;

            if (isMigrated) {
                console.log(`NPC ya migrado: ${doc.Nombre} (ID: ${doc._id})`);
                continue;
            }

            console.log(`Migrando NPC: ${doc.Nombre} (ID: ${doc._id})`);

            // Clone stats and normalize to Int32
            const stats = {};
            if (doc.stats) {
                for (const [k, v] of Object.entries(doc.stats)) {
                    stats[k] = new Int32(Number(v));
                }
            }
            if (stats.hpMax === undefined) stats.hpMax = new Int32(Number(doc.HP || 100));
            if (stats.manaMax === undefined) stats.manaMax = new Int32(Number(doc.Mana || 50));

            // Restrictions mapping (from nivelMagico)
            const nivel = doc.nivelMagico !== undefined ? Number(doc.nivelMagico) : 0;
            const restrictions = {
                fe_min: new Int32(nivel),
                fe_max: new Int32(nivel),
                questRequired: false,
                Surrender: false,
                Run: true,
                probabilidadEscape: new Double(0.1)
            };

            // Migrate attacks to ataques
            const rawAttacks = doc.attacks || doc.ataques || [];
            const ataques = rawAttacks.map((a, idx) => {
                const uniqueId = a.id || `atk_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`;
                const type = a.type !== undefined ? new Int32(Number(a.type)) : new Int32(2);
                const prob = a.probabilidad !== undefined ? new Int32(Number(a.probabilidad)) : new Int32(50);
                const targeting = a.targeting || "random";
                const objetivosCant = a.objetivosCant !== undefined ? new Int32(Number(a.objetivosCant)) : new Int32(1);
                const fases = (a.fases || [1]).map(f => new Int32(Number(f)));

                const normalized = {
                    id: String(uniqueId),
                    name: a.name || a.Nombre || `Ataque ${idx + 1}`,
                    type,
                    probabilidad: prob,
                    targeting,
                    objetivosCant,
                    fases
                };

                if (type.value === 1) {
                    normalized.hechizoId = a.hechizoId || "";
                } else {
                    if (a.damage) {
                        normalized.damage = {
                            base: new Int32(Number(a.damage.base || 0)),
                            scaling: a.damage.scaling || { stats: "fuerza", multi: 1.0 }
                        };
                    }
                    if (a.healing) {
                        normalized.healing = {
                            base: new Int32(Number(a.healing.base || 0)),
                            scaling: a.healing.scaling || { stats: "inteligencia", multi: 1.0 }
                        };
                    }
                    if (a.Efectos) {
                        normalized.Efectos = {};
                        for (const [key, val] of Object.entries(a.Efectos)) {
                            normalized.Efectos[key] = {
                                Nombre: val.Nombre || key,
                                base: new Int32(Number(val.base || 0)),
                                duracion: new Int32(Number(val.duracion || 0)),
                                objetivo: val.objetivo || "enemigos",
                                probabilidad: Number(val.probabilidad || 1.0)
                            };
                        }
                    }
                    if (a.cast) {
                        normalized.cast = {
                            tiempo: new Int32(Number(a.cast.tiempo || 1)),
                            probabilidad: Number(a.cast.probabilidad || 1.0),
                            interruptible: a.cast.interruptible !== false
                        };
                    }
                }
                return normalized;
            });

            // Boss mapping (from isBoss)
            let boss = null;
            if (doc.isBoss || doc.boss) {
                const existingBossFases = doc.boss?.fases || [];
                if (existingBossFases.length > 0) {
                    boss = {
                        fases: existingBossFases.map((f, fIdx) => ({
                            nombre: f.nombre || `Fase ${fIdx + 1}`,
                            condiciones: f.condiciones || [],
                            operador: f.operador || "AND",
                            ataquesDesbloqueados: (f.ataquesDesbloqueados || []).map(id => String(id)),
                            bonusStats: f.bonusStats || {}
                        }))
                    };
                } else {
                    // Default Phase 1 for Bosses
                    boss = {
                        fases: [
                            {
                                nombre: "Fase 1",
                                condiciones: [],
                                operador: "AND",
                                ataquesDesbloqueados: ataques.map(a => a.id),
                                bonusStats: {}
                            }
                        ]
                    };
                }
            }

            // Create migrated document
            const migratedDoc = {
                _id: doc._id,
                Nombre: doc.Nombre,
                Descripcion: doc.Descripcion || "",
                Elemento: doc.Elemento || "Neutro",
                Region: doc.Region || "",
                avatarURL: doc.avatarURL || "",
                HP: new Int32(Number(doc.HP || 100)),
                Mana: new Int32(Number(doc.Mana || 50)),
                Faccion: doc.Faccion || null,
                Type: doc.Type || "Enemigo",
                artefactoMagico: !!doc.artefactoMagico,
                stats,
                restrictions,
                ataques,
                comportamiento: doc.comportamiento || [],
                loot: doc.loot || [],
                boss,
                metadata: doc.metadata || { createdBy: "Admin", version: "1.0.0" }
            };

            await collection.replaceOne({ _id: doc._id }, migratedDoc);
            modificadosCount++;
        }

        console.log(`Migración completada. NPCs actualizados: ${modificadosCount}`);
    } catch (err) {
        console.error("Ocurrió un error durante la migración:", err);
    } finally {
        await client.close();
    }
}

run();
