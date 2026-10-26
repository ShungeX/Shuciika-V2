/* ==========================================================================
   reflejoKyu.js — el mensaje cifrado que lleva a /kyu
   --------------------------------------------------------------------------
   El paso del reflejo y el enlace cifrado del MD. Lo normal es no llamarlo a
   mano: el hook data/dialogos/funciones_evento/reflejo_kyu.js lo expone en el
   desplegable del dashboard y se engancha a un paso del dialogo desde ahi.

   Para llamarlo suelto desde cualquier otro sitio:

       const { enviarReflejo } = require('./functions/reflejoKyu.js');
       await enviarReflejo(await usuario.createDM(), usuario);

   Nadie fuera del lore debe saber que es esto: no hay nombres, ni el titulo
   del embed, ni logs que lo delaten.
   ========================================================================== */

const { EmbedBuilder } = require('discord.js');

/* --------------------------------------------------------------------------
   Ajustes
   -------------------------------------------------------------------------- */

const BLANCO = 0xffffff;
// #000000 a veces se dibuja como "sin color" en algunos clientes; #010101 no.
const NEGRO = 0x010101;

// Se lee de la misma variable que ya usa Server.js, asi que no hay nada
// que tocar a mano ni al pasar de local a dominio.
const BASE_WEB = process.env.FRONTEND_URL || 'http://localhost:5173';
const URL_KYU = `${BASE_WEB}/kyu`;

// Los glifos "glitch" antes de que el cifrado se estabilice (punto 3 de la
// spec). Ponlo en false y el embed negro sale ya con el enlace, de un solo
// `send` y sin ninguna edicion.
const CON_GLITCH = true;

// Si el azul del enlace enmascarado rompe demasiado el negro en tu cliente,
// pon esto en true: el cifrado pasa al `author` con `url`, que se dibuja en
// gris. Pruebalo en el cliente antes de decidir.
const ENLACE_EN_AUTHOR = false;

const MS_REFLEJO = 3000; // el reflejo en pantalla
const MS_GLITCH = 1200; // por cuadro; Discord admite ~5 ediciones / 5 s por canal

/* --------------------------------------------------------------------------
   Runas
   Sin acentos ni puntuacion; los espacios se conservan.
   Para generar mas textos: aRunas('el agua se queda')
   -------------------------------------------------------------------------- */

const ALFABETO = {
  a: 'ᚨ', b: 'ᛒ', c: 'ᚲ', d: 'ᛞ', e: 'ᛖ', f: 'ᚠ', g: 'ᚷ', h: 'ᚺ', i: 'ᛁ',
  j: 'ᛃ', k: 'ᛕ', l: 'ᛚ', m: 'ᛗ', n: 'ᚾ', o: 'ᛟ', p: 'ᛈ', q: 'ᛩ', r: 'ᚱ',
  s: 'ᛊ', t: 'ᛏ', u: 'ᚢ', v: 'ᚡ', w: 'ᚹ', x: 'ᛪ', y: 'ᛣ', z: 'ᛉ',
};

function aRunas(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // fuera los acentos
    .toLowerCase()
    .split('')
    .map((letra) => (letra === ' ' ? ' ' : ALFABETO[letra] || ''))
    .join('')
    .replace(/ {2,}/g, ' ')
    .trim();
}

const CIFRADO = aRunas('escucha despacio'); // ᛖᛊᚲᚢᚲᚺᚨ ᛞᛖᛊᛈᚨᚲᛁᛟ

// Ruido con runas que no aparecen en el cifrado. En el segundo cuadro se
// cuelan un par de letras de verdad, para que parezca que algo se asienta.
const GLITCH = [
  'ᛪᛩᛉᚹᛕᚠᚷ ᛃᚡᛣᛒᛪᛩᛉᚹ',
  'ᛖᛩᛉᚹᛕᚠᚨ ᛞᚡᛣᛒᛪᛩᛉᚹ',
  'ᛖᛊᚲᚢᛕᚺᚨ ᛞᛖᛊᛈᚨᛕᛁᛟ',
];

/* --------------------------------------------------------------------------
   Quien puede verlo
   Ahora mismo lo ve todo el mundo, pero la comprobacion vive aislada aqui:
   cambia solo el cuerpo de esta funcion (por ejemplo, exigir un personaje
   despertado) y el resto del flujo no se toca.
   -------------------------------------------------------------------------- */

async function puedeVerKyu(/* usuario */) {
  return true;

  // Ejemplo, para cuando lo quieras cerrar a personajes despertados:
  // const personaje = await Personaje.findOne({ ownerID: usuario.id, despertado: true });
  // return Boolean(personaje);
}

/* --------------------------------------------------------------------------
   Embeds
   -------------------------------------------------------------------------- */

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function embedBlanco(descripcion) {
  return new EmbedBuilder().setColor(BLANCO).setDescription(descripcion);
}

function embedNegro(texto) {
  return new EmbedBuilder().setColor(NEGRO).setDescription(texto);
}

function embedEnlace() {
  if (ENLACE_EN_AUTHOR) {
    // El cifrado como autor: se dibuja en gris, sin el azul del enlace.
    return new EmbedBuilder()
      .setColor(NEGRO)
      .setAuthor({ name: CIFRADO, url: URL_KYU });
  }
  return embedNegro(`[${CIFRADO}](${URL_KYU})`);
}

/* --------------------------------------------------------------------------
   El paso
   -------------------------------------------------------------------------- */

const REFLEJO =
  'Bajas tu mirada. En el agua hay tres reflejos. Sin embargo, cuando levantas la cabeza, solo hay dos.';

/**
 * @param {import('discord.js').TextBasedChannel} canal  el MD del usuario
 * @param {import('discord.js').User} usuario
 * @param {string} [textoContinuacion]  la narracion que sigue, si hay. Va en
 *        OTRO mensaje y con el marco de vuelta en blanco: el embed negro no
 *        se edita nunca despues, para que el enlace se quede donde esta.
 */
async function enviarReflejo(canal, usuario, textoContinuacion) {
  if (!(await puedeVerKyu(usuario))) return false;

  // 1. El reflejo, en blanco.
  await canal.send({ embeds: [embedBlanco(REFLEJO)] });
  await esperar(MS_REFLEJO);

  // 2. Mensaje nuevo (nunca una edicion del blanco) para que persista en el MD.
  if (CON_GLITCH) {
    const negro = await canal.send({ embeds: [embedNegro(GLITCH[0])] });
    for (let i = 1; i < GLITCH.length; i += 1) {
      await esperar(MS_GLITCH);
      await negro.edit({ embeds: [embedNegro(GLITCH[i])] });
    }
    await esperar(MS_GLITCH);
    await negro.edit({ embeds: [embedEnlace()] });
  } else {
    await canal.send({ embeds: [embedEnlace()] });
  }

  // 4. La narracion continua aparte, otra vez en blanco.
  if (textoContinuacion) {
    await esperar(MS_REFLEJO);
    await canal.send({ embeds: [embedBlanco(textoContinuacion)] });
  }

  return true;
}

module.exports = { enviarReflejo, puedeVerKyu, aRunas, CIFRADO, URL_KYU };
