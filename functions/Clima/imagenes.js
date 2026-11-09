// ═══ CLIMA-HORARIO: imágenes del noticiero ═══
// Misma lógica que Hora_rol.js: cloudinary.search en folder:Rol/Clima/{Día|Noche}/{Estado}/{Fase}
// y una al azar. El resultado se cachea por carpeta para no llamar a la API en cada refresco.

const cloudinary = require("cloudinary").v2;

const cache = new Map();   // carpeta → { urls, expira }
const ERROR_TTL_MS = 5 * 60 * 1000;

let buscador = async (carpeta) => {
    const { resources } = await cloudinary.search
        .expression(`folder:${carpeta}`)
        .sort_by("public_id", "desc")
        .max_results(100)
        .execute();
    return (resources || []).map((r) => r.secure_url).filter(Boolean);
};

/** Para tests: reemplaza la búsqueda en Cloudinary. */
function usarBuscador(fn) { buscador = fn; cache.clear(); }
function limpiarCacheImagenes() { cache.clear(); }

const rutaCarpeta = (carpetaLuz, estado, fase) => `Rol/Clima/${carpetaLuz}/${estado}/${fase}`;

/**
 * @returns {Promise<string>} URL de una imagen de la carpeta, o CONFIG.imagenPorDefecto
 */
async function obtenerImagen(carpetaLuz, estado, fase, CONFIG) {
    const carpeta = rutaCarpeta(carpetaLuz, estado, fase);
    const ttl = Math.max(60, CONFIG.imagenesCacheMin || 60) * 60 * 1000;   // mínimo 1 h
    let entrada = cache.get(carpeta);

    if (!entrada || entrada.expira <= Date.now()) {
        try {
            const urls = await buscador(carpeta);
            entrada = { urls, expira: Date.now() + ttl };
        } catch (err) {
            console.warn(`[Clima] No se pudo buscar imágenes en ${carpeta}:`, err?.message || err);
            entrada = { urls: entrada?.urls || [], expira: Date.now() + ERROR_TTL_MS };
        }
        cache.set(carpeta, entrada);
    }

    if (!entrada.urls.length) return CONFIG.imagenPorDefecto;
    return entrada.urls[Math.floor(Math.random() * entrada.urls.length)];
}

module.exports = { obtenerImagen, rutaCarpeta, usarBuscador, limpiarCacheImagenes };
