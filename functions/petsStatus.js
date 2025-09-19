const ESTADOS_CONFIG = {
    // Estados especiales (mayor prioridad)
    dormido: {
        tipo: 'especial',
        peso: 1000, // Prioridad máxima
        requiereStats: false,
        efectos: ['bloquear_interacciones'],
        descripcion: 'Tu mascota está durmiendo... '
    },

    // Penalizaciones por stats críticos
    enfermo: {
        tipo: 'penalizacion',
        peso: 100,
        statRequerido: 'higiene',
        threshold: 5,
        tiempoParaAplicar: 2, // minutos
        tiempoParaEliminar: 240,
        requiereRecuperacion: 80, // stat debe llegar a 80 para eliminar
        efectos: ['reducir_felicidad', 'visual_enfermo'],
        descripcion: 'Tu mascota está enferma por falta de higiene',
    },

    deprimido: {
        tipo: 'penalizacion',
        peso: 90,
        statRequerido: 'felicidad',
        threshold: 10,
        tiempoParaAplicar: 240,
        tiempoParaEliminar: 240,
        requiereRecuperacion: 80,
        efectos: ['reducir_energia', 'visual_triste'],
        descripcion: 'Tu mascota está deprimida'
    },

    incomodo: {
        tipo: 'penalizacion',
        peso: 80,
        statRequerido: 'hambre',
        threshold: 5,
        tiempoParaAplicar: 240,
        tiempoParaEliminar: 240,
        requiereRecuperacion: 80,
        efectos: ['reducir_felicidad'],
        descripcion: 'Tu mascota tiene hambre'
    },

    somnoliento: {
        tipo: 'penalizacion',
        peso: 120,
        statRequerido: 'energia',
        threshold: 5,
        tiempoParaAplicar: 1,
        tiempoParaEliminar: 240,
        requiereRecuperacion: 60,
        efectos: ['reducir_energia'],
        descripcion: 'Tu mascota tiene sueño'
    },

    // Bonificaciones (menor prioridad)
    entusiasmado: {
        tipo: 'bonificacion',
        peso: 10,
        statRequerido: 'felicidad',
        threshold: 90, // Debe estar por encima para activarse
        tiempoParaAplicar: 60,
        efectos: ['bonus_exp', 'visual_feliz'],
        descripcion: 'Tu mascota está muy feliz',
        ignore: "enfermo",
    },

    llenito: {
        tipo: 'bonificacion',
        peso: 10,
        statRequerido: 'hambre',
        threshold: 90,
        tiempoParaAplicar: 60,
        efectos: ['bonus_energia'],
        descripcion: 'Tu mascota está satisfecha',
        ignore: "hambre"
    }
};

const clientdb = require("../Server");
const db2 = clientdb.db("Rol_db")
const pets = db2.collection("Mascotas")


const estadosMascota = {

    async evaluarEstados(pet, petDesgaste) {
        const now = Math.floor(Date.now() / 1000);
        const estadosActivos = [];

        for (const [nombreEstado, config] of Object.entries(ESTADOS_CONFIG)) {
            const resultado = await this.evaluarEstadoIndividual(
                nombreEstado,
                config,
                pet,
                petDesgaste,
                now
            );
            if (resultado) {
                estadosActivos.push(resultado);
            }
        }
        await this.actualizarEstadosEnBD(pet, estadosActivos);
        return this.obtenerEstadoPrioritario(estadosActivos);
    },

    /**
     * Convierte tu estructura de desgaste a puntos por minuto
     */
    calcularPuntosPorMinuto(statConfig) {
        return statConfig.desgasteIntervalo / statConfig.intervalo;
    },


    /**
     * Evalúa un estado individual según su configuración
     */
    async evaluarEstadoIndividual(nombreEstado, config, pet, petDesgaste, currentTime) {
        // Estados especiales (como dormido) se manejan diferente
        if (config.tipo === 'especial') {
            return this.evaluarEstadoEspecial(nombreEstado, config, pet);
        }
        // Estados basados en stats
        if (!config.statRequerido || !pet.saveStats[config.statRequerido]) {
            return null;
        }


        const statActual = pet.saveStats[config.statRequerido];
        const statConfig = petDesgaste[config.statRequerido];

        if (!statConfig) return null;

        // Convertir a puntos por minuto usando tu estructura
        const lossRate = this.calcularPuntosPorMinuto(statConfig);

        console.log("LossRate: ", lossRate)

        // Calcular puntos actuales
        const tiempoTranscurrido = (currentTime - statActual.time) / 60; // minutos
        const puntosActuales = Math.max(0, statActual.points - (lossRate * tiempoTranscurrido));

        if (config.tipo === 'penalizacion') {
            return this.evaluarPenalizacion(nombreEstado, config, puntosActuales, statActual, currentTime, pet.penalizaciones, petDesgaste);
        } else if (config.tipo === 'bonificacion') {
            return this.evaluarBonificacion(nombreEstado, config, puntosActuales, currentTime, pet);
        }

        return null;
    },

    /**
     * Evalúa estados especiales como dormir
     */
    evaluarEstadoEspecial(nombreEstado, config, pet) {
        // Verificar si el estado especial está activo en la BD
        const estadoActivo = pet.penalizaciones?.[nombreEstado];

        if (estadoActivo) {
            return {
                nombre: nombreEstado,
                tipo: config.tipo,
                peso: config.peso,
                efectos: config.efectos,
                descripcion: config.descripcion,
                activo: true,
                desde: estadoActivo.desde
            };
        }

        return null;
    },

    /**
     * Evalúa penalizaciones por stats bajos
     */
    evaluarPenalizacion(nombreEstado, config, puntosActuales, statGuardado, currentTime, penalizaciones, petDesgaste) {
        const penalizacionExistente = penalizaciones?.[nombreEstado];
        // Si los puntos están por encima del threshold
        if (puntosActuales > config.threshold) {
            // Si hay penalización activa, verificar si se puede eliminar
            if (penalizacionExistente && puntosActuales >= config.requiereRecuperacion) {
                const tiempoPenalizacion = (currentTime - penalizacionExistente.desde) / 60;
                if (tiempoPenalizacion >= config.tiempoParaEliminar) {
                    
                    console.log("Estado eliminado")
                    return {
                        nombre: nombreEstado,
                        accion: 'eliminar'
                    };
                }
            }
            return null;
        }

        // Calcular cuándo se volvió crítico
        const statConfig = petDesgaste[config.statRequerido];
        const lossRate = statConfig.desgasteIntervalo / statConfig.intervalo; // puntos por minuto
        const minutosParaCritico = (statGuardado.points - config.threshold) / lossRate;
        const tiempoCritico = Math.floor(statGuardado.time + (minutosParaCritico * 60));
        const minutosCritico = (currentTime - tiempoCritico) / 60;

        // Si ha pasado suficiente tiempo en estado crítico
        if (minutosCritico >= config.tiempoParaAplicar) {
            // Crear o actualizar penalización
            if (!penalizacionExistente) {
                console.log("Estado nuevo aplicado")
                return {
                    nombre: nombreEstado,
                    tipo: config.tipo,
                    peso: config.peso,
                    efectos: config.efectos,
                    descripcion: config.descripcion,
                    activo: true,
                    accion: 'crear',
                    desde: Math.floor(Date.now() / 1000),
                    causadoPor: config.statRequerido
                };
            } else {
                console.log("Estado actualizado")
                return {
                    nombre: nombreEstado,
                    tipo: config.tipo,
                    peso: config.peso,
                    efectos: config.efectos,
                    descripcion: config.descripcion,
                    activo: true,
                    desde: penalizacionExistente.desde,
                    causadoPor: config.statRequerido
                };
            }
        }

        return null;
    },

    /**
      * Evalúa bonificaciones por stats altos
      */
    evaluarBonificacion(nombreEstado, config, puntosActuales, currentTime, pet) {
        console.log("Aplicando bonus...")


        if (puntosActuales >= config.threshold) {
            const activos = Object.entries(pet.penalizaciones).map(([key, info]) => {
                return config.ignore === key
            })

            if (activos) return console.log("Efecto no aplicado")

            return {
                nombre: nombreEstado,
                tipo: config.tipo,
                peso: config.peso,
                efectos: config.efectos,
                descripcion: config.descripcion,
                activo: true
            };
        }

        return null;
    },

    /**
      * Obtiene el estado con mayor prioridad (peso)
      */
    obtenerEstadoPrioritario(estadosActivos) {
        if (estadosActivos.length === 0) return null;

        // Filtrar solo estados activos
        const activos = estadosActivos.filter(estado => estado.activo);
        if (activos.length === 0) return null;

        // Ordenar por peso (mayor peso = mayor prioridad)
        return activos.sort((a, b) => b.peso - a.peso)[0];
    },

    async actualizarEstadosEnBD(pet, estadosEvaluados) {
        for (const estado of estadosEvaluados) {
            console.log("Estados evaluados", estado)
            if (estado.accion === 'crear') {
                pet.penalizaciones[estado.nombre] = {
                    desde: estado.desde,
                    causadoPor: estado.causadoPor,
                    tipo: estado.tipo
                };
            } else if (estado.accion === 'eliminar') {
                delete pet.penalizaciones[estado.nombre];
            }
        }

        console.log("Actualizando penalizaciones en la base de datos...")

        const sup = await pets.updateOne(
            { _id: pet._id },
            { $set: { penalizaciones: pet.penalizaciones } }
        );
    },

    /**
      * Activa un estado especial manualmente (como dormir)
      */
    async activarEstadoEspecial(pet, nombreEstado) {
        const config = ESTADOS_CONFIG[nombreEstado];
        if (!config || config.tipo !== 'especial') {
            throw new Error('Estado especial no válido');
        }

        pet.penalizaciones[nombreEstado] = {
            desde: new Date(),
            tipo: config.tipo,
            manual: true
        };

        await pets.updateOne(
            { _id: pet._id },
            { $set: { penalizaciones: pet.penalizaciones } }
        );
    },

    async desactivarEstadoEspecial(pet, nombreEstado) {
        if (pet.penalizaciones[nombreEstado]) {
            delete pet.penalizaciones[nombreEstado];
            await pets.updateOne(
                { _id: pet._id },
                { $set: { penalizaciones: pet.penalizaciones } }
            );
        }
    }

}

const huevoMascota = {


    async criar(huevo, manual, parametros) {
        

        

    }
}

module.exports = estadosMascota
