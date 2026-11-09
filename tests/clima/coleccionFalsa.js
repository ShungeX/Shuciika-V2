// Colección en memoria con lo justo del driver de MongoDB que usa estadoRegion.js:
// findOne, updateOne (upsert, $setOnInsert, $set, $inc), findOneAndUpdate ($set, $push {$each, $slice}).

const leer = (obj, ruta) => ruta.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
function escribir(obj, ruta, valor) {
    const partes = ruta.split(".");
    let o = obj;
    for (const k of partes.slice(0, -1)) {
        if (o[k] == null || typeof o[k] !== "object") o[k] = {};
        o = o[k];
    }
    o[partes[partes.length - 1]] = valor;
}
const igual = (a, b) => (a instanceof Date || b instanceof Date ? new Date(a).getTime() === new Date(b).getTime() : a === b);

function coincide(doc, filtro) {
    return Object.entries(filtro).every(([ruta, cond]) => {
        const v = leer(doc, ruta);
        if (cond && typeof cond === "object" && !(cond instanceof Date) && "$exists" in cond) return (v !== undefined) === cond.$exists;
        return igual(v, cond);
    });
}

function aplicar(doc, update, insertando) {
    if (insertando && update.$setOnInsert) for (const [r, v] of Object.entries(update.$setOnInsert)) escribir(doc, r, structuredClone(v));
    for (const [r, v] of Object.entries(update.$set || {})) escribir(doc, r, structuredClone(v));
    for (const [r, v] of Object.entries(update.$inc || {})) escribir(doc, r, (leer(doc, r) || 0) + v);
    for (const [r, v] of Object.entries(update.$push || {})) {
        if (v && typeof v === "object" && "$slice" in v && !("$each" in v)) throw new Error("$slice requiere $each");
        const lista = [...(leer(doc, r) || []), ...structuredClone(v.$each || [v])];
        escribir(doc, r, v.$slice !== undefined ? lista.slice(v.$slice) : lista);
    }
}

class ColeccionFalsa {
    constructor() { this.docs = new Map(); this.escrituras = 0; }
    async findOne(filtro) {
        for (const d of this.docs.values()) if (coincide(d, filtro)) return structuredClone(d);
        return null;
    }
    async updateOne(filtro, update, opciones = {}) {
        this.escrituras++;
        for (const d of this.docs.values()) {
            if (coincide(d, filtro)) { aplicar(d, update, false); return { matchedCount: 1 }; }
        }
        if (opciones.upsert) {
            const nuevo = { _id: filtro._id };
            aplicar(nuevo, update, true);
            this.docs.set(nuevo._id, nuevo);
            return { matchedCount: 0, upsertedCount: 1 };
        }
        return { matchedCount: 0 };
    }
    async findOneAndUpdate(filtro, update) {
        this.escrituras++;
        for (const d of this.docs.values()) {
            if (coincide(d, filtro)) { aplicar(d, update, false); return structuredClone(d); }
        }
        return null;
    }
}

module.exports = { ColeccionFalsa };
