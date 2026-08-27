const { MongoClient, Int32 } = require("mongodb");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("Error: MONGODB_URI no está definido en el archivo .env");
    process.exit(1);
}

function convertObjetivo(objVal) {
    if (typeof objVal === 'number') {
        if (objVal === 1) return 'enemigos';
        if (objVal === 2) return 'aliados';
        if (objVal === 3) return 'global';
        if (objVal === 4) return 'todos';
    }
    return objVal;
}

async function run() {
    const client = new MongoClient(uri, { family: 4 });
    try {
        await client.connect();
        console.log("Conectado exitosamente a MongoDB.");
        
        const db = client.db("Rol_db");
        const collection = db.collection("Hechizos_globales");
        
        const docs = await collection.find({}).toArray();
        console.log(`Encontrados ${docs.length} hechizos.`);

        let modificadosCount = 0;

        for (const doc of docs) {
            // Verificar si ya está migrado para evitar doble procesamiento innecesario
            const isMigrated = doc.Req && 
                               doc.Req.fe_min !== undefined && 
                               doc.Mecanicas?.cast?.tiempo !== undefined;

            if (isMigrated) {
                console.log(`Hechizo ya migrado: ${doc.Nombre} (ID: ${doc._id})`);
                continue;
            }

            console.log(`Migrando hechizo: ${doc.Nombre} (ID: ${doc._id})`);
            
            // 1. Clonar/Inicializar Req
            const oldReq = doc.Req || {};
            const req = {
                fe_min: oldReq.fe_min !== undefined ? oldReq.fe_min : (oldReq.nivelMinimo !== undefined ? oldReq.nivelMinimo : null),
                fe_max: oldReq.fe_max !== undefined ? oldReq.fe_max : null,
                resplandor_min: oldReq.resplandor_min !== undefined ? oldReq.resplandor_min : null,
                resplandor_max: oldReq.resplandor_max !== undefined ? oldReq.resplandor_max : null,
                clase: typeof oldReq.clase === 'number' ? null : (oldReq.clase !== undefined ? oldReq.clase : null),
                stats: oldReq.stats || null
            };

            // Asegurar Int32 en campos numéricos de Req
            if (req.fe_min !== null) req.fe_min = new Int32(Number(req.fe_min));
            if (req.fe_max !== null) req.fe_max = new Int32(Number(req.fe_max));
            if (req.resplandor_min !== null) req.resplandor_min = new Int32(Number(req.resplandor_min));
            if (req.resplandor_max !== null) req.resplandor_max = new Int32(Number(req.resplandor_max));

            // 2. Campo 'uso'
            const uso = doc.uso !== undefined ? doc.uso : "combate";

            // 3. Campo 'Tipo'
            let tipo = doc.Tipo;
            if (typeof tipo === 'number') {
                tipo = "movimiento";
            }

            // 4. Mecanicas y Agrupación de cast
            const mecanicas = doc.Mecanicas || {};
            const rawCastTime = doc.castTime ?? mecanicas.castTime ?? 1;
            const rawCastProb = doc.castProbabilidad ?? mecanicas.castProbabilidad ?? 1.0;

            const cast = {
                tiempo: new Int32(Number(rawCastTime)),
                probabilidad: Number(rawCastProb),
                interruptible: true
            };

            mecanicas.cast = cast;

            // 5. Convertir objetivo en mecánicas y fallback a 'mismo'
            let hasObjetivo = false;

            if (mecanicas.damage) {
                if (mecanicas.damage.objetivo !== undefined) {
                    mecanicas.damage.objetivo = convertObjetivo(mecanicas.damage.objetivo);
                    hasObjetivo = true;
                }
            }
            if (mecanicas.healing) {
                if (mecanicas.healing.objetivo !== undefined) {
                    mecanicas.healing.objetivo = convertObjetivo(mecanicas.healing.objetivo);
                    hasObjetivo = true;
                }
            }
            if (mecanicas.Efectos) {
                for (const key of Object.keys(mecanicas.Efectos)) {
                    if (mecanicas.Efectos[key].objetivo !== undefined) {
                        mecanicas.Efectos[key].objetivo = convertObjetivo(mecanicas.Efectos[key].objetivo);
                        hasObjetivo = true;
                    }
                }
            }

            if (!hasObjetivo) {
                if (mecanicas.damage) {
                    mecanicas.damage.objetivo = 'mismo';
                } else if (mecanicas.healing) {
                    mecanicas.healing.objetivo = 'mismo';
                } else {
                    mecanicas.damage = { base: new Int32(0), objetivo: 'mismo' };
                }
            }

            // Reconstruir el documento conservando otros campos
            const updateFields = {
                Req: req,
                uso: uso,
                Tipo: tipo,
                Mecanicas: mecanicas
            };

            // Paso 1: Establecer los nuevos campos
            await collection.updateOne(
                { _id: doc._id },
                { $set: updateFields }
            );

            // Paso 2: Eliminar los campos antiguos obsoletos
            const unsetFields = {
                "Req.nivelMinimo": "",
                "Req.inCombat": "",
                castTime: "",
                castProbabilidad: "",
                "Mecanicas.castTime": "",
                "Mecanicas.castProbabilidad": ""
            };
            await collection.updateOne(
                { _id: doc._id },
                { $unset: unsetFields }
            );

            modificadosCount++;
        }

        console.log(`Migración completada. Hechizos normalizados: ${modificadosCount}`);
    } catch (e) {
        console.error("Error durante la migración:", e);
    } finally {
        await client.close();
    }
}

run();
