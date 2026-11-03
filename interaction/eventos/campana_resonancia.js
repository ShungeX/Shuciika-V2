// interaction/eventos/campana_resonancia.js
// Botones del mensaje data/UI_ComponentsV2/eventos/campana_resonancia.js
// customId: evento---campana_resonancia-<accion>   (público: lo puede pulsar cualquiera)

const { responderEfimero, tieneEventoEnCurso, iniciarDialogoDeEvento, elegirAleatorio } = require('./_comun');

const OBSERVACIONES = [
    "El bronce está frío al tacto, pero tus dedos juran sentir un pulso muy débil bajo la superficie.",
    "Alguien ha grabado símbolos en el borde. Cuando los miras de frente, parecen cambiar de lugar.",
    "Un rayo de luz entra por la cúpula y la campana lo devuelve teñido de un color que no sabrías nombrar.",
    "Durante un instante te parece oír un eco lejano, como si la campana recordara la última vez que sonó.",
    "El paño de lino descansa doblado a su lado. Aún huele a lavanda y a algo más antiguo.",
    "Tu reflejo en el bronce no se mueve al mismo tiempo que tú. Casi.",
    "La cuerda del badajo está desgastada justo a la altura de una mano. Muchos la han tocado antes que tú.",
    "Cuanto más tiempo la miras, más silencioso se vuelve todo a tu alrededor."
];

// Último mensaje mostrado a cada usuario, para no repetirlo dos veces seguidas
const ultimaObservacion = new Map();

module.exports = {
    id: "campana_resonancia",

    acciones: {
        observar: async ({ interaction }) => {
            const texto = elegirAleatorio(OBSERVACIONES, ultimaObservacion, interaction.user.id);
            await responderEfimero(interaction, `*${texto}*`);
        },

        tocar: async (ctx) => {
            const { interaction, character, soul } = ctx;

            if (tieneEventoEnCurso(interaction.user.id)) {
                return responderEfimero(interaction, "La campana no responde mientras tu mente está en otra parte.\n-# Ya estás viviendo otro evento. Termínalo antes de empezar uno nuevo.");
            }
            if (!character) {
                return responderEfimero(interaction, "La campana no reconoce tu presencia.\n-# Necesitas un personaje activo para tocarla. ¿Por qué no intentas registrar uno?");
            }
            if (soul?.isFinish) {
                return responderEfimero(interaction, "Una estrella guarda aquello que resuena en tu alma.\n-# Ya has despertado el poder de tu personaje...");
            }

            await iniciarDialogoDeEvento(ctx, "primer_despertar");
        }
    }
};
