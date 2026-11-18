// scripts/muestraApoyo.js
// Imprime bloques ANSI de muestra (nombre y etiqueta) para pegarlos en Discord y ver cómo quedan.
// Uso: node scripts/muestraApoyo.js ["Nombre | Apodo"] [paleta]
//      node scripts/muestraApoyo.js --todas "ShungeX | Shun"     → una muestra por paleta
const E = require("../functions/Premium/apoyoEstilo")
const { ETIQUETA } = require("../data/apoyo/mensajes")

const args = process.argv.slice(2)
const todas = args.includes("--todas")
const [nombre = "ShungeX | Shun", paletaId = E.PALETA_DEFECTO] = args.filter(a => a !== "--todas")

function muestra(paleta) {
    const g = E.degradadoSeguro(nombre, paleta.id, 64)
    const { antes, palabra, despues } = ETIQUETA.activo
    console.log(`── ${paleta.nombre} (${paleta.id}) ──`)
    console.log("Nombre:")
    console.log(g ? E.bloque(g) : `(el nombre quedó vacío tras limpiarlo: se usaría "# ${nombre}")`)
    console.log("Etiqueta:")
    console.log(`-# *\`${ETIQUETA.clave}\`*\n` + E.bloque(antes + E.degradadoSeguro(palabra, paleta.id) + despues))
    console.log("")
}

const lista = todas ? E.PALETAS : [E.paletaPorId(paletaId)]
lista.forEach(muestra)
console.log("-# Copia desde ```ansi hasta el cierre ``` y pégalo en Discord (escritorio). En móvil no está verificado.")
