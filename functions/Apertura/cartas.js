// functions/Apertura/cartas.js
// Trabajo de la Campana: edita cada carta pre-apertura con la carta final.
//
// En Rol_db.Personajes:
//   cartaMsg: { canalId, mensajeId }  dónde quedó la carta pre-apertura
//   cartaActualizada: true            ya se editó (o se reenvió) con la final
//   cartaReenviada: true              la edición falló y se mandó una carta nueva
//   cartaFallida: true                también falló el reenvío: no se insiste más
//
// Si la edición falla (mensaje borrado, MD cerrado) se manda una carta nueva una
// sola vez; si eso también falla se deja, porque la información está en las guías.

const { cartaFinal } = require('./carta');
const { enTandas } = require('./tandas');

let enCurso = null;

const ahora = () => Math.floor(Date.now() / 1000);

function personajes() {
    const apertura = require('./apertura');
    return apertura.dbClient.db('Rol_db').collection('Personajes');
}

function cartaDe(pj) {
    return cartaFinal({
        nombre: pj?.perfil?.Nombre || pj?.Nombre || 'Estudiante',
        charId: pj._id,
        userId: String(pj.ownerID || '')
    });
}

/** @returns {Promise<'editada'|'reenviada'|'fallida'>} */
async function actualizarUna(client, pj) {
    const col = personajes();
    const payload = { components: cartaDe(pj), flags: ['IsComponentsV2'] };

    try {
        const canal = await client.channels.fetch(pj.cartaMsg.canalId);
        await canal.messages.edit(pj.cartaMsg.mensajeId, payload);
        await col.updateOne({ _id: pj._id }, { $set: { cartaActualizada: true, cartaActualizadaEn: ahora() } });
        return 'editada';
    } catch (errEdit) {
        // Una sola carta nueva
        try {
            const usuario = await client.users.fetch(String(pj.ownerID));
            const nuevo = await usuario.send(payload);
            await col.updateOne({ _id: pj._id }, {
                $set: {
                    cartaActualizada: true,
                    cartaReenviada: true,
                    cartaActualizadaEn: ahora(),
                    cartaMsg: { canalId: nuevo.channelId, mensajeId: nuevo.id }
                }
            });
            return 'reenviada';
        } catch (errEnvio) {
            await col.updateOne({ _id: pj._id }, {
                $set: { cartaFallida: true, cartaError: String(errEnvio?.message || errEdit?.message || 'desconocido').slice(0, 200) }
            });
            return 'fallida';
        }
    }
}

/**
 * Edita todas las cartas pendientes. Solo corre una vez a la vez; si se llama
 * mientras corre, devuelve la misma promesa. Se puede reanudar: lo ya hecho queda
 * marcado en cada personaje y la consulta lo salta.
 */
function actualizarCartas(client) {
    if (enCurso) return enCurso;
    enCurso = (async () => {
        const apertura = require('./apertura');
        if (!client || !apertura.dbClient) throw new Error('Cliente de Discord o MongoDB no disponible.');

        const pendientes = await personajes().find(
            { cartaMsg: { $exists: true }, cartaActualizada: { $ne: true }, cartaFallida: { $ne: true } },
            { projection: { ownerID: 1, 'perfil.Nombre': 1, Nombre: 1, cartaMsg: 1 } }
        ).toArray();

        const previo = apertura.estado.trabajo?.estado === 'en_curso' ? apertura.estado.trabajo : null;
        const trabajo = {
            estado: 'en_curso',
            total: (previo?.hechas || 0) + pendientes.length,
            hechas: previo?.hechas || 0,
            editadas: previo?.editadas || 0,
            reenviadas: previo?.reenviadas || 0,
            fallidas: previo?.fallidas || 0,
            inicio: previo?.inicio || ahora(),
            fin: null
        };
        await apertura.persistir({ trabajo: { ...trabajo } });
        console.log(`🔔 [Cartas] ${pendientes.length} carta(s) por actualizar.`);

        await enTandas(pendientes, async (pj) => {
            const r = await actualizarUna(client, pj);
            if (r === 'editada') trabajo.editadas++;
            else if (r === 'reenviada') trabajo.reenviadas++;
            else trabajo.fallidas++;
            trabajo.hechas++;
        }, {
            porSegundo: 10,
            alTerminarTanda: () => apertura.persistir({ trabajo: { ...trabajo } })
        });

        trabajo.estado = 'terminado';
        trabajo.fin = ahora();
        await apertura.persistir({ trabajo: { ...trabajo } });
        console.log(`🔔 [Cartas] Listo: ${trabajo.editadas} editadas, ${trabajo.reenviadas} reenviadas, ${trabajo.fallidas} sin entregar.`);
        return trabajo;
    })().finally(() => { enCurso = null; });
    return enCurso;
}

module.exports = { actualizarCartas, actualizarUna };
