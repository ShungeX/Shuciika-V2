# ⚡ Funciones de Continuidad de Evento (Dialogue Hooks) — Nix World

Esta carpeta alberga todas las funciones de backend que se ejecutan como **continuidad o desenlace** de los eventos de diálogo creados en el Dashboard (`#admin-dialogos`).

---

## 🎯 Propósito y Filosofía
* **El Dashboard gestiona la Narrativa:** Textos, embeds, elecciones, ramificaciones y acumulación de variables temporales (`userData.context`).
* **Esta carpeta gestiona las Mecánicas de Juego:** Mutaciones complejas en MongoDB (`Soul`, `Personajes`, `Hechizos_globales`), cálculos matemáticos o aleatorios (`Math.random()`), asignación de roles de Discord y renderizado de componentes avanzados como `ComponentsV2`.

---

## 📁 ¿Cómo crear un nuevo Hook?

Crea un archivo `.js` dentro de esta carpeta (por ejemplo, `mi_evento.js`). Cada archivo debe exportar un objeto (o un array de objetos) con la siguiente estructura:

```javascript
module.exports = {
    // 1. Identificador único que se guardará en el diálogo (snake_case)
    id: "mi_evento_hook",

    // 2. Nombre que aparecerá en el menú desplegable del Dashboard
    nombre: "Mi Evento — Resolución Final",

    // 3. Explicación corta visible para los administradores en el Dashboard
    descripcion: "Calcula los puntos de decisión, actualiza la base de datos y entrega las recompensas.",

    /**
     * Función asíncrona que se ejecuta cuando el diálogo llega a su final (o paso clave).
     * 
     * @param {Object} params
     * @param {import('discord.js').Client} params.client - Cliente de Discord.
     * @param {import('discord.js').ChatInputCommandInteraction} params.interaction - Interacción de Discord (si existe).
     * @param {Object} params.context - Maletín con todas las variables acumuladas durante los pasos ({ resonancia, camino, ... }).
     * @param {import('discord.js').User} params.user - Usuario de Discord ejecutor.
     * @param {Object} params.charDoc - Documento completo del personaje activo en MongoDB (Rol_db.Personajes).
     * @param {Object} params.dialogueSystem - Instancia de DialogueSystem (dialogoManager).
     */
    ejecutar: async function ({ client, interaction, context, user, charDoc, dialogueSystem }) {
        console.log(`[Hook: mi_evento_hook] Ejecutando para ${user?.username} (ID: ${user?.id})`);

        // 1. Leer las variables acumuladas en los pasos del diálogo
        const { puntos_ganados = 0, eleccion_final = "neutral" } = context;

        // 2. Ejecutar lógica en MongoDB
        const clientdb = require('../../../Server');
        const dbRol = clientdb.db("Rol_db");
        // await dbRol.collection("Soul").updateOne(...);

        // 3. Opcional: Enviar mensaje de confirmación o ComponentsV2
        if (interaction) {
            await interaction.followUp({ content: "¡El evento ha concluido y tus decisiones han sido selladas!", flags: ["Ephemeral"] });
        }
    }
};
```

---

## 🔍 Descubrimiento y Verificación Automática
Al reiniciar el bot o guardar en esta carpeta, el sistema:
1. Lee automáticamente todos los archivos `.js` de este directorio.
2. Los expone en la API interna (`GET /api/admin/dialogos/hooks`).
3. El **Dashboard de Diálogos** los muestra automáticamente en la lista desplegable de *Hook al Finalizar (`onComplete`)*.
4. Si un administrador selecciona este hook, el dashboard mostrará un distintivo de `✅ Verificado en Backend` con la descripción que definiste aquí.
