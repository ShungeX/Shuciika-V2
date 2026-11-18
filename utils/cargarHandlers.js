const getAllFiles = require('./getAllFiles');

/**
 * Crea un cargador de handlers (botones, menús, modales) que lee la carpeta UNA sola vez.
 * Antes cada interacción recorría el disco entero (readdir de todas las subcarpetas) solo para
 * volver a obtener los mismos módulos que require ya tenía en memoria.
 * Los archivos que fallan al cargar (p. ej. porque necesitan el gremio y el bot aún no estaba listo)
 * se reintentan en la siguiente llamada; los que cargaron bien no se vuelven a tocar.
 *
 * @param {string} directorio carpeta a recorrer (recursivo)
 * @param {string} etiqueta   nombre para el mensaje de error ("botón", "modal"...)
 */
module.exports = function crearCargador(directorio, etiqueta) {
    let cargados = null;     // handlers ya cargados
    let pendientes = [];     // rutas que fallaron y se reintentan

    return (exceptions = []) => {
        if (cargados === null) {
            cargados = [];
            pendientes = getAllFiles(directorio, false).filter((archivo) => archivo.endsWith('.js'));
        }

        if (pendientes.length) {
            const fallidos = [];
            for (const archivo of pendientes) {
                try {
                    cargados.push(require(archivo));
                } catch (err) {
                    console.error(`⚠️ Error al cargar ${etiqueta} desde '${archivo}':`, err.message);
                    fallidos.push(archivo);
                }
            }
            pendientes = fallidos;
        }

        if (!exceptions.length) return cargados;
        return cargados.filter((h) => !exceptions.includes(h.name) && !exceptions.includes(h.customId));
    };
};
