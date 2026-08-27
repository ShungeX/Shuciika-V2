const ESC = '\u001b';
const colores = {
    reset: '[0m',
    bold: '[1m',
    red: '[2;31m',
    green: '[2;32m',
    yellow: '[2;33m',
    blue: '[2;34m',
    gray: '[2;37m'
};
const OFFSET_MEXICO_MS = 6 * 60 * 60 * 1000
function colorizeText(text, color) {
    return `${ESC}${color}${text}${ESC}${colores.reset}`;
}

const CATEGORY_PARTICIPLES = {
    bebible:    'bebido',
    comestible: 'comido',
    ungüento:   'aplicado',
    unguento:   'aplicado',
    pergamino:  'leído',
    polvo:      'esparcido',
    generico:   'usado',
};

const SPELL_PARTICIPLE = 'conjurado';

function getParticiple(item) {
    if (item.tipo === 'hechizo') return SPELL_PARTICIPLE;
    if (item.participioOverride) return item.participioOverride;
    
    const tipos = Array.isArray(item.Tipo) ? item.Tipo : (item.Tipo ? [item.Tipo] : []);
    for (const t of tipos) {
        const key = String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (CATEGORY_PARTICIPLES[key]) {
            return CATEGORY_PARTICIPLES[key];
        }
    }
    return CATEGORY_PARTICIPLES.generico;
}

const AUX = { tu: 'has', el: 'ha', ellos: 'han' };

function joinTargets(nombres) {
    if (!nombres || nombres.length === 0) return '';
    if (nombres.length === 1) return nombres[0];
    return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

const EFFECT_TEMPLATES = {
    curacion: (d, p, c) => {
        const text = `${d.cantidad} HP`;
        const cant = c ? colorizeText(text, colores.yellow) : text;
        if (d.objetivo) {
            const obj = c ? colorizeText(d.objetivo, colores.green) : d.objetivo;
            return `${obj} ${AUX.el} recuperado ${cant}`;
        }
        return `${AUX[p]} recuperado ${cant}`;
    },
    heal: (d, p, c) => {
        const text = `${d.cantidad} HP`;
        const cant = c ? colorizeText(text, colores.yellow) : text;
        if (d.objetivo) {
            const obj = c ? colorizeText(d.objetivo, colores.green) : d.objetivo;
            return `${obj} ${AUX.el} recuperado ${cant}`;
        }
        return `${AUX[p]} recuperado ${cant}`;
    },
    mana: (d, p, c) => {
        const text = `${d.cantidad} de mana`;
        const cant = c ? colorizeText(text, colores.yellow) : text;
        return `${AUX[p]} recuperado ${cant}`;
    },
    buff: (d, p, c) => {
        const statText = c ? colorizeText(d.stat, colores.yellow) : d.stat;
        const pctText = `${d.porcentaje}%`;
        const pct = c ? colorizeText(pctText, colores.yellow) : pctText;
        const possessive = p === 'tu' ? 'tu' : 'su';
        return `${possessive} ${statText} ${AUX[p]} aumentado en un ${pct}`;
    },
    danio: (d, p, c) => {
        const objetivos = joinTargets(d.objetivos.map(obj => c ? colorizeText(obj, colores.red) : obj));
        const aux = d.objetivos.length > 1 ? AUX.ellos : AUX.el;
        const text = `${d.cantidad} de daño`;
        const cant = c ? colorizeText(text, colores.red) : text;
        return `${objetivos} ${aux} recibido ${cant}`;
    },
    damage: (d, p, c) => {
        const objetivos = joinTargets(d.objetivos.map(obj => c ? colorizeText(obj, colores.red) : obj));
        const aux = d.objetivos.length > 1 ? AUX.ellos : AUX.el;
        const text = `${d.cantidad} de daño`;
        const cant = c ? colorizeText(text, colores.red) : text;
        return `${objetivos} ${aux} recibido ${cant}`;
    },
    estado: (d, p, c) => {
        const objetivo = c ? colorizeText(d.objetivo, colores.red) : d.objetivo;
        const duracionText = d.turnos ? ` durante ${d.turnos} turno(s)` : '';
        return `${objetivo} ha quedado ${d.estado}${duracionText}`;
    },
};

function joinValues(values) {
    if (!values || values.length === 0) return '';
    if (values.length === 1) return values[0];
    return `${values.slice(0, -1).join(', ')} y ${values[values.length - 1]}`;
}

function getTargetsKey(targets) {
    return targets
        .map(t => String(t.ID || t.Nombre || t))
        .sort()
        .join(',');
}

function getTargetsDisplay(targets, colorized, color) {
    const names = targets.map(t => t.Nombre || String(t));
    if (colorized && color) {
        return joinTargets(names.map(name => colorizeText(name, color)));
    }
    return joinTargets(names);
}

function buildActionMessage({ actor, item, efectos, objetivos, perspectiva = 'el', colorized = false, actorId = null }) {
    const participio = getParticiple(item);
    
    let sujeto = '';
    if (perspectiva === 'tu') {
        sujeto = 'Has';
    } else {
        const actorText = colorized ? colorizeText(actor, colores.green) : actor;
        sujeto = `${actorText} ha`;
    }
    
    const itemName = item.Nombre || item.nombre || 'un objeto';
    const itemText = colorized ? colorizeText(itemName, colores.blue) : itemName;
    const accion = `${sujeto} ${participio} ${itemText}`;

    const damageGroup = [];
    const healingGroup = [];
    const manaGroup = [];
    const statusGroups = {};
    for (const ef of (efectos || [])) {
        const tipoEf = String(ef.tipo || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const statEf = String(ef.stat || '').toLowerCase();
        const value = Math.abs(Number(ef.valor));
        const targetName = ef.objetivos?.[0] || objetivos?.[0] || 'objetivo';
        const targetId = ef.targetId || null;
        const targetObj = { ID: targetId, Nombre: targetName };

        if (tipoEf === 'danio' || tipoEf === 'dano' || tipoEf === 'damage') {
            damageGroup.push({ target: targetObj, valor: value });
        } else if (tipoEf === 'curacion' || tipoEf === 'heal' || (tipoEf === 'regeneracion' && statEf === 'hp')) {
            healingGroup.push({ target: targetObj, valor: value });
        } else if (
            tipoEf === 'mana' || 
            tipoEf === 'recuperar_mana' || 
            tipoEf === 'restaurar_mana' || 
            statEf === 'mana' || 
            (tipoEf === 'regeneracion' && (statEf === 'mana' || statEf === ''))
        ) {
            manaGroup.push({ target: targetObj, valor: value });
        } else if (ef.duracion && ef.duracion > 0) {
            const statusName = ef.Nombre || ef.tipo || 'afectado';
            const statusKey = statusName.toLowerCase();
            if (!statusGroups[statusKey]) {
                statusGroups[statusKey] = {
                    name: statusName,
                    duracion: ef.duracion,
                    targets: []
                };
            }
            statusGroups[statusKey].targets.push(targetObj);
        }
    }

    const generatedClauses = [];

    // Helper para verificar si un objetivo es el actor/caster
    const isActor = (t) => {
        if (actorId && t.ID) {
            return String(actorId) === String(t.ID);
        }
        return String(actor).toLowerCase() === String(t.Nombre).toLowerCase();
    };

    // 1. Daño
    if (damageGroup.length > 0) {
        const uniqueTargets = [];
        const targetMap = new Map();
        for (const item of damageGroup) {
            const key = item.target.ID || item.target.Nombre;
            if (!targetMap.has(key)) {
                targetMap.set(key, { target: item.target, valores: [] });
                uniqueTargets.push(item.target);
            }
            targetMap.get(key).valores.push(item.valor);
        }

        const targets = uniqueTargets;
        const values = targets.map(t => {
            const key = t.ID || t.Nombre;
            return targetMap.get(key).valores.reduce((a, b) => a + b, 0);
        });

        const totalDmgSum = values.reduce((a, b) => a + b, 0);
        if (totalDmgSum === 0 && healingGroup.length > 0) {
            // Omitir diálogo "Ha recibido 0 de daño" cuando el ataque va acompañado de curación
        } else {
            const targetsKey = getTargetsKey(targets);
            let textWithTargets = '';
            let textWithoutTargets = '';

            if (targets.length === 1) {
                const tgtName = targets[0].Nombre;
                const tgtDisplay = colorized ? colorizeText(tgtName, colores.red) : tgtName;
                const valDisplay = colorized ? colorizeText(`${values[0]} de daño`, colores.yellow) : `${values[0]} de daño`;
                textWithTargets = `${tgtDisplay} ha recibido ${valDisplay}`;
                textWithoutTargets = `ha recibido ${valDisplay}`;
            } else {
                const tgtDisplay = getTargetsDisplay(targets, colorized, colores.red);
                const valDisplays = values.map(v => colorized ? colorizeText(`${v}`, colores.yellow) : `${v}`);
                const valDisplay = joinValues(valDisplays) + ' de daño';
                textWithTargets = `${tgtDisplay} han recibido ${valDisplay}`;
                textWithoutTargets = `han recibido ${valDisplay}`;
            }

            generatedClauses.push({
                type: 'damage',
                targetsKey,
                textWithTargets,
                textWithoutTargets
            });
        }
    }

    // 2. Curación
    if (healingGroup.length > 0) {
        const uniqueTargets = [];
        const targetMap = new Map();
        for (const item of healingGroup) {
            const key = item.target.ID || item.target.Nombre;
            if (!targetMap.has(key)) {
                targetMap.set(key, { target: item.target, valores: [] });
                uniqueTargets.push(item.target);
            }
            targetMap.get(key).valores.push(item.valor);
        }

        const targets = uniqueTargets;
        const values = targets.map(t => {
            const key = t.ID || t.Nombre;
            return targetMap.get(key).valores.reduce((a, b) => a + b, 0);
        });

        const targetsKey = getTargetsKey(targets);
        let textWithTargets = '';
        let textWithoutTargets = '';

        const auxVerbSingular = perspectiva === 'tu' ? 'has' : 'ha';

        if (targets.length === 1) {
            const isSelf = isActor(targets[0]);
            const tgtName = targets[0].Nombre;
            const tgtDisplay = colorized ? colorizeText(tgtName, colores.green) : tgtName;
            const valDisplay = colorized ? colorizeText(`${values[0]} HP`, colores.yellow) : `${values[0]} HP`;

            if (isSelf) {
                textWithTargets = `${auxVerbSingular} recuperado ${valDisplay}`;
                textWithoutTargets = `${auxVerbSingular} recuperado ${valDisplay}`;
            } else {
                textWithTargets = `${tgtDisplay} ha recuperado ${valDisplay}`;
                textWithoutTargets = `ha recuperado ${valDisplay}`;
            }
        } else {
            const tgtDisplay = getTargetsDisplay(targets, colorized, colores.green);
            const valDisplays = values.map(v => colorized ? colorizeText(`${v} HP`, colores.yellow) : `${v} HP`);
            textWithTargets = `${tgtDisplay} han recuperado ${joinValues(valDisplays)}`;
            textWithoutTargets = `han recuperado ${joinValues(valDisplays)}`;
        }

        generatedClauses.push({
            type: 'healing',
            targetsKey,
            textWithTargets,
            textWithoutTargets
        });
    }

    // 3. Mana
    if (manaGroup.length > 0) {
        const uniqueTargets = [];
        const targetMap = new Map();
        for (const item of manaGroup) {
            const key = item.target.ID || item.target.Nombre;
            if (!targetMap.has(key)) {
                targetMap.set(key, { target: item.target, valores: [] });
                uniqueTargets.push(item.target);
            }
            targetMap.get(key).valores.push(item.valor);
        }

        const targets = uniqueTargets;
        const values = targets.map(t => {
            const key = t.ID || t.Nombre;
            return targetMap.get(key).valores.reduce((a, b) => a + b, 0);
        });

        const targetsKey = getTargetsKey(targets);
        let textWithTargets = '';
        let textWithoutTargets = '';

        const auxVerbSingular = perspectiva === 'tu' ? 'has' : 'ha';

        if (targets.length === 1) {
            const isSelf = isActor(targets[0]);
            const tgtName = targets[0].Nombre;
            const tgtDisplay = colorized ? colorizeText(tgtName, colores.green) : tgtName;
            const valDisplay = colorized ? colorizeText(`${values[0]} de mana`, colores.yellow) : `${values[0]} de mana`;

            if (isSelf) {
                textWithTargets = `${auxVerbSingular} recuperado ${valDisplay}`;
                textWithoutTargets = `${auxVerbSingular} recuperado ${valDisplay}`;
            } else {
                textWithTargets = `${tgtDisplay} ha recuperado ${valDisplay}`;
                textWithoutTargets = `ha recuperado ${valDisplay}`;
            }
        } else {
            const tgtDisplay = getTargetsDisplay(targets, colorized, colores.green);
            const valDisplays = values.map(v => colorized ? colorizeText(`${v} de mana`, colores.yellow) : `${v} de mana`);
            textWithTargets = `${tgtDisplay} han recuperado ${joinValues(valDisplays)}`;
            textWithoutTargets = `han recuperado ${joinValues(valDisplays)}`;
        }

        generatedClauses.push({
            type: 'mana',
            targetsKey,
            textWithTargets,
            textWithoutTargets
        });
    }

    // 4. Estados alterados (buffs/debuffs con duración)
    for (const key in statusGroups) {
        const status = statusGroups[key];
        const uniqueTargets = [];
        for (const t of status.targets) {
            if (!uniqueTargets.some(u => (u.ID && u.ID === t.ID) || u.Nombre === t.Nombre)) {
                uniqueTargets.push(t);
            }
        }

        const targets = uniqueTargets;
        const targetsKey = getTargetsKey(targets);
        const stateNameText = colorized ? colorizeText(status.name, colores.red) : status.name;
        const durationText = colorized ? colorizeText(`${status.duracion} turno(s)`, colores.red) : `${status.duracion} turno(s)`;

        let textWithTargets = '';
        let textWithoutTargets = '';

        if (targets.length === 1) {
            const isSelf = isActor(targets[0]);
            const tgtName = targets[0].Nombre;
            const tgtDisplay = colorized ? colorizeText(tgtName, colores.red) : tgtName;

            if (isSelf) {
                textWithTargets = `ha quedado con ${stateNameText} durante ${durationText}`;
                textWithoutTargets = `ha quedado con ${stateNameText} durante ${durationText}`;
            } else {
                textWithTargets = `${tgtDisplay} ha quedado con ${stateNameText} durante ${durationText}`;
                textWithoutTargets = `ha quedado con ${stateNameText} durante ${durationText}`;
            }
        } else {
            const tgtDisplay = getTargetsDisplay(targets, colorized, colores.red);
            textWithTargets = `${tgtDisplay} han quedado con ${stateNameText} durante ${durationText}`;
            textWithoutTargets = `han quedado con ${stateNameText} durante ${durationText}`;
        }

        generatedClauses.push({
            type: 'status',
            targetsKey,
            textWithTargets,
            textWithoutTargets
        });
    }

    let combinedText = accion;

    if (generatedClauses.length === 0) {
        return combinedText + '... pero no ha sucedido nada...';
    }

    let lastTargetsKey = null;

    for (let i = 0; i < generatedClauses.length; i++) {
        const clause = generatedClauses[i];
        const isSameTarget = lastTargetsKey && (clause.targetsKey === lastTargetsKey);

        let clauseText = isSameTarget ? clause.textWithoutTargets : clause.textWithTargets;

        if (i === 0) {
            combinedText += ' y ' + clauseText;
        } else {
            if (isSameTarget) {
                combinedText += ' y ' + clauseText;
            } else {
                combinedText += ', además ' + clauseText;
            }
        }
        lastTargetsKey = clause.targetsKey;
    }

    return combinedText + '.';
}

// 3. Exportamos las herramientas que usarán tus otros archivos
module.exports = {
    buildActionMessage,

    asciiText(accion) {
        switch (accion.tipo) {
            case 'ataque': {
                const atacante = colorizeText(accion.data.atacante, colores.green);
                const defensor = colorizeText(accion.data.defensor, colores.red);
                const daño = colorizeText(accion.data.daño, colores.yellow);
                return `${atacante} inflige ${daño} de daño a ${defensor}.`;
            }
            case 'esquive': {
                const defensor = colorizeText(accion.data.defensor, colores.red);
                const atacante = colorizeText(accion.data.atacante, colores.green);
                return `${defensor} ha esquivado el ataque de ${atacante}.`;
            }
            case 'efecto_periodico': {
                const personaje = colorizeText(accion.data.personaje, colores.bold);
                const valor = colorizeText(accion.data.valor, accion.data.isDmg ? colores.red : colores.yellow);
                const effectName = colorizeText(accion.data.efecto, colores.blue);
                if (accion.data.isDmg) {
                    return `${personaje} recibió ${valor} de daño por ${effectName}`;
                } else {
                    return `${personaje} recibió ${valor} de curación por ${effectName}`;
                }
            }
            case 'derrota': {
                const data = accion.data || {};
                const derrotadosList = Array.isArray(data.derrotados)
                    ? data.derrotados
                    : (data.derrotado ? [data.derrotado] : []);

                if (derrotadosList.length > 1) {
                    const nombres = joinTargets(derrotadosList.map(n => colorizeText(n, colores.bold)));
                    const sucumbido = colorizeText('han sucumbido 💀', colores.red);
                    return `${nombres} ${sucumbido}`;
                } else if (derrotadosList.length === 1) {
                    const nombre = colorizeText(derrotadosList[0], colores.bold);
                    const sucumbido = colorizeText('ha sucumbido 💀', colores.red);
                    return `${nombre} ${sucumbido}`;
                }
                const fallback = colorizeText(data.mensaje || 'Un combatiente', colores.bold);
                return `${fallback} ha sucumbido 💀`;
            }
            case 'hechizo': {
                const lanzador = colorizeText(accion.data.lanzador, colores.green);
                const hechizo = colorizeText(accion.data.nombreHechizo, colores.blue);
                return `${lanzador} lanza el hechizo ${hechizo}.`;
            }
            case 'defender': {
                const defensor = colorizeText(accion.data.defensor, colores.green)
                const defensaObtenida = colorizeText(accion.data.defensaObtenida, colores.yellow)
                return `${defensor} se defiende y obtiene ${defensaObtenida} de defensa adicional para esta ronda.`
            }
            case 'objeto': {
                if (accion.data.item) {
                    // Si hay un textoLog y no hay efectos, mostrarlo directamente (fallo, canalización, etc.)
                    if (accion.data.textoLog && (!accion.data.efectos || accion.data.efectos.length === 0)) {
                        return colorizeText(accion.data.textoLog, colores.gray);
                    }
                    return buildActionMessage({
                        actor: accion.data.autor,
                        actorId: accion.data.autorId || null,
                        item: accion.data.item,
                        efectos: accion.data.efectos,
                        objetivos: accion.data.objetivos,
                        perspectiva: 'el',
                        colorized: true
                    });
                }
                const efectoPositivo = colorizeText(accion.data.efectoPositivo, colores.green);
                const efectoNegativo = colorizeText(accion.data.efectoNegativo, colores.red);
                const autor = colorizeText(accion.data.autor, colores.green);
                const objetivos = accion.data.objetivos.map(obj => colorizeText(obj, colores.red)).join(", ");
                const efecto = accion.data.efectoPositivo ? efectoPositivo : efectoNegativo;
                return `${autor} usa un objeto sobre ${objetivos}, causando el efecto: ${efecto}.`;
            }
            case 'inicioDuelo': 
            case 'inicio': {

                const parte1 = colorizeText('El duelo ha', colores.green);

                const parte2 = colorizeText('comenzado', accion.data.esJefe ? colores.red : colores.green);

                return `${parte1} ${parte2}`;

            }
            case 'ronda_fin': {
                return colorizeText(accion.data.textoLog, colores.gray);
            }
            case 'turno_timeout': {
                return colorizeText(`${accion.data.personaje || 'Un jugador'} ha tardado en responder...`, colores.gray);
            }
            case 'afk':
            case 'afk_total': {
                return colorizeText(accion.data.textoLog || `${accion.data.personaje || 'Un jugador'} ha sido marcado como AFK.`, colores.gray);
            }
            default:
                return 'Acción desconocida.';
        }
    },

    /** 
     * 
     * @param {dataCharacter} current - Vida actual del jugador
     * @param {dataCharacter} max - Vida maxima del jugador
     * @param {Number} emoji - 1: Vida, 2: Mana, default: Object-emoji.lleno, emoji.vacio
     * @param {Number} barraLenght - Tamaño de barra
     * @returns 
     */
    barraCustom(current, max, emoji, barraLenght = 10) {
        let emojiSet;

        switch (emoji) {
            case 1: // Vida
                emojiSet = {
                    lleno: "❤︎",
                    vacio: "𖹭",
                    especial: '<a:AttencionHeart:1345256576167968828>'
                };
                break;
            case 2: //mana
                emojiSet = {
                    lleno: '<:iconMana:1370897534083534978>',
                    vacio: ".",
                }
            default:
                if (typeof emoji === "object" && emoji.lleno && emoji.vacio) {
                    emojiSet = emoji
                } else {
                    emojiSet = {
                        lleno: '█',
                        vacio: '░',
                    }
                }
        }

        const porcentaje = (current / max) * 100
        let filledBars = Math.round((current / max) * barraLenght);

        if (current > 0 && filledBars === 0) {
            filledBars = 1
        }

        if (current <= 0) {
            filledBars = 0
        }

        const emptyBars = barraLenght - filledBars;

        let barraLlena = '';
        const barraVacia = emojiSet.vacio.repeat(emptyBars);

        if (emojiSet.especial && porcentaje < 10 && filledBars > 0) {
            barraLlena = emojiSet.lleno.repeat(filledBars - 1) + emojiSet.especial
        } else {
            barraLlena = emojiSet.lleno.repeat(filledBars)
        }
        return `[${barraLlena}${barraVacia}] **(${current}/${max})**`;
    },

    pickRandom(array) {
        // Validación de seguridad por si el array viene vacío o no existe
        if (!array || array.length === 0) return null;

        // La fórmula mágica para sacar un elemento al azar
        const randomIndex = Math.floor(Math.random() * array.length);
        return array[randomIndex];
    },

    enHoraMexico(fecha) {
        const utcMs = new Date(fecha).getTime()
        const mexicoMs = utcMs + (-6 * 60 * 60 * 1000);
        return new Date(mexicoMs)
    },

    getDeadlineRacha(ultimaInteraccionSecs) {
        const enMexico = this.enHoraMexico(ultimaInteraccionSecs * 1000)
        //  enMexico.getUTCDate/Hours() → valores en hora México

        const deadline = new Date(enMexico)
        deadline.setUTCDate(deadline.getUTCDate() + 2)  // saltar al Día N+2
        deadline.setUTCHours(0, 0, 0, 0)               // 12:00am (hora México)

        // Revertir el shift: suma 6h para obtener UTC real
        return Math.floor((deadline.getTime() + OFFSET_MEXICO_MS) / 1000)
    },

    reinicio24hrs(ahoraSecs) {
    // 1. Convertir la hora actual (en segundos) a milisegundos
    const utcMs = ahoraSecs * 1000;

    // 2. Desplazar el tiempo a la zona horaria de México (UTC-6)
    const mexicoMs = utcMs - OFFSET_MEXICO_MS;
    const fechaMexico = new Date(mexicoMs);

    // 3. Sumar 1 día y establecer la hora exacta a las 00:00:00.000
    fechaMexico.setUTCDate(fechaMexico.getUTCDate() + 1);
    fechaMexico.setUTCHours(0, 0, 0, 0);
    // 4. Revertir el desplazamiento sumando las 6 horas para volver al UTC real
    const siguienteReinicioUtcMs = fechaMexico.getTime() + OFFSET_MEXICO_MS;

    // 5. Retornar el valor en segundos
    return Math.floor(siguienteReinicioUtcMs / 1000);
    },

    /**
     * Genera la representación gráfica en texto de una barra de energía de 5 bloques.
     * @param {number} currentEnergy - Energía actual del personaje.
     * @param {number} maxEnergy - Energía máxima posible.
     * @returns {string} Texto formateado con la barra [⚡⚡⚡..] y el contador (current/max).
     */
    barrasDeEnergia(currentEnergy, maxEnergy) {
        const cEnergy = Math.max(0, Number(currentEnergy || 0));
        const mEnergy = Number(maxEnergy || 140);
        const maxbar = 5;

        const valParaBarra = cEnergy > mEnergy ? mEnergy : (cEnergy < 0 ? 0 : cEnergy);
        const filledBars = Math.round((valParaBarra / mEnergy) * maxbar);
        const emptyBars = Math.max(0, maxbar - filledBars);

        const energyBars = "⚡".repeat(filledBars);
        const energyEmpty = ".".repeat(emptyBars);

        return "`[" + energyBars + energyEmpty + "]` **(" + cEnergy + "/" + mEnergy + ")**";
    },

    /**
     * Edita un mensaje de Discord o re-envía uno nuevo en el canal si el mensaje ya no existe (Error 10008 / 404).
     * @param {import('discord.js').Interaction} interaction
     * @param {Object} exploracionCache - Caché de la transacción para actualizar la referencia al nuevo mensaje.
     * @param {import('discord.js').Message} messageObj - Objeto mensaje a editar.
     * @param {Object} payload - Contenido a enviar o editar.
     */
    async editarOMandarMensaje(interaction, exploracionCache, messageObj, payload) {
        try {
            if (messageObj && typeof messageObj.edit === 'function') {
                const updated = await messageObj.edit(payload);
                if (exploracionCache) exploracionCache.message = updated;
                return updated;
            }
        } catch (error) {
            if (error.code === 10008 || error.status === 404 || error.message?.includes("10008")) {
                console.log("Mensaje original no encontrado (10008/404). Re-enviando mensaje en canal...");
                try {
                    const newMsg = await interaction.channel.send(payload);
                    if (exploracionCache) exploracionCache.message = newMsg;
                    return newMsg;
                } catch (e) {
                    console.error("Error al re-enviar mensaje en canal:", e);
                }
            } else {
                console.error("Error al editar mensaje:", error);
            }
        }
        return null;
    }

};