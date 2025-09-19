require("./console-colors")
const clientdb = require("./Server")

async function migrar() {
    await clientdb.connect().then(() => console.log("📋 MongoDB conectado!"))
    const db = clientdb.db("Rol_db")
    const dbobjetos = db.collection("Objetos_globales")
    const personajes = db.collection("Personajes")
    const regiones = await dbobjetos.find({}).toArray()
    const mapaGlobal = {}

    try {
        for (const region of regiones) {
            for (const objeto of region.Objetos) {
                mapaGlobal[`${region._id}-${objeto.ID}`] = objeto.Tipo
            }
        }

        const allPersonajes = await personajes.find({}).toArray()

        for (const personaje of allPersonajes) {
            if (!Array.isArray(personaje.Inventario) || personaje?.Inventario?.length === 0) {
                console.warn(`⏭️ Usuario ${personaje._id} sin inventario, se omite.`);
                continue;
            }

            const nuevoInventario = personaje.Inventario.map(objeto => {
                const clave = `${objeto.Region}-${objeto.ID}`
                const tipo = mapaGlobal[clave]

                if (!tipo) {
                    console.warn(`⚠️ No se encontró tipo para ${clave}`)
                    objeto.Tipo = []
                } else if (Array.isArray(tipo)) {
                    objeto.Tipo = tipo
                } else {
                    objeto.Tipo = [tipo]
                }

                return objeto
            })

            await personajes.updateOne(
                { _id: personaje._id },
                { $set: { Inventario: nuevoInventario } }
            )


            console.log(`🧾 Usuario ${personaje._id}:${personaje?.Nombre} actualizado.`)
        }


        console.warn("Inventario de personajes actualizado correctamente")
    } catch (error) {
        console.error("No se pudo migrar: ", error)
    }
}

migrar()


