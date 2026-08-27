const clientdb = require("../Server");

const catalogoRegiones = new Map(); // regionId -> array de Objetos

async function cargarCatalogo(regionesCollection) {
    try {
        let collection = regionesCollection;
        if (!collection) {
            const db = clientdb.db("Rol_db");
            collection = db.collection("Objetos_globales");
        }

        const regiones = await collection.find({}, { projection: { _id: 1, Objetos: 1 } }).toArray();
        catalogoRegiones.clear();
        for (const region of regiones) {
            const objetosNormalizados = (region.Objetos || []).map(obj => ({
                ...obj,
                Region: obj.Region || region._id
            }));
            catalogoRegiones.set(region._id, objetosNormalizados);
        }
        console.log(`📦 Catálogo de objetos cargado: ${catalogoRegiones.size} regiones`);
        return catalogoRegiones;
    } catch (error) {
        console.error("❌ Error al cargar catálogo de objetos:", error);
    }
}

function getObjetosDeRegion(regionId) {
    return catalogoRegiones.get(regionId) ?? [];
}

function getObjetoPorId(regionId, objetoId) {
    if (regionId) {
        const objetos = getObjetosDeRegion(regionId);
        const obj = objetos.find(o => Number(o.ID) === Number(objetoId) || o.ID === objetoId || o.id === objetoId);
        if (obj) return obj;
    }

    // Si no se especifica regionId o no se encontró en la región dada, buscar en todas las regiones
    for (const [regId, objetos] of catalogoRegiones.entries()) {
        const obj = objetos.find(o => Number(o.ID) === Number(objetoId) || o.ID === objetoId || o.id === objetoId);
        if (obj) return obj;
    }

    return null;
}

async function recargarRegion(regionesCollection, regionId) {
    try {
        let collection = regionesCollection;
        if (!collection) {
            const db = clientdb.db("Rol_db");
            collection = db.collection("Objetos_globales");
        }

        const region = await collection.findOne(
            { _id: regionId },
            { projection: { _id: 1, Objetos: 1 } }
        );
        if (region) {
            const objetosNormalizados = (region.Objetos || []).map(obj => ({
                ...obj,
                Region: obj.Region || region._id
            }));
            catalogoRegiones.set(regionId, objetosNormalizados);
            console.log(`📦 Catálogo recargado para la región: ${regionId}`);
        }
    } catch (error) {
        console.error(`❌ Error al recargar región ${regionId} en catálogo:`, error);
    }
}

function getCatalogo() {
    return catalogoRegiones;
}

module.exports = {
    cargarCatalogo,
    getObjetosDeRegion,
    getObjetoPorId,
    recargarRegion,
    getCatalogo
};
