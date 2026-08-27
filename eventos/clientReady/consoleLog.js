const { ActivityType } = require("discord.js")
const configV = require(`../../config`)

module.exports = (client) => {
    console.log(`Bienvenido Asrii, soy \x1b[35m${client.user.tag}\x1b[0m`)

    const presenceFinal = () => {
        client.user.setPresence({
            status: "online",
            activities: [{ name: `¡Hola! (✿ •̀ ω •́ )✧`, type: ActivityType.Listening }],
        });
        setInterval(() => {
            console.log(`[Memoria] RSS=${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB Usado`)

            const status2 = [
                "Aprendiendo nuevas cosas ヾ(•ω•`✿)o" + `${configV.version}`,
                `Vigilando el servidor (￢_￢;) || Version: ${configV.version} `,
                `Practicando magia (ﾉ≧∀≦)ﾉ━★ || Version: ${configV.version} (￣▽￣)/✿ `,
                "¿Que son las redes sociales? |･ω･)✿",
                "¡Feliz! ＼(＾▽＾)／✿",
                "Limpiando mi gorrito (￣▽￣)✿",
                "Viendo anime |･ω･)✿",
                "Durmiendo... (✿ －.－)...zzz",
                "Jugando Renshin Yinpak... 🎮ヾ(•ω•`✿)o",
                "Wiiiiiiiii ✿ (￣▽￣)~*",
                "Mejorando mis habilidades (✿ •̀ ω •́ )✧",
                "Te veo |･ω･)✿"
            ];
            const typer = [`LISTENING`, `PLAYING`, "STREAMING", "WATCHING"]
            const typerandom = typer[Math.floor(Math.random() * typer.length)]
            const statusrandom = status2[Math.floor(Math.random() * status2.length)]

            function Presence() {
                client.user.setPresence({
                    status: "online",
                    activities: [{ name: statusrandom, type: ActivityType[typerandom], url: "https://www.youtube.com/watch?v=FyG21rXCxlY" }],
                });


            }

            Presence();
        }, 60000);;
    }

    if(client.listo) {
        presenceFinal();
    }else {
        client.once('cargaCompleta', presenceFinal);
    }

};