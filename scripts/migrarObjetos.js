const { MongoClient, Int32 } = require("mongodb");
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
        const collection = db.collection("Objetos_globales");
        
        const docs = await collection.find({}).toArray();
        console.log(`Encontrados ${docs.length} documentos de región.`);

        for (const doc of docs) {
            console.log(`Procesando región: ${doc._id}`);
            let modificado = false;
            
            if (Array.isArray(doc.Objetos)) {
                doc.Objetos = doc.Objetos.map(obj => {
                    modificado = true;
                    
                    // 1. Normalizar ID
                    const id = typeof obj.ID !== "undefined" ? Number(obj.ID) : 0;
                    
                    // 2. Normalizar restricciones
                    const oldRest = obj.restricciones || {};
                    const minLvl = typeof oldRest.nivel_minimo !== "undefined" ? Number(oldRest.nivel_minimo) : (typeof oldRest.fe_min !== "undefined" ? Number(oldRest.fe_min) : 0);
                    const maxLvl = typeof oldRest.nivel_maximo !== "undefined" ? Number(oldRest.nivel_maximo) : (typeof oldRest.fe_max !== "undefined" ? Number(oldRest.fe_max) : 0);
                    const resplandorMin = typeof oldRest.resplandor_min !== "undefined" ? Number(oldRest.resplandor_min) : 0;
                    const resplandorMax = typeof oldRest.resplandor_max !== "undefined" ? Number(oldRest.resplandor_max) : 0;

                    const restricciones = {
                        fe_min: new Int32(minLvl),
                        fe_max: new Int32(maxLvl),
                        resplandor_min: new Int32(resplandorMin),
                        resplandor_max: new Int32(resplandorMax),
                        clase: oldRest.clase !== undefined ? oldRest.clase : null,
                        region: oldRest.region !== undefined ? oldRest.region : null,
                        reputacion: oldRest.reputacion !== undefined ? oldRest.reputacion : null
                    };

                    // 3. Normalizar atributos
                    const oldAtributos = obj.atributos || {};
                    const peso = typeof oldAtributos.peso !== "undefined" ? Number(oldAtributos.peso) : 0;
                    const atributos = {
                        peso: new Int32(peso)
                    };

                    // 4. Normalizar efectos
                    const efectos = (obj.efectos || []).map(ef => {
                        return {
                            tipo: ef.tipo ? ef.tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "",
                            stat: ef.stat !== undefined ? ef.stat : null,
                            valor: new Int32(typeof ef.valor !== "undefined" ? Number(ef.valor) : 0),
                            duracion: ef.duracion !== undefined && ef.duracion !== null ? new Int32(Number(ef.duracion)) : null,
                            condicion: ef.condicion !== undefined ? ef.condicion : null
                        };
                    });

                    // 5. Construir objeto normalizado
                    return {
                        ID: new Int32(id),
                        ID_Autocomplete: obj.ID_Autocomplete || `${doc._id}${id}`,
                        Region: doc._id,
                        Nombre: obj.Nombre || "",
                        Descripcion: obj.Descripcion || "",
                        Rareza: obj.Rareza || "Común",
                        Tipo: Array.isArray(obj.Tipo) ? obj.Tipo : (obj.Tipo ? [obj.Tipo] : []),
                        Cantidad: obj.Cantidad !== undefined ? obj.Cantidad : null,
                        atributos,
                        inStore: typeof obj.inStore !== "undefined" ? Boolean(obj.inStore) : false,
                        precio: new Int32(typeof obj.precio !== "undefined" ? Number(obj.precio) : 0),
                        vendido: new Int32(typeof obj.vendido !== "undefined" ? Number(obj.vendido) : 0),
                        fecha: obj.fecha || new Date().toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" }),
                        evento_origen: obj.evento_origen !== undefined ? obj.evento_origen : null,
                        imagenURL: obj.imagenURL !== undefined ? obj.imagenURL : null,
                        intercambiable: typeof obj.intercambiable !== "undefined" ? Boolean(obj.intercambiable) : false,
                        tiempo_limite: obj.tiempo_limite !== undefined ? obj.tiempo_limite : null,
                        creador: obj.creador || "sistema",
                        restricciones,
                        uso: {
                            contexto: obj.uso?.contexto || "ambos",
                            consumible: typeof obj.uso?.consumible !== "undefined" ? Boolean(obj.uso.consumible) : true,
                            requiereSeleccion: typeof obj.uso?.requiereSeleccion !== "undefined" ? Boolean(obj.uso.requiereSeleccion) : false,
                            objetivo: {
                                tipo: obj.uso?.objetivo?.tipo || "mismo",
                                cantidad: typeof obj.uso?.objetivo?.cantidad !== "undefined" ? Number(obj.uso.objetivo.cantidad) : 1
                            },
                            cooldown: obj.uso?.cooldown !== undefined && obj.uso?.cooldown !== null ? new Int32(Number(obj.uso.cooldown)) : null
                        },
                        efectos
                    };
                });
            }

            if (modificado) {
                await collection.replaceOne({ _id: doc._id }, doc);
                console.log(`Región ${doc._id} migrada y guardada.`);
            }
        }
        
        console.log("Migración completada exitosamente.");
    } catch (err) {
        console.error("Error durante la migración:", err);
    } finally {
        await client.close();
    }
}

run();
