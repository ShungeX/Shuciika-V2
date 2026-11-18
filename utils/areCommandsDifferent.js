// Compara un comando registrado en Discord (ApplicationCommand de discord.js, en
// camelCase) con su versión local (toJSON del builder, en snake_case).
//
// Antes solo se miraba el primer nivel de opciones (los subcomandos), así que un
// cambio DENTRO de un subcomando (p. ej. quitar max_value o activar autocomplete)
// nunca se subía a Discord. Ahora se compara todo el árbol de opciones.

const pick = (o, camel, snake) => o?.[camel] ?? o?.[snake] ?? null

// Discord guarda los textos sin el selector de variación U+FE0F (el que acompaña a emojis como
// "🏙️" o "⁉️") y sin espacios en los extremos. Si se compara el texto tal cual, el comando
// parece distinto en cada arranque aunque no haya cambiado nada, y se vuelve a subir siempre.
const texto = (t) => String(t ?? "").replace(/️/g, "").trim()

function normalizarChoices(choices) {
  if (!choices?.length) return []
  return choices.map(c => ({ name: texto(c.name), value: c.value }))
}

function normalizarOpcion(o) {
  return {
    type: o.type,
    name: o.name,
    description: texto(o.description),
    required: !!o.required,
    autocomplete: !!o.autocomplete,
    min_value: pick(o, "minValue", "min_value"),
    max_value: pick(o, "maxValue", "max_value"),
    min_length: pick(o, "minLength", "min_length"),
    max_length: pick(o, "maxLength", "max_length"),
    channel_types: [...(pick(o, "channelTypes", "channel_types") || [])].sort(),
    choices: normalizarChoices(o.choices),
    options: (o.options || []).map(normalizarOpcion),
  }
}

module.exports = (existingCommand, localCommand) => {
  if (texto(existingCommand.description) !== texto(localCommand.description)) return true

  const existentes = JSON.stringify((existingCommand.options || []).map(normalizarOpcion))
  const locales = JSON.stringify((localCommand.options || []).map(normalizarOpcion))

  if (existentes !== locales) {
    console.log(`🔎 Opciones distintas en "${localCommand.name}", se actualizará`)
    return true
  }
  return false
}
