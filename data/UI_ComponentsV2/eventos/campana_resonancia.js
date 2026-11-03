const { crearCustomId } = require("../../../utils/constructores/customId");

[
    {
        "type": 17,
        "accent_color": 14862591,
        "spoiler": false,
        "components": [
            {
                "type": 10,
                "content": "# Campana de Resonancia"
            },
            {
                "type": 10,
                "content": "En el corazón del Instituto, bajo la cúpula, descansa la Campana de Resonancia. Nadie recuerda quién la forjó. Cada mañana alguien le quita el polvo con un paño de lino y nadie la toca sin motivo. Dicen que cada alma suena distinta."
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 12,
                "items": [
                    {
                        "media": {
                            "url": "https://i.pinimg.com/736x/b3/b8/10/b3b8108392c62d3c156e244fc44da59d.jpg",
                            "proxy_url": "https://i.pinimg.com/736x/b3/b8/10/b3b8108392c62d3c156e244fc44da59d.jpg"
                        },
                        "description": null,
                        "spoiler": false
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
                        "style": 2,
                        "label": "Tocar la campana",
                        "emoji": null,
                        "disabled": false,
                        "custom_id": crearCustomId({
                            action: "evento",
                            extras: ["campana_resonancia", "tocar"]                            
                        })
                    },
                    {
                        "type": 2,
                        "style": 2,
                        "label": "Observar",
                        "emoji": null,
                        "disabled": false,
                        "custom_id": crearCustomId({
                            action: "evento",
                            extras: ["campana_resonancia", "observar"]                            
                        })
                    }
                ]
            }
        ]
    }
]