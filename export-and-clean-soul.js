require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const PROTECTED_IDS = [
  100001, 100002, 100003, 100004,
  '100001', '100002', '100003', '100004'
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI no está definido en el archivo .env');
  }

  const client = new MongoClient(uri, { family: 4 });
  
  try {
    await client.connect();
    console.log('[+] Conectado exitosamente a MongoDB');
    
    const db = client.db('Rol_db');
    const soulCol = db.collection('Soul');

    // 1. Obtener todos los documentos
    const allDocs = await soulCol.find({}).toArray();
    console.log(`[i] Total de documentos encontrados en Rol_db.Soul: ${allDocs.length}`);

    const extracted = [];
    const idsToDelete = [];
    const protectedFound = [];

    for (const doc of allDocs) {
      // Verificación de seguridad estricta: NO tocar las IDs protegidas
      if (PROTECTED_IDS.includes(doc._id)) {
        protectedFound.push(doc._id);
        continue;
      }

      const idStr = String(doc._id);
      const isDiscordId = /^\d{17,20}$/.test(idStr);
      const isLongerThan10 = idStr.length > 10;

      if (isLongerThan10 || isDiscordId) {
        // Extraer los campos solicitados
        const extractedDoc = {
          _id: doc._id,
          ID: doc.ID !== undefined ? doc.ID : null,
          XP: doc.XP !== undefined ? doc.XP : (doc.nucleo?.XP !== undefined ? doc.nucleo.XP : 0),
          nivelMagico: doc.nivelMagico !== undefined ? doc.nivelMagico : (doc.nucleo?.nivelMagico !== undefined ? doc.nucleo.nivelMagico : 1),
          npcDefeated: doc.npcDefeated !== undefined ? doc.npcDefeated : (doc.registros?.npcDefeat || doc.registros?.npcDefeated || {}),
          Despertado: doc.Despertado !== undefined ? doc.Despertado : (doc.metadata?.Despertado !== undefined ? doc.metadata.Despertado : null)
        };

        extracted.push(extractedDoc);
        idsToDelete.push(doc._id);
      }
    }

    console.log(`[i] Documentos protegidos identificados (NO se tocarán):`, protectedFound);
    console.log(`[i] Documentos que cumplen la condición para extraer: ${extracted.length}`);

    if (extracted.length === 0) {
      console.log('[-] No se encontraron documentos para extraer.');
      return;
    }

    // 2. Guardar en JSON "Memoria_antigua.json"
    const jsonFileName = 'Memoria_antigua.json';
    const filePathNavi = path.join(__dirname, jsonFileName);
    const filePathData = path.join(__dirname, 'data', jsonFileName);
    const jsonContent = JSON.stringify(extracted, null, 2);

    fs.writeFileSync(filePathNavi, jsonContent, 'utf-8');
    console.log(`[+] Archivo guardado exitosamente en: ${filePathNavi}`);

    // Guardar también en data/ por conveniencia si la carpeta existe
    if (fs.existsSync(path.join(__dirname, 'data'))) {
      fs.writeFileSync(filePathData, jsonContent, 'utf-8');
      console.log(`[+] Copia guardada en: ${filePathData}`);
    }

    // Verificación de integridad del archivo JSON guardado antes de proceder a borrar
    const verifiedContent = JSON.parse(fs.readFileSync(filePathNavi, 'utf-8'));
    if (!Array.isArray(verifiedContent) || verifiedContent.length !== extracted.length) {
      throw new Error('Error de verificación: El archivo JSON guardado no coincide con los datos extraídos.');
    }
    console.log(`[+] Verificación de integridad superada: ${verifiedContent.length} registros guardados en JSON.`);

    // 3. Verificación de seguridad antes de borrar: asegurarse de que NINGUNA ID protegida esté en idsToDelete
    for (const pId of PROTECTED_IDS) {
      if (idsToDelete.includes(pId)) {
        throw new Error(`ALERTA CRÍTICA: ID protegida detectada en lista de eliminación: ${pId}. Abortando operación.`);
      }
    }

    // 4. Borrar los datos extraídos de la base de datos
    console.log(`[+] Procediendo a eliminar ${idsToDelete.length} documentos de Rol_db.Soul...`);
    const deleteResult = await soulCol.deleteMany({
      _id: { $in: idsToDelete }
    });

    console.log(`[+] Documentos eliminados en MongoDB: ${deleteResult.deletedCount}`);

    // 5. Verificar estado final de la colección Soul
    const remainingDocs = await soulCol.find({}).toArray();
    console.log(`[i] Documentos restantes en Rol_db.Soul: ${remainingDocs.length}`);
    console.log(`[i] IDs restantes:`, remainingDocs.map(d => d._id));

  } catch (error) {
    console.error('[!] Error durante la operación:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('[+] Conexión a MongoDB cerrada.');
  }
}

main();
