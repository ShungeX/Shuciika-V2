// ─────────────────────────────────────────────────────────────────────────────
// Registro de acciones de /interact y /act: textos, caritas y gifs que antes
// vivían repetidos en handlers/CMDHandler/Interactions/*.js.
//
// La clave es el SUBCOMANDO (hug, slap...). `tipo` apunta a config/amistad.js
// (TIPOS), que es donde viven los puntos. Para añadir una acción nueva:
//   1. entrada en TIPOS (config/amistad.js)
//   2. entrada aquí
//   3. subcomando en slashcmd/Interactivos/01-navi-central.js
// ─────────────────────────────────────────────────────────────────────────────

const azar = (lista) => lista[Math.floor(Math.random() * lista.length)]

// Etiquetas del menú del receptor, la frase que narra su reacción y el gif que
// se muestra al responder. {r} = receptor (quien responde), {e} = emisor.
// gif: endpoint de nekos.best; null = el gif de la propia acción (p. ej. devolver
// un punch muestra otro punch).
const RESPUESTAS = {
    afectuosa: [
        { valor: "corresponder", label: "Corresponder",   gif: null,      reaccion: "**{r}** correspondió con cariño ♡" },
        { valor: "ignorar",      label: "No hacer nada",  gif: "shrug",   reaccion: "**{r}** lo dejó pasar esta vez" },
        { valor: "rechazar",     label: "Negarse",        gif: "nope",    reaccion: "**{r}** prefirió que no esta vez" },
    ],
    juguetona: [
        { valor: "seguir",      label: "Seguir el juego", gif: null,      reaccion: "**{r}** le siguió el juego (≧▽≦)" },
        { valor: "ignorar",     label: "No hacer nada",   gif: "shrug",   reaccion: "**{r}** lo dejó pasar esta vez" },
        { valor: "incomodarse", label: "Incomodarse",     gif: "pout",    reaccion: "**{r}** se incomodó un poquito (・・;)" },
    ],
    hostil: [
        { valor: "devolver",  label: "Devolver",          gif: null,      reaccion: "**{r}** se la devolvió a **{e}** ╰（‵□′）╯" },
        { valor: "humor",     label: "Tomarlo con humor", gif: "laugh",   reaccion: "**{r}** se lo tomó con humor (￣▽￣)" },
        { valor: "ignorar",   label: "No hacer nada",     gif: "shrug",   reaccion: "**{r}** lo dejó pasar esta vez" },
        { valor: "ofenderse", label: "Ofenderse",         gif: "angry",   reaccion: "A **{r}** no le hizo nada de gracia (｡•́︿•̀｡)" },
    ],
}

/**
 * Cada acción:
 *   tipo        clave de TIPOS en config/amistad.js
 *   gif         endpoint de nekos.best (functions/getGifs.js)
 *   gifsDb      (opcional) colección de Interaccion_gifs con gifs propios del servidor
 *   textos      verbo entre emisor y receptor: "**A** <texto> **B**"
 *   caritas
 *   solo        { texto, gifs } sin objetivo. {u} = quien usa el comando
 *   aSiMismo    { texto, gifs } cuando se apunta a sí mismo. {u}
 *   bot         (n, u) => { texto, gif? } cuando el objetivo es Shuciika. n = veces que se lo han hecho
 *   contador    (n, u, o) => frase del contador histórico. o = objetivo
 */
const ACCIONES = {
    hug: {
        tipo: "abrazo",
        gif: "hug",
        gifsDb: "Hug",
        textos: ["le dio un abrazo a", "le dio un pequeño abrazo a", "le dio un abrazo fuerte a", "abrazó tiernamente a"],
        caritas: ["(つ≧▽≦)つ", "(*/▽＼*)", "(⊃｡•́‿•̀｡)⊃", "(⌒_⌒;)"],
        solo: { texto: "**{u}** necesita un abrazo (｡•́︿•̀｡)", gifs: ["https://acegif.com/wp-content/gif/anime-hug-18.gif", "https://acegif.com/wp-content/gif/anime-hug-39.gif"] },
        aSiMismo: { texto: "Tranquilo **{u}**, yo te doy un abrazo (⊃｡•́‿•̀｡)⊃\n-# Has recibido un abrazo de Shuciika", gifs: null },
        bot: (n, u) => ({ texto: `Gracias ${u} por el abrazo („• ֊ •„ ) ♡\n-# ${n === 1 ? "Es el primer abrazo que me das" : `Me has abrazado ${n} veces ♡`}` }),
        contador: (n, u, o) => n === 1 ? "Es el primer abrazo que se dan (≧◡≦) ♡" : `${u} y ${o} se han abrazado ${n} veces 🫂`,
    },
    pat: {
        tipo: "mimo",
        gif: "pat",
        textos: ["acarició a", "le hizo pat a", "acarició rapidito a", "acarició lentamente a"],
        caritas: ["♡( ◡‿◡ )", "( ◡‿◡ *)", "(„• ֊ •„)", "(´･ᴗ･ ` )"],
        solo: { texto: "**{u}** necesita un pat (｡•́︿•̀｡)", gifs: ["https://cdn.discordapp.com/attachments/665423320765693982/857326985372893224/tumblr_nyk3xfCrTE1s488tpo1_500.gif"] },
        aSiMismo: { texto: "**{u}** necesita un pat (｡•́︿•̀｡)", gifs: ["https://cdn.discordapp.com/attachments/665423320765693982/857326985372893224/tumblr_nyk3xfCrTE1s488tpo1_500.gif"] },
        bot: (n, u) => ({ texto: `Oh, gracias ${u} por ese pat („• ֊ •„ ) ♡\n-# ${n === 1 ? "¿A qué viene eso?" : `Me has acariciado ${n} veces ♡`}` }),
        contador: (n, u, o) => n === 1 ? "Es el primer pat entre ustedes (≧◡≦) ♡" : `${u} y ${o} se han dado ${n} pats <a:KittyPats:1343242781921116262>`,
    },
    kiss: {
        tipo: "beso",
        gif: "kiss",
        textos: ["ha besado a", "le dio un beso a", "besó dulcemente a", "besó tiernamente a", "besó a"],
        caritas: ["( •̀ ω •́ )✧", "(*/▽＼*)", "(⁄ ⁄•⁄ω⁄•⁄ ⁄)", "(//▽//)"],
        solo: { texto: "¿A quién intentas besar? (・・ ) ?\n-# Menciona a alguien (pero no te aproveches)", gifs: null },
        aSiMismo: { texto: "Eh... ¿quieres besarte a ti mismo? (・・ ) ?\n-# Creo que eso no es posible...", gifs: null },
        bot: (n, u) => ({ texto: `*Ejem*, ¿qué estás intentando hacer ${u}? (・_・;)` }),
        contador: (n, u, o) => n === 1 ? "Este beso es especial... (≧◡≦) ♡" : `${u} y ${o} se han besado ${n} veces 💋`,
    },
    dance: {
        tipo: "baile",
        gif: "dance",
        gifsDb: "Dance",
        textos: ["baila junto a", "baila al lado de", "baila con", "baila tranquilamente con"],
        caritas: ["(´｡• ᵕ •｡`)", "(´･ᴗ･ ` )", "(„• ֊ •„)", "♪ヽ(^^ヽ)♪", "♪(/_ _ )/♪"],
        solo: {
            texto: () => `**{u}** ${azar(["baila bajo la luz de la luna", "baila tranquilamente", "baila mientras disfruta la música"])} ${azar(["♪ヽ(^^ヽ)♪", "(´･ᴗ･ ` )"])}`,
            gifs: ["https://i.imgur.com/Qs9ty28.gif", "https://i.imgur.com/28zzdho.gif", "https://i.imgur.com/5ULGhAn.gif", "https://i.imgur.com/VV8f9TC.gif", "https://media1.tenor.com/m/KFHKlSp0xx4AAAAd/dancing-girl.gif"],
        },
        aSiMismo: { texto: "**{u}** baila con alguien imaginario... (｡•́︿•̀｡)", gifs: ["https://i.imgur.com/Qs9ty28.gif"] },
        bot: (n, u) => ({ texto: `Gracias ${u} por bailar conmigo („• ֊ •„ ) ♡\n-# ${n === 1 ? "Es la primera vez que bailamos" : `Hemos bailado ${n} veces ♡`}` }),
        contador: (n, u, o) => n === 1 ? "Es la primera vez que bailan (≧◡≦) ♡" : `${u} y ${o} han bailado juntos ${n} veces 🎵`,
    },
    poke: {
        tipo: "poke",
        gif: "poke",
        textos: ["picó a", "le hizo poke a", "fastidia a", "no deja en paz a"],
        caritas: ["(¬‿¬)", "( ͡° ͜ʖ ͡°)", "(￣▽￣)", "( •̀ ω •́ )✧"],
        solo: { texto: "**{u}** busca a quién fastidiar (¬‿¬)", gifs: null },
        aSiMismo: { texto: "**{u}** se picó a sí mismo... ¿estás bien? (・・ ) ?", gifs: null },
        bot: (n, u) => ({ texto: n < 3 ? `¿Sí, ${u}? (・・ ) ?` : `Ya te escuché ${u}, ya te escuché ＞﹏＜` }),
        contador: (n, u, o) => n === 1 ? "El primer poke de muchos (¬‿¬)" : `${u} y ${o} se han picado ${n} veces`,
    },
    bite: {
        tipo: "mordida",
        gif: "bite",
        textos: ["mordió a", "mordió suavemente a", "se lanzó a morder a", "muerde con desesperación a"],
        caritas: ["(＃｀д´)ﾉ", "╰（‵□′）╯", "(¬_¬\")", ".·´¯`(>▂<)´¯`·."],
        solo: { texto: "**{u}** está saboreando a alguien... (ˉ﹃ˉ)", gifs: ["https://media1.tenor.com/m/74HCjRFV_sAAAAAd/delicious-lick-lips.gif", "https://media1.tenor.com/m/Gn_7kBc6VV4AAAAd/neet-anime.gif"] },
        aSiMismo: { texto: "**{u}** está saboreando a alguien... (ˉ﹃ˉ)", gifs: ["https://media1.tenor.com/m/74HCjRFV_sAAAAAd/delicious-lick-lips.gif"] },
        bot: (n, u) => n === 1 ? { texto: "No no no, ni siquiera lo pienses ＞﹏＜", gif: "https://media1.tenor.com/m/-QSwbUkUu8cAAAAC/scared-terrified.gif" }
            : n === 2 ? { texto: "Me estás dando miedo ╯︿╰", gif: "https://media1.tenor.com/m/j04Be3CZDFUAAAAd/komi-scared.gif" }
            : { texto: `BASTA ${u} ╰（‵□′）╯\n-# Shuciika te ha dado una cachetada`, gifNekos: "slap" },
        contador: (n, u, o) => n === 1 ? "¿Y si sabe rico?" : `${u} y ${o} se han mordido ${n} veces`,
    },
    slap: {
        tipo: "bofetada",
        gif: "slap",
        textos: ["le dio una cachetada a", "le dio una bofetada épica a", "le lanzó un guantazo a", "abofeteó con drama a"],
        caritas: ["(＃｀д´)ﾉ", "╰（‵□′）╯", "(¬_¬\")", ".·´¯`(>▂<)´¯`·."],
        solo: { texto: "**{u}** tiene ganas de golpear a alguien (๑•̀ㅂ•́)و✧", gifs: ["https://media1.tenor.com/m/Ktd3wl6JEEMAAAAC/punch-anime-girl-punch.gif"] },
        aSiMismo: { texto: "**{u}** tiene ganas de golpear a alguien (๑•̀ㅂ•́)و✧", gifs: ["https://media1.tenor.com/m/Ktd3wl6JEEMAAAAC/punch-anime-girl-punch.gif"] },
        bot: (n, u) => n < 3 ? { texto: "¡¿Qué estás intentando hacer?! ＞﹏＜", gif: "https://media1.tenor.com/m/MVzw9v4ORpEAAAAC/bocchi-the-rock-bocchi.gif" }
            : { texto: `BASTA ${u} ╰（‵□′）╯\n-# Shuciika te ha dado una cachetada`, gifNekos: "slap" },
        contador: (n, u, o) => n === 1 ? "¿Por qué has hecho eso?" : `Entre ${u} y ${o} van ${n} bofetadas`,
    },
    bang: {
        tipo: "disparo",
        gif: "shoot",
        textos: ["le disparó con sus dedos a", "hizo *bang-bang* teatral a", "fingió dispararle a", "le disparó a"],
        caritas: ["(　-ω-)づ▄︻┻┳═一", "ヾ(≧へ≦)〃", "(¬_¬\")", "( •̀ ω •́ )✧"],
        solo: { texto: "**{u}** se está preparando para disparar... =.=", gifs: ["https://media1.tenor.com/m/J4nDubmJcJwAAAAd/gun-heart.gif"] },
        aSiMismo: { texto: "**{u}** se auto-disparó X﹏X", gifs: ["https://media1.tenor.com/m/0Uf0-C5vSHMAAAAd/died-of-cringe-anime.gif"] },
        bot: (n, u) => ({ texto: `**Shuciika** bloquea el disparo de ${u}`, gif: "https://media1.tenor.com/m/1PnZNio67cQAAAAd/magia-sulfur-gushing-over-magical-girls.gif" }),
        contador: (n, u, o) => n === 1 ? "¿Por qué has hecho eso?" : `Entre ${u} y ${o} van ${n} disparos`,
    },
    punch: {
        tipo: "punch",
        gif: "punch",
        textos: ["le dio un puñetazo a", "golpeó a", "le soltó un golpe a", "le lanzó un puño a"],
        caritas: ["(ง •̀_•́)ง", "(＃｀д´)ﾉ", "╰（‵□′）╯", "(๑•̀ㅂ•́)و✧"],
        solo: { texto: "**{u}** tiene ganas de golpear a alguien (๑•̀ㅂ•́)و✧", gifs: ["https://media1.tenor.com/m/Ktd3wl6JEEMAAAAC/punch-anime-girl-punch.gif"] },
        aSiMismo: { texto: "**{u}** tiene ganas de golpear a alguien (๑•̀ㅂ•́)و✧", gifs: ["https://media1.tenor.com/m/Ktd3wl6JEEMAAAAC/punch-anime-girl-punch.gif"] },
        bot: (n, u) => n < 3 ? { texto: "¡¿Qué estás intentando hacer?! ＞﹏＜", gif: "https://media1.tenor.com/m/MVzw9v4ORpEAAAAC/bocchi-the-rock-bocchi.gif" }
            : { texto: `BASTA ${u} ╰（‵□′）╯\n-# Shuciika te ha dado una cachetada`, gifNekos: "slap" },
        contador: (n, u, o) => n === 1 ? "¿Por qué has hecho eso?" : `Entre ${u} y ${o} van ${n} golpes`,
    },
}

/** Busca la acción por subcomando o por tipo (el custom_id solo trae el tipo). */
function accionPorTipo(tipo) {
    return Object.values(ACCIONES).find(a => a.tipo === tipo) || null
}

module.exports = { ACCIONES, RESPUESTAS, accionPorTipo, azar }
