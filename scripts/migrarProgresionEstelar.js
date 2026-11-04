/**
 * Migración al sistema de Polvo Estelar / Fragmentos / Resplandor.
 * Elimina todo rastro de XP y nivelMagico de los datos del combate y la exploración.
 *
 *   node scripts/migrarProgresionEstelar.js            → simulación (no escribe nada)
 *   node scripts/migrarProgresionEstelar.js --aplicar  → aplica los cambios
 *
 * Qué hace:
 *  NPCs
 *   - loot typeLoot "xp" → "polvo" (en cualquier nivel del documento, incl. fases de jefe)
 *   - nivelMagico / stats.nivelMagico → nivel (si no tenía `nivel`), y borra los campos viejos
 *  Regiones
 *   - recompensas de loot con tipo/typeLoot "xp" → "polvo" (en cualquier área/subzona)
 *  Soul
 *   - sendero.StelarFragmentsTotal = sendero.StelarFragments si falta (almas antiguas)
 *   - sendero.resplandor normalizado a 'I'..'VII' según los fragmentos totales (nunca baja)
 *   - borra nucleo.XP, xpRequired, nucleo.xpRequired, nivelMagico, nucleo.nivelMagico,
 *     stats.nivelMagico y StelarFragments/nucleo.StelarFragments sueltos fuera de sendero
 *     (el valor viejo de XP NO se convierte en Polvo: addXP ya sumaba a nucleo.polvoEstelar)
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const { MongoClient } = require('mongodb');
const {
    resplandorANumero, numeroARomano, rangoPorFragmentos,
} = require('../functions/Economia/progresionEstelar');

const APLICAR = process.argv.includes('--aplicar');

/**
 * Recorre el documento y devuelve las rutas (notación de puntos) de cada
 * typeLoot/tipo === "xp", para cambiarlas con $set sin reescribir el documento
 * (así se conservan los tipos BSON como Double/Int32).
 */
function rutasLootXP(nodo, ruta = '') {
    const rutas = [];
    if (Array.isArray(nodo)) {
        nodo.forEach((item, i) => rutas.push(...rutasLootXP(item, ruta ? `${ruta}.${i}` : String(i))));
        return rutas;
    }
    if (nodo && typeof nodo === 'object') {
        for (const [clave, valor] of Object.entries(nodo)) {
            const sub = ruta ? `${ruta}.${clave}` : clave;
            if ((clave === 'typeLoot' || clave === 'tipo') && valor === 'xp') rutas.push(sub);
            else if (valor && typeof valor === 'object' && !(valor instanceof Date)) rutas.push(...rutasLootXP(valor, sub));
        }
    }
    return rutas;
}

async function migrarNPCs(db) {
    const col = db.collection('NPCs');
    const npcs = await col.find({}).toArray();
    let docs = 0, loot = 0, niveles = 0;

    for (const npc of npcs) {
        const rutas = [...rutasLootXP(npc.loot || [], 'loot'), ...rutasLootXP(npc.boss || {}, 'boss')];
        const cambiosLoot = rutas.length;
        const tieneNivelViejo = npc.nivelMagico !== undefined || npc.stats?.nivelMagico !== undefined;
        if (!cambiosLoot && !tieneNivelViejo) continue;

        const update = { $set: {}, $unset: {} };
        for (const r of rutas) update.$set[r] = 'polvo';
        loot += cambiosLoot;
        if (tieneNivelViejo) {
            if (npc.nivel === undefined || npc.nivel === null) {
                update.$set.nivel = Number(npc.nivelMagico ?? npc.stats?.nivelMagico ?? npc.restrictions?.fe_min) || 1;
            }
            update.$unset.nivelMagico = '';
            update.$unset['stats.nivelMagico'] = '';
            niveles++;
        }
        if (!Object.keys(update.$set).length) delete update.$set;
        if (!Object.keys(update.$unset).length) delete update.$unset;

        docs++;
        console.log(`  NPC ${npc._id} (${npc.Nombre ?? '?'}): loot xp→polvo ${cambiosLoot}${tieneNivelViejo ? `, nivelMagico→nivel ${update.$set?.nivel ?? npc.nivel}` : ''}`);
        if (APLICAR) await col.updateOne({ _id: npc._id }, update);
    }
    console.log(`NPCs: ${docs} documentos | ${loot} entradas de loot | ${niveles} niveles migrados`);
}

async function migrarRegiones(db) {
    const col = db.collection('Regiones');
    const regiones = await col.find({}).toArray();
    let docs = 0, loot = 0;

    for (const region of regiones) {
        const { _id, ...resto } = region;
        const rutas = rutasLootXP(resto);
        const cambios = rutas.length;
        if (!cambios) continue;
        docs++;
        loot += cambios;
        console.log(`  Región ${region._id}: ${cambios} entradas xp→polvo`);
        if (APLICAR) await col.updateOne({ _id: region._id }, { $set: Object.fromEntries(rutas.map(r => [r, 'polvo'])) });
    }
    console.log(`Regiones: ${docs} documentos | ${loot} entradas de loot`);
}

async function migrarSouls(db) {
    const col = db.collection('Soul');
    const camposViejos = ['nucleo.XP', 'xpRequired', 'nucleo.xpRequired', 'nivelMagico', 'nucleo.nivelMagico',
        'stats.nivelMagico', 'StelarFragments', 'nucleo.StelarFragments', 'XP'];
    const filtroViejos = camposViejos.map(c => ({ [c]: { $exists: true } }));

    const cursor = col.find({
        $or: [
            ...filtroViejos,
            { 'sendero.StelarFragmentsTotal': { $exists: false }, 'sendero': { $exists: true } },
            { 'sendero.resplandor': { $exists: true } },
        ]
    });

    let docs = 0, xpDescartada = 0;
    for await (const soul of cursor) {
        const sendero = soul.sendero || {};
        const update = { $set: {}, $unset: {} };

        const disponibles = Number(sendero.StelarFragments ?? 0) || 0;
        const total = Number(sendero.StelarFragmentsTotal ?? disponibles) || 0;
        if (soul.sendero && (sendero.StelarFragmentsTotal === undefined || sendero.StelarFragmentsTotal === null)) {
            update.$set['sendero.StelarFragmentsTotal'] = total;
        }

        if (soul.sendero) {
            const rango = Math.max(resplandorANumero(sendero.resplandor), rangoPorFragmentos(total));
            const romano = numeroARomano(rango);
            if (sendero.resplandor !== romano) update.$set['sendero.resplandor'] = romano;
        }

        for (const campo of camposViejos) {
            const valor = campo.split('.').reduce((o, k) => o?.[k], soul);
            if (valor !== undefined) {
                update.$unset[campo] = '';
                if (campo === 'nucleo.XP' || campo === 'XP') xpDescartada += Number(valor) || 0;
            }
        }

        if (!Object.keys(update.$set).length) delete update.$set;
        if (!Object.keys(update.$unset).length) delete update.$unset;
        if (!update.$set && !update.$unset) continue;

        docs++;
        if (APLICAR) await col.updateOne({ _id: soul._id }, update);
    }
    console.log(`Soul: ${docs} almas actualizadas | XP antigua descartada en total: ${xpDescartada}`);
}

async function main() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('No se encontró MONGODB_URI en .env');
        process.exitCode = 1;
        return;
    }
    const client = new MongoClient(mongoUri, { family: 4 });
    try {
        await client.connect();
        const db = client.db('Rol_db');
        console.log(APLICAR ? '== APLICANDO migración ==' : '== SIMULACIÓN (usa --aplicar para escribir) ==');
        await migrarNPCs(db);
        await migrarRegiones(db);
        await migrarSouls(db);
        console.log(APLICAR ? 'Migración aplicada.' : 'Simulación terminada, no se escribió nada.');
    } catch (e) {
        console.error('Error en la migración:', e);
        process.exitCode = 1;
    } finally {
        await client.close();
    }
}

main();
