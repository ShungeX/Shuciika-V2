/**
 * Sistema de Evaluación de Privacidad — Nix World
 *
 * Niveles jerárquicos:
 * 'todos' -> 'amigos' -> 'mejores_amigos' -> 'companero' -> 'nadie'
 *
 * Regla de evaluación:
 * 1. Mismo autor / personaje -> true
 * 2. ¿Está en bloqueados? -> false (prioridad máxima)
 * 3. ¿Está en permitidos? -> true
 * 4. Si no, se evalúa el nivel jerárquico del campo.
 */

async function evaluarPermisoPrivacidad(targetPj, actorPj, campo, dbRol) {
    if (!targetPj || !actorPj) return false;

    const targetId = String(targetPj._id ?? targetPj.ID ?? '');
    const actorId = String(actorPj._id ?? actorPj.ID ?? '');
    const targetOwner = String(targetPj.ownerID || '');
    const actorOwner = String(actorPj.ownerID || '');

    // 1. Mismo personaje o mismo autor -> Siempre permitido
    if (targetId === actorId || (targetOwner && targetOwner === actorOwner)) {
        return true;
    }

    const priv = targetPj.social?.privacidad || {};

    const getIdFromItem = (item) => {
        if (!item) return '';
        if (typeof item === 'object') return String(item.id || item._id || '');
        return String(item);
    };

    const bloqueados = Array.isArray(priv.bloqueados) ? priv.bloqueados.map(getIdFromItem) : [];
    const permitidos = Array.isArray(priv.permitidos) ? priv.permitidos.map(getIdFromItem) : [];

    // Regla 1: ¿Está en bloqueados? -> NO (prioridad absoluta)
    if (bloqueados.includes(actorId) || (actorOwner && bloqueados.includes(actorOwner))) {
        return false;
    }

    // Regla 2: ¿Está en permitidos? -> SÍ
    if (permitidos.includes(actorId) || (actorOwner && permitidos.includes(actorOwner))) {
        return true;
    }

    // Regla 3: Nivel jerárquico del campo (default: 'todos')
    const nivel = priv[campo] || 'todos';

    if (nivel === 'todos') {
        return true;
    }

    if (nivel === 'nadie') {
        return false;
    }

    // Verificar si el actor es el compañero asignado
    const compId = targetPj.social?.compañero ?? targetPj.social?.companero;
    const esCompanero = compId ? (String(compId) === actorId || (actorOwner && String(compId) === actorOwner)) : false;

    if (nivel === 'companero') {
        return esCompanero;
    }

    // Para 'mejores_amigos' o 'amigos', consultar relación en Relaciones_pj
    let rel = null;
    if (dbRol) {
        try {
            const nTarget = Number(targetPj.ID ?? targetPj._id);
            const nActor = Number(actorPj.ID ?? actorPj._id);
            if (!isNaN(nTarget) && !isNaN(nActor)) {
                rel = await dbRol.collection("Relaciones_pj").findOne({
                    $or: [
                        { ID1: nTarget, ID2: nActor },
                        { ID1: nActor, ID2: nTarget },
                        { ID1: targetId, ID2: actorId },
                        { ID1: actorId, ID2: targetId },
                        { _id: `${Math.min(nTarget, nActor)}-${Math.max(nTarget, nActor)}` }
                    ]
                });
            }
        } catch (e) {
            console.warn("Error al buscar relación en evaluarPermisoPrivacidad:", e?.message);
        }
    }

    const xpAmistad = rel?.xp || 0;
    const nivelAmistad = rel?.amistad?.nivel || 0;
    const esMejorAmigo = esCompanero || nivelAmistad >= 3 || xpAmistad >= 2000;
    const esAmigo = esMejorAmigo || nivelAmistad >= 1 || xpAmistad >= 500 || Boolean(rel);

    if (nivel === 'mejores_amigos') {
        return esMejorAmigo;
    }

    if (nivel === 'amigos') {
        return esAmigo;
    }

    return true;
}

module.exports = { evaluarPermisoPrivacidad };
