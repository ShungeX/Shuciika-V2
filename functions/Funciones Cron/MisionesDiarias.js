const cron = require("node-cron")
const clientdb = require("../../Server")
const db2 = clientdb.db("Rol_db")
const personajes = db2.collection("Personajes")
const souls = db2.collection("Soul")
const misionesMaestra = db.collection('misiones_maestra');
const misionesDelDia = db.collection('misiones_diarias');



cron.schedule('30 23 * * *', async () => {
    console.warn("Ejecutando cron: Asignando misiones fallidas por caducidad")
    await personajes.updateMany(
        { "misionesDiarias.status": "activa" },
        { $set: { "misionesDiarias.$[elem].status": "fallida" } },
        { arrayFilters: [{ "elem.status": "activa" }] }
    );
    console.log('Misiones activas del día anterior marcadas como fallidas.');
}, {
    timezone: "America/Mexico_City"
});

cron.schedule('0 0 * * *', async () => {
    console.warn("Ejecutando cron: Restableciendo misiones diarias...")
    const todasLasDiarias = await misionesMaestra.find({ type: 'diaria' }).toArray();

    // Limpiar pools antiguos y crear el nuevo
    await misionesDelDia.deleteMany({}); // Borra los pools de días anteriores
    await misionesDelDia.insertOne({
        fecha: new Date(),
        misiones: todasLasDiarias
    });

    console.log(`Pool generado con ${todasLasDiarias.length} misiones para hoy.`);

}, {
    timezone: "America/Mexico_City"
});

