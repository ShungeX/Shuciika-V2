// functions/dialogoGrafo.js
// Traduce el grafo que guarda el dashboard (webDiscord/js/editor-nodos) a la
// lista de pasos que ejecuta dialogoManager.
//
// Desde el editor de nodos, Rol_db.Dialogos ya no guarda `dialogos[]`: guarda
// `grafo: { nodes, edges }`. El runtime sigue siendo el de siempre, con pasos
// numerados y saltos por índice, así que aquí se hace la traducción una sola
// vez: al cargar el diálogo o al refrescarlo desde el dashboard.
//
// IMPORTANTE: los nombres de los tipos de nodo y de las salidas ("salida",
// "si", "no", "timeout", "btn:N", "sel:N:M") son los mismos que usa
// webDiscord/js/editor-nodos/grafo.js. Si cambian allí, cambian aquí.

const TIPOS = {
    INICIO: 'inicio',
    MENSAJE: 'mensaje',
    CONDICION: 'condicion',
    VARIABLE: 'variable',
    FIN: 'fin',
    NOTA: 'nota',
};

const SALIDA_DEFECTO = 'salida';
const SALIDA_SI = 'si';
const SALIDA_NO = 'no';
const SALIDA_TIMEOUT = 'timeout';

/** Los pasos de control no se envían a Discord: dirigen el flujo. */
const CONTROLES = new Set(['condicion', 'variable', 'fin']);

function esSelect(comp) {
    if (!comp || typeof comp !== 'object') return false;
    const t = String(comp.type || '').toUpperCase().replace(/[\s_-]/g, '');
    if (t === 'STRINGSELECT' || t === 'STRINGSELECTMENU' || t === 'SELECTMENU' || t === 'SELECT') return true;
    if (t === 'BUTTON') return false;
    return Array.isArray(comp.options);
}

function componentesDePaso(paso) {
    const lista = Array.isArray(paso?.components) ? paso.components
        : Array.isArray(paso?.buttons) ? paso.buttons
            : [];
    const botones = [];
    const selects = [];
    for (const c of lista) {
        if (esSelect(c)) selects.push(c);
        else botones.push(c);
    }
    return { botones, selects };
}

/** El customId lleva la acción: el handler de botones la lee de ahí. */
function customIdDeBoton(actionType, actionParam) {
    const limpio = actionParam ? String(actionParam).trim() : '';
    if (actionType === 'jump') return `dialogue_act-{user_id}-{character_id}-jump-${limpio || '0'}`;
    if (actionType === 'item') return `dialogue_act-{user_id}-{character_id}-item-${limpio || 'item_id'}`;
    if (actionType === 'prev') return 'dialogue_act-{user_id}-{character_id}-prev';
    if (actionType === 'inventory') return 'dialogue_act-{user_id}-{character_id}-inventory';
    if (actionType === 'perfil') return 'dialogue_act-{user_id}-{character_id}-perfil';
    return 'dialogue_act-{user_id}-{character_id}-next';
}

/**
 * Compila el grafo de un documento a `dialogos[]`.
 *
 * El orden de los pasos es el del recorrido desde Inicio, así que el paso 0 es
 * siempre por donde arranca el jugador. Lo que no se alcanza desde Inicio no se
 * compila: tampoco se podría llegar a ello en Discord.
 *
 * @param {object} doc documento de Rol_db.Dialogos
 * @returns {Array} lista de pasos lista para dialogoManager
 */
function compilarGrafo(doc) {
    const nodos = Array.isArray(doc?.grafo?.nodes) ? doc.grafo.nodes : [];
    const aristas = Array.isArray(doc?.grafo?.edges) ? doc.grafo.edges : [];
    if (nodos.length === 0) return [];

    const porId = new Map(nodos.map(n => [n.id, n]));

    // destino[nodoId][salida] = nodoId
    const destino = new Map();
    for (const e of aristas) {
        if (!porId.has(e.source) || !porId.has(e.target)) continue;
        if (!destino.has(e.source)) destino.set(e.source, new Map());
        destino.get(e.source).set(e.sourceHandle || SALIDA_DEFECTO, e.target);
    }
    const salidaDe = (nodoId, salida) => destino.get(nodoId)?.get(salida) || null;

    /* ── Orden de compilación ──
     * Recorrido en profundidad desde Inicio. Las notas no se compilan y el
     * Inicio tampoco: solo marca por dónde se empieza.
     */
    const inicio = nodos.find(n => n.type === TIPOS.INICIO);
    const orden = [];
    const vistos = new Set();

    const salidasDe = (nodo) => {
        if (nodo.type === TIPOS.CONDICION) return [SALIDA_SI, SALIDA_NO];
        if (nodo.type === TIPOS.FIN || nodo.type === TIPOS.NOTA) return [];
        if (nodo.type === TIPOS.MENSAJE) {
            const { botones, selects } = componentesDePaso(nodo.data?.paso);
            const salidas = [];
            botones.forEach((_, i) => salidas.push(`btn:${i}`));
            selects.forEach((s, i) => (s.options || []).forEach((_, j) => salidas.push(`sel:${i}:${j}`)));
            if (botones.length === 0 && selects.length === 0) salidas.push(SALIDA_DEFECTO);
            else if (nodo.data?.paso?.esperarRespuesta !== true) salidas.push(SALIDA_TIMEOUT);
            return salidas;
        }
        return [SALIDA_DEFECTO];
    };

    const visitar = (nodoId) => {
        const nodo = porId.get(nodoId);
        if (!nodo || vistos.has(nodoId) || nodo.type === TIPOS.NOTA) return;
        vistos.add(nodoId);
        if (nodo.type !== TIPOS.INICIO) orden.push(nodo);
        for (const salida of salidasDe(nodo)) {
            const siguiente = salidaDe(nodoId, salida);
            if (siguiente) visitar(siguiente);
        }
    };

    if (inicio) visitar(inicio.id);
    if (orden.length === 0) return [];

    const indice = new Map(orden.map((n, i) => [n.id, i]));
    // Un índice fuera del array termina el diálogo: es lo que hace
    // processNextStep cuando no encuentra el paso.
    const FINAL = orden.length;
    const indiceDe = (nodoId) => (nodoId && indice.has(nodoId) ? indice.get(nodoId) : FINAL);
    const destinoDe = (nodoId, salida) => indiceDe(salidaDe(nodoId, salida));

    /* ── Un paso por nodo ── */

    return orden.map((nodo, i) => {
        if (nodo.type === TIPOS.CONDICION) {
            return {
                step: i,
                control: 'condicion',
                condicion: nodo.data?.condicion || null,
                siStep: destinoDe(nodo.id, SALIDA_SI),
                noStep: destinoDe(nodo.id, SALIDA_NO),
            };
        }

        if (nodo.type === TIPOS.VARIABLE) {
            return {
                step: i,
                control: 'variable',
                setVars: Array.isArray(nodo.data?.setVars) ? nodo.data.setVars : [],
                nextStep: destinoDe(nodo.id, SALIDA_DEFECTO),
            };
        }

        if (nodo.type === TIPOS.FIN) {
            return {
                step: i,
                control: 'fin',
                onComplete: nodo.data?.onComplete || null,
            };
        }

        /* ── Mensaje ── */
        const paso = JSON.parse(JSON.stringify(nodo.data?.paso || {}));
        paso.step = i;

        const { botones, selects } = componentesDePaso(paso);
        const tieneComponentes = botones.length > 0 || selects.length > 0;

        // La continuación normal: la salida suelta, o la de "sin respuesta"
        // cuando el paso tiene componentes pero no espera. Solo espera de
        // verdad con `esperarRespuesta: true`; sin valor, el runtime da por
        // agotado el tiempo igual que con false.
        if (!tieneComponentes) {
            paso.nextStep = destinoDe(nodo.id, SALIDA_DEFECTO);
        } else if (paso.esperarRespuesta !== true) {
            paso.nextStep = destinoDe(nodo.id, SALIDA_TIMEOUT);
            paso.timeoutAction = 'next';
            delete paso.timeoutTarget;
        } else {
            // Espera indefinidamente a que pulsen algo. Aun así el paso necesita
            // un `nextStep`: un botón con acción "next" y sin conexión lo usa, y
            // sin él avanzaría al paso de al lado en el array, que en un grafo no
            // significa nada. Apuntando al final, ahí se acaba el diálogo.
            paso.nextStep = FINAL;
        }

        // Cada botón y cada opción salta a donde apunte su conexión
        botones.forEach((b, bi) => {
            const objetivo = salidaDe(nodo.id, `btn:${bi}`);
            if (objetivo) {
                b.actionType = 'jump';
                b.actionParam = String(indiceDe(objetivo));
            } else if (b.actionType === 'jump') {
                // Sin conexión, un jump no tiene a dónde ir
                b.actionType = 'next';
                b.actionParam = '';
            }
            b.customId = customIdDeBoton(b.actionType, b.actionParam);
        });

        selects.forEach((s, si) => {
            (s.options || []).forEach((o, oi) => {
                const objetivo = salidaDe(nodo.id, `sel:${si}:${oi}`);
                if (objetivo) {
                    o.actionType = 'jump';
                    o.actionParam = String(indiceDe(objetivo));
                } else if (o.actionType === 'jump') {
                    o.actionType = 'next';
                    o.actionParam = '';
                }
            });
        });

        // El salto de una variante lo marca ahora el nodo Condición
        if (Array.isArray(paso.variantes)) {
            paso.variantes = paso.variantes.map(v => {
                const copia = { ...v };
                delete copia.nextStep;
                return copia;
            });
        }

        return paso;
    });
}

/**
 * Pasos de un documento, venga en grafo o en el formato antiguo.
 * Se cachea en `__pasos` para no recompilar en cada paso del diálogo.
 */
function pasosDeDialogo(doc) {
    if (!doc) return [];
    if (Array.isArray(doc.__pasos)) return doc.__pasos;

    const pasos = doc.grafo && Array.isArray(doc.grafo.nodes) && doc.grafo.nodes.length > 0
        ? compilarGrafo(doc)
        : (Array.isArray(doc.dialogos) ? doc.dialogos : (Array.isArray(doc.steps) ? doc.steps : []));

    Object.defineProperty(doc, '__pasos', { value: pasos, enumerable: false, configurable: true, writable: true });
    return pasos;
}

/** Olvida la compilación cacheada (al refrescar el diálogo desde el dashboard). */
function invalidarCache(doc) {
    if (doc && doc.__pasos) delete doc.__pasos;
}

const esPasoDeControl = (paso) => Boolean(paso && CONTROLES.has(paso.control));

module.exports = {
    TIPOS,
    SALIDA_DEFECTO,
    SALIDA_SI,
    SALIDA_NO,
    SALIDA_TIMEOUT,
    compilarGrafo,
    pasosDeDialogo,
    invalidarCache,
    esPasoDeControl,
};
