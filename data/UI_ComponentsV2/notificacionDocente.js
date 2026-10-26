const notificacionDocente30Minutos = [
    {
        "type": 17,
        "accent_color": null,
        "spoiler": false,
        "components": [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": "https://i.pinimg.com/736x/d1/42/45/d14245a2294f69bad6bef67740496610.jpg",
                        "proxy_url": "https://i.pinimg.com/736x/d1/42/45/d14245a2294f69bad6bef67740496610.jpg"
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": "# Docente su clase esta por comenzar"
                    },
                    {
                        "type": 10,
                        "content": "<docente>, **{Título de la clase}** empieza <t:TIMESTAMP:R>\nTus alumnos te esperan en {#salon}. Hay {N} inscritos."
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            }
        ]
    }
];

const notificacionAsistenciaDocente = [
    {
        "type": 17,
        "accent_color": null,
        "spoiler": false,
        "components": [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": "https://i.pinimg.com/736x/d1/42/45/d14245a2294f69bad6bef67740496610.jpg",
                        "proxy_url": "https://i.pinimg.com/736x/d1/42/45/d14245a2294f69bad6bef67740496610.jpg"
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": "# Docente su clase ha comenzado"
                    },
                    {
                        "type": 10,
                        "content": "<@docente>, tus alumnos te esperan en {#salon} para **{Título de la clase}**.\nConfirma tu asistencia antes de <t:LIMITE:t> (<t:LIMITE:R>) para abrir la clase."
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 1,
                "components": [
                    {
                        "type": 2,
                        "style": 3,
                        "label": "Confirmar asistencia",
                        "emoji": null,
                        "disabled": false,
                        "custom_id": "8d1ca6755b35454989ac1544796081f5"
                    },
                    {
                        "type": 2,
                        "style": 5,
                        "label": "Ir al salon",
                        "emoji": null,
                        "disabled": false,
                        "url": "https://google.com"
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 10,
                "content": "-# Si no llegas a tiempo, la clase se cerrará y se descontarán {X} Lumens para compensar a tus alumnos ♡( ◡‿◡ )"
            }
        ]
    }
];

const mensajeDocenteEnCurso = [
    {
        "type": 17,
        "accent_color": null,
        "spoiler": false,
        "components": [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": "https://i.pinimg.com/736x/d1/42/45/d14245a2294f69bad6bef67740496610.jpg",
                        "proxy_url": "https://i.pinimg.com/736x/d1/42/45/d14245a2294f69bad6bef67740496610.jpg"
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": "# Tu clase está en curso"
                    },
                    {
                        "type": 10,
                        "content": "**{Título de la clase}** comenzó <t:INICIO:R>.\nCuando termines, puedes cerrarla desde aquí.\n\n\nSi tienes prisa para acabar la clase puedes hacerlo en cualquier momento. Considera que la paga se realizara de acuerdo a la cantidad de clase impartida y factores estadísticos de la clase"
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 1,
                "components": [
                    {
                        "type": 2,
                        "style": 4,
                        "label": "Terminar clase",
                        "emoji": null,
                        "disabled": false,
                        "custom_id": "8d1ca6755b35454989ac1544796081f5"
                    },
                    {
                        "type": 2,
                        "style": 5,
                        "label": "Ir al salon",
                        "emoji": null,
                        "disabled": false,
                        "url": "https://google.com"
                    }
                ]
            }
        ]
    }
]

module.exports = {
    notificacionDocente30Minutos,
    notificacionAsistenciaDocente,
    mensajeDocenteEnCurso,
    generarPayloadDocente30,
    generarPayloadAsistenciaDocente,
    generarPayloadDocenteEnCurso,
    generarPayloadDocenteFinalizada
};

function generarPayloadDocente30(clase) {
    if (!notificacionDocente30Minutos) return null;
    const root = JSON.parse(JSON.stringify(notificacionDocente30Minutos));
    const inicioSec = Math.floor(new Date(clase.inicioProgramado).getTime() / 1000);
    const numInscritos = Array.isArray(clase.inscritos) ? clase.inscritos.length : 0;

    try {
        const textComp = root[0].components[0].components[1];
        textComp.content = textComp.content
            .replace('<docente>', `<@${clase.profesorUserId}>`)
            .replace('{Título de la clase}', clase.titulo || 'Clase')
            .replace('TIMESTAMP', String(inicioSec))
            .replace('{#salon}', `<#${clase.salonId}>`)
            .replace('{N}', String(numInscritos));
    } catch (err) {
        console.error("[notificacionDocente] Error formateando notificacionDocente30:", err.message);
    }

    return root;
}

function generarPayloadAsistenciaDocente(clase, xLumens, customId, salonUrl) {
    if (!notificacionAsistenciaDocente) return null;
    const root = JSON.parse(JSON.stringify(notificacionAsistenciaDocente));
    const limiteSec = Math.floor((new Date(clase.inicioProgramado).getTime() + 15 * 60 * 1000) / 1000);

    try {
        const textComp = root[0].components[0].components[1];
        textComp.content = textComp.content
            .replace('<@docente>', `<@${clase.profesorUserId}>`)
            .replace('{#salon}', `<#${clase.salonId}>`)
            .replace('{Título de la clase}', clase.titulo || 'Clase')
            .replace(/LIMITE/g, String(limiteSec));

        const botones = root[0].components[2]?.components;
        if (Array.isArray(botones)) {
            if (botones[0]) botones[0].custom_id = customId;
            if (botones[1] && salonUrl) botones[1].url = salonUrl;
        }

        const footerComp = root[0].components[4];
        if (footerComp) {
            footerComp.content = footerComp.content.replace('{X}', String(xLumens));
        }
    } catch (err) {
        console.error("[notificacionDocente] Error formateando notificacionAsistenciaDocente:", err.message);
    }

    return root;
}

function generarPayloadDocenteEnCurso(clase, customIdTerminar, salonUrl) {
    if (!mensajeDocenteEnCurso) return null;
    const root = JSON.parse(JSON.stringify(mensajeDocenteEnCurso));
    const inicioSec = Math.floor(new Date(clase.inicioReal || clase.inicioProgramado || Date.now()).getTime() / 1000);

    try {
        const textComp = root[0].components[0].components[1];
        if (textComp) {
            textComp.content = textComp.content
                .replace('{Título de la clase}', clase.titulo || 'Clase')
                .replace('INICIO', String(inicioSec));
        }

        const botones = root[0].components[2]?.components;
        if (Array.isArray(botones)) {
            if (botones[0]) {
                botones[0].custom_id = customIdTerminar;
            }
            if (botones[1] && salonUrl) {
                botones[1].url = salonUrl;
            }
        }
    } catch (err) {
        console.error("[notificacionDocente] Error formateando mensajeDocenteEnCurso:", err.message);
    }

    return root;
}

function generarPayloadDocenteFinalizada(clase, duracionMin, pagoTotal, salonUrl, extraInfo = {}) {
    if (!mensajeDocenteEnCurso) return null;
    const root = JSON.parse(JSON.stringify(mensajeDocenteEnCurso));
    try {
        const headerComp = root[0].components[0].components[0];
        if (headerComp) {
            headerComp.content = extraInfo.invalida ? "# Clase Concluida (Inválida)" : "# Tu clase ha finalizado";
        }

        const textComp = root[0].components[0].components[1];
        if (textComp) {
            let detalleTexto = `**${clase.titulo || 'Clase'}** ha concluido.\n\n` +
                `⏱️ **Duración impartida:** ${duracionMin} minutos (${extraInfo.totalVentanas || Math.ceil(duracionMin / 5)} ventanas)\n` +
                `👥 **Alumnos con participación válida:** ${extraInfo.totalAlumnosValidos ?? (Array.isArray(clase.inscritos) ? clase.inscritos.length : 0)}\n` +
                `💰 **Pago recibido:** ${pagoTotal} Lumens\n`;

            if (extraInfo.invalida && extraInfo.razonInvalida) {
                detalleTexto += `\n⚠️ *Clase registrada como inválida: ${extraInfo.razonInvalida}. No se procesó pago al docente.*`;
            } else {
                detalleTexto += `\n*El salón ha sido liberado y los alumnos válidos han recibido sus recompensas.*`;
            }

            textComp.content = detalleTexto;
        }

        const botones = root[0].components[2]?.components;
        if (Array.isArray(botones)) {
            if (botones[0]) {
                botones[0].disabled = true;
                botones[0].label = extraInfo.invalida ? "Clase Inválida ⚠️" : "Clase Concluida ✓";
                botones[0].style = 2; // Secondary / gris
            }
            if (botones[1] && salonUrl) {
                botones[1].url = salonUrl;
            }
        }
    } catch (err) {
        console.error("[notificacionDocente] Error formateando mensajeDocenteFinalizada:", err.message);
    }

    return root;
}
