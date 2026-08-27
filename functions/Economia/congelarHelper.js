const clientdb = require("../../Server");
const db_rol = clientdb.db("Rol_db");
const characters = db_rol.collection("Personajes");
const dbobjetos = db_rol.collection("Objetos_globales");

class CongelarHelper {
    /**
     * Congela lumens y objetos de un personaje (los remueve del inventario/lumens activos y los coloca en congelado).
     * Retorna true si tiene suficientes recursos y el congelamiento fue exitoso, false de lo contrario.
     */
    async congelar(characterId, lumens, objetos) {
        try {
            const char = await characters.findOne({ _id: Number(characterId) });
            if (!char) return false;

            let currentLumens = char.economia?.Lumens ?? 0;
            let inventario = char.economia?.Inventario || [];
            let congelado = char.economia?.congelado || { lumens: 0, objetos: [] };

            // 1. Validar Lumens
            if (lumens > 0 && currentLumens < lumens) {
                return false; // Insuficientes lumens
            }

            // 2. Validar Objetos
            if (objetos && objetos.length > 0) {
                for (const o of objetos) {
                    const item = inventario.find(i => 
                        (i.ID !== undefined && String(i.ID) === String(o.id)) || 
                        (i.Nombre && o.nombre && i.Nombre.toLowerCase() === o.nombre.toLowerCase())
                    );
                    const cant = item ? (item.Cantidad ?? item.cantidad ?? 0) : 0;
                    if (cant < o.cantidad) {
                        return false; // Insuficientes objetos
                    }
                }
            }

            // 3. Aplicar Congelar Lumens
            if (lumens > 0) {
                currentLumens -= lumens;
                congelado.lumens = (congelado.lumens || 0) + lumens;
            }

            // 4. Aplicar Congelar Objetos
            if (objetos && objetos.length > 0) {
                for (const o of objetos) {
                    const itemIdx = inventario.findIndex(i => 
                        (i.ID !== undefined && String(i.ID) === String(o.id)) || 
                        (i.Nombre && o.nombre && i.Nombre.toLowerCase() === o.nombre.toLowerCase())
                    );
                    if (itemIdx !== -1) {
                        const cant = inventario[itemIdx].Cantidad ?? inventario[itemIdx].cantidad ?? 0;
                        const nuevaCant = cant - o.cantidad;
                        
                        if (nuevaCant <= 0) {
                            inventario.splice(itemIdx, 1);
                        } else {
                            if (typeof inventario[itemIdx].Cantidad !== 'undefined') inventario[itemIdx].Cantidad = nuevaCant;
                            else inventario[itemIdx].cantidad = nuevaCant;
                        }

                        // Agregar al congelado
                        if (!congelado.objetos) congelado.objetos = [];
                        const congIdx = congelado.objetos.findIndex(c => 
                            (c.id !== undefined && String(c.id) === String(o.id)) || 
                            (c.nombre && o.nombre && c.nombre.toLowerCase() === o.nombre.toLowerCase())
                        );
                        if (congIdx !== -1) {
                            congelado.objetos[congIdx].cantidad += o.cantidad;
                        } else {
                            congelado.objetos.push({
                                id: Number(o.id) || o.id,
                                nombre: o.nombre,
                                cantidad: o.cantidad,
                                congeladoAt: new Date()
                            });
                        }
                    }
                }
            }

            await characters.updateOne({ _id: Number(characterId) }, {
                $set: {
                    "economia.Lumens": currentLumens,
                    "economia.Inventario": inventario,
                    "economia.congelado": congelado
                }
            });
            return true;
        } catch (err) {
            console.error(`Error al congelar recursos del personaje ${characterId}:`, err);
            return false;
        }
    }

    /**
     * Descongela y restaura lumens y objetos al inventario activo.
     */
    async descongelar(characterId, lumens, objetos) {
        try {
            const char = await characters.findOne({ _id: Number(characterId) });
            if (!char) return false;

            let currentLumens = char.economia?.Lumens ?? 0;
            let inventario = char.economia?.Inventario || [];
            let congelado = char.economia?.congelado || { lumens: 0, objetos: [] };

            // 1. Descongelar Lumens
            if (lumens > 0) {
                const aRestaurar = Math.min(congelado.lumens || 0, lumens);
                congelado.lumens = Math.max(0, (congelado.lumens || 0) - aRestaurar);
                currentLumens += aRestaurar;
            }

            // 2. Descongelar Objetos
            if (objetos && objetos.length > 0) {
                for (const o of objetos) {
                    if (!congelado.objetos) congelado.objetos = [];
                    const congIdx = congelado.objetos.findIndex(c => 
                        (c.id !== undefined && String(c.id) === String(o.id)) || 
                        (c.nombre && o.nombre && c.nombre.toLowerCase() === o.nombre.toLowerCase())
                    );
                    if (congIdx !== -1) {
                        const cantACong = congelado.objetos[congIdx].cantidad;
                        const aRestaurar = Math.min(cantACong, o.cantidad);
                        
                        congelado.objetos[congIdx].cantidad -= aRestaurar;
                        if (congelado.objetos[congIdx].cantidad <= 0) {
                            congelado.objetos.splice(congIdx, 1);
                        }

                        // Devolver al inventario activo
                        const itemIdx = inventario.findIndex(i => 
                            (i.ID !== undefined && String(i.ID) === String(o.id)) || 
                            (i.Nombre && o.nombre && i.Nombre.toLowerCase() === o.nombre.toLowerCase())
                        );
                        if (itemIdx !== -1) {
                            if (typeof inventario[itemIdx].Cantidad !== 'undefined') inventario[itemIdx].Cantidad += aRestaurar;
                            else inventario[itemIdx].cantidad += aRestaurar;
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
                                    Cantidad: Number(aRestaurar),
                                    Fecha: new Date().toISOString()
                                });
                            } else {
                                inventario.push({
                                    ID: Number(o.id) || o.id,
                                    Nombre: String(o.nombre),
                                    Cantidad: Number(aRestaurar),
                                    Fecha: new Date().toISOString()
                                });
                            }
                        }
                    }
                }
            }

            await characters.updateOne({ _id: Number(characterId) }, {
                $set: {
                    "economia.Lumens": currentLumens,
                    "economia.Inventario": inventario,
                    "economia.congelado": congelado
                }
            });
            return true;
        } catch (err) {
            console.error(`Error al descongelar recursos del personaje ${characterId}:`, err);
            return false;
        }
    }

    /**
     * Remueve del congelado los recursos sin restaurarlos al inventario.
     */
    async removerCongeladoSinRestaurar(characterId, lumens, objetos) {
        try {
            const char = await characters.findOne({ _id: Number(characterId) });
            if (!char) return false;

            let congelado = char.economia?.congelado || { lumens: 0, objetos: [] };

            // 1. Remover lumens del congelado
            if (lumens > 0) {
                congelado.lumens = Math.max(0, (congelado.lumens || 0) - lumens);
            }

            // 2. Remover objetos del congelado
            if (objetos && objetos.length > 0) {
                for (const o of objetos) {
                    if (!congelado.objetos) congelado.objetos = [];
                    const congIdx = congelado.objetos.findIndex(c => 
                        (c.id !== undefined && String(c.id) === String(o.id)) || 
                        (c.nombre && o.nombre && c.nombre.toLowerCase() === o.nombre.toLowerCase())
                    );
                    if (congIdx !== -1) {
                        congelado.objetos[congIdx].cantidad = Math.max(0, congelado.objetos[congIdx].cantidad - o.cantidad);
                        if (congelado.objetos[congIdx].cantidad <= 0) {
                            congelado.objetos.splice(congIdx, 1);
                        }
                    }
                }
            }

            await characters.updateOne({ _id: Number(characterId) }, {
                $set: {
                    "economia.congelado": congelado
                }
            });
            return true;
        } catch (err) {
            console.error(`Error al remover del congelado recursos del personaje ${characterId}:`, err);
            return false;
        }
    }
}

module.exports = new CongelarHelper();
