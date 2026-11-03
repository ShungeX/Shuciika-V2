// data/economia/limpieza.js
// Datos del minijuego de limpieza: agentes, tipos de mancha y salas.
// Cada mancha tiene un agente perfecto (1 punto), uno parcial (0.5) y los otros dos son inútiles.
// Para que toda sala sea resoluble, cada agente debe ser el perfecto de al menos una mancha.

const AGENTES = {
    disolvente: { nombre: "Disolvente Arcano", corto: "Disolvente", emoji: "🧪" },
    purificacion: { nombre: "Hechizo de Purificación", corto: "Purificación", emoji: "✨" },
    escoba: { nombre: "Escoba Encantada", corto: "Escoba", emoji: "🧹" },
    recipiente: { nombre: "Recipiente de Contención", corto: "Recipiente", emoji: "🫙" },
}

const MANCHAS = {
    // Disolvente: lo pegajoso
    moco_duende: { nombre: "Moco de Duende", pista: "pegajosa y verde", perfecto: "disolvente", parcial: "purificacion" },
    chicle_encantado: { nombre: "Chicle Encantado", pista: "pegajoso y se estira solo", perfecto: "disolvente", parcial: "escoba" },
    pegamento_hada: { nombre: "Pegamento de Hada", pista: "pegajoso y centelleante", perfecto: "disolvente", parcial: "purificacion" },
    baba_libro: { nombre: "Baba de Libro Volador", pista: "viscosa, huele a papel viejo", perfecto: "disolvente", parcial: "recipiente" },

    // Recipiente: lo que se escapa o es inestable
    polvo_estrellas: { nombre: "Polvo de Estrellas Fugaces", pista: "brillante, volátil", perfecto: "recipiente", parcial: "escoba" },
    cristal_mana: { nombre: "Cristal de Maná Derretido", pista: "charco de energía inestable", perfecto: "recipiente", parcial: "disolvente" },
    niebla_suenos: { nombre: "Niebla de Sueños Ajenos", pista: "neblina tibia que se escapa", perfecto: "recipiente", parcial: "purificacion" },

    // Purificación: lo maldito, ácido u oscuro
    pocion_burbujeante: { nombre: "Mancha de Poción Burbujeante", pista: "ácida, humeante", perfecto: "purificacion", parcial: "disolvente" },
    telarana_sombra: { nombre: "Telaraña de Sombra", pista: "oscura y fría", perfecto: "purificacion", parcial: "escoba" },
    huellas_fantasma: { nombre: "Huellas de Fantasma Gruñón", pista: "heladas y quejumbrosas", perfecto: "purificacion", parcial: "recipiente" },

    // Escoba: lo sólido y suelto
    runas_rotas: { nombre: "Restos de Runas Rotas", pista: "fragmentos sólidos", perfecto: "escoba", parcial: "recipiente" },
    cenizas_fatuo: { nombre: "Cenizas de Fuego Fatuo", pista: "partículas incandescentes", perfecto: "escoba", parcial: "recipiente" },
    plumas_dragon: { nombre: "Plumas de Dragón Adolescente", pista: "montones ligeros y chamuscados", perfecto: "escoba", parcial: "disolvente" },
}

const SALAS = ["Aula de Pociones", "Biblioteca Prohibida", "Comedor Estelar", "Torre de Astronomía", "Invernadero Encantado", "Baño del Tercer Piso"]

// Pista gratuita del tutorial
const PISTA_TUTORIAL = "Lo pegajoso se disuelve."

module.exports = { AGENTES, MANCHAS, SALAS, PISTA_TUTORIAL }
