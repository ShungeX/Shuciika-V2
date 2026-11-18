// config/accesoComandos.js
// Acceso restringido a comandos y marca T0 (pre-lanzamiento), editables desde el dashboard
// (Configuración del servidor → Acceso a comandos). Se guarda en Server_db.config, _id: "comandos":
//
//   {
//     _id: "comandos",
//     categorias: {
//       rol: {                       // categoría = comando de barra (/rol, /utilidad, /interact...)
//         bloqueado: true,           // nadie fuera de la lista puede usar /rol ni sus sub-comandos
//         t0: false,                 // todos sus sub-comandos cuentan como T0
//         usuarios: ["123..."],      // IDs con acceso a toda la categoría
//         comandos: {
//           perfil: { bloqueado: true, t0: true, usuarios: ["456..."] }   // sub-comando (o "grupo sub")
//         }
//       }
//     }
//   }
//
// Reglas:
//  - El creador siempre tiene acceso.
//  - Si la categoría o el sub-comando están bloqueados, solo entra quien esté en la lista de la
//    categoría o en la del sub-comando. Estar en la lista de la categoría da acceso a todos sus
//    sub-comandos; estar en la de un sub-comando solo da acceso a ese.
//  - T0 es solo un indicador: no restringe nada. Un sub-comando es T0 si lo es él o su categoría.
//    El handler lo deja en interaction.t0 para que cada comando decida qué hacer distinto.

const CREADOR = "665421882694041630";
const RE_ID = /^\d{17,20}$/;
const RE_NOMBRE = /^[-_\p{L}\p{N}]{1,32}$/u;
const RE_SUB = /^[-_\p{L}\p{N}]{1,32}( [-_\p{L}\p{N}]{1,32})?$/u;   // "sub" o "grupo sub"
const MAX_USUARIOS = 100;

let estado = { categorias: {} };

function sanearUsuarios(lista) {
    if (!Array.isArray(lista)) return [];
    const ids = [];
    for (const v of lista) {
        const id = String(v ?? "").trim();
        if (RE_ID.test(id) && id !== CREADOR && !ids.includes(id)) ids.push(id);
        if (ids.length >= MAX_USUARIOS) break;
    }
    return ids;
}

// Devuelve la regla limpia, o null si no aporta nada (sin bloqueo, sin T0 y sin usuarios)
function sanearRegla(regla) {
    if (!regla || typeof regla !== "object") return null;
    const limpia = {
        bloqueado: regla.bloqueado === true,
        t0: regla.t0 === true,
        usuarios: sanearUsuarios(regla.usuarios)
    };
    return limpia.bloqueado || limpia.t0 || limpia.usuarios.length ? limpia : null;
}

/** Normaliza lo que llega del dashboard o de la base de datos. Nunca lanza. */
function sanear(doc) {
    const categorias = {};
    const origen = doc && typeof doc.categorias === "object" && doc.categorias ? doc.categorias : {};
    for (const [nombre, cat] of Object.entries(origen)) {
        if (!RE_NOMBRE.test(nombre) || !cat || typeof cat !== "object") continue;
        const base = sanearRegla(cat) || { bloqueado: false, t0: false, usuarios: [] };
        const comandos = {};
        if (cat.comandos && typeof cat.comandos === "object") {
            for (const [sub, regla] of Object.entries(cat.comandos)) {
                if (!RE_SUB.test(sub)) continue;
                const limpia = sanearRegla(regla);
                if (limpia) comandos[sub] = limpia;
            }
        }
        if (base.bloqueado || base.t0 || base.usuarios.length || Object.keys(comandos).length) {
            categorias[nombre] = { ...base, comandos };
        }
    }
    return { categorias };
}

async function cargarDesdeDB(dbClient) {
    if (!dbClient) return;
    try {
        const doc = await dbClient.db("Server_db").collection("config").findOne({ _id: "comandos" });
        estado = sanear(doc);
    } catch (error) {
        console.error("⚠️ [AccesoComandos] No se pudo cargar el acceso a comandos; queda todo abierto:", error.message);
    }
}

/** Reemplaza el estado en memoria (el dashboard llama aquí después de guardar). */
function refrescar(doc) {
    estado = sanear(doc);
    console.log("🔄 [AccesoComandos] Acceso a comandos actualizado en tiempo real.");
}

function reglas(categoria, sub) {
    const cat = estado.categorias[categoria] || null;
    const cmd = cat && sub ? cat.comandos[sub] || null : null;
    return { cat, cmd };
}

/** ¿Está restringido (por la categoría o por el propio sub-comando)? */
function estaBloqueado(categoria, sub) {
    const { cat, cmd } = reglas(categoria, sub);
    return Boolean(cat?.bloqueado || cmd?.bloqueado);
}

/** ¿Puede este usuario usar /categoria sub? */
function puedeUsar(userId, categoria, sub) {
    if (!estaBloqueado(categoria, sub)) return true;
    const id = String(userId ?? "");
    if (id === CREADOR) return true;
    const { cat, cmd } = reglas(categoria, sub);
    return Boolean(cat?.usuarios.includes(id) || cmd?.usuarios.includes(id));
}

/** ¿Es un comando T0 (pre-lanzamiento)? */
function esT0(categoria, sub) {
    const { cat, cmd } = reglas(categoria, sub);
    return Boolean(cat?.t0 || cmd?.t0);
}

/** Clave del sub-comando de una interacción: "sub", "grupo sub" o null si no tiene. */
function claveSubcomando(interaction) {
    const sub = interaction.options?.getSubcommand?.(false) || null;
    const grupo = interaction.options?.getSubcommandGroup?.(false) || null;
    return sub ? (grupo ? `${grupo} ${sub}` : sub) : null;
}

module.exports = {
    CREADOR,
    sanear,
    cargarDesdeDB,
    refrescar,
    estaBloqueado,
    puedeUsar,
    esT0,
    claveSubcomando,
    get estado() { return estado; }
};
