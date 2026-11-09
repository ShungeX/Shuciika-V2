// Revisa functions/Clima/climaTextos.json.
//   npm run validar-textos
// Errores (exit 1): títulos vacíos, frases vacías, colores sin formato #rrggbb, combinaciones que faltan.
// Avisos: combinaciones estado × fase sin frases (TODO) y frases idénticas entre estados distintos.

const { ESTADOS, FASES } = require("../functions/Clima/config");

function validarTextos(textos, { estados = ESTADOS, fases = FASES } = {}) {
    const r = { faltantes: [], sinFrases: [], titulosVacios: [], frasesVacias: [], coloresMal: [], repetidas: [], todos: [] };
    const donde = new Map();   // frase → Set de "Estado/Fase"

    for (const e of estados) {
        for (const f of fases) {
            const clave = `${e}/${f}`;
            const ent = textos.estados?.[e]?.[f];
            if (!ent) { r.faltantes.push(clave); continue; }
            if (!String(ent.titulo || "").trim()) r.titulosVacios.push(clave);
            const frases = Array.isArray(ent.frases) ? ent.frases : [];
            if (frases.some((x) => typeof x !== "string" || !x.trim())) r.frasesVacias.push(clave);
            if (!frases.some((x) => typeof x === "string" && x.trim())) r.sinFrases.push(clave);
            if (!/^#[0-9a-f]{6}$/i.test(ent.color || "")) r.coloresMal.push(`${clave} (${JSON.stringify(ent.color ?? null)})`);
            if (ent.todo) r.todos.push(`${clave}: ${ent.todo}`);
            for (const x of frases) {
                if (typeof x !== "string" || !x.trim()) continue;
                if (!donde.has(x)) donde.set(x, new Set());
                donde.get(x).add(clave);
            }
        }
    }
    for (const [frase, lugares] of donde) {
        const estadosDistintos = new Set([...lugares].map((l) => l.split("/")[0]));
        if (estadosDistintos.size > 1) r.repetidas.push({ frase, lugares: [...lugares] });
    }
    return r;
}

module.exports = { validarTextos };

if (require.main === module) {
    const textos = require("../functions/Clima/climaTextos.json");
    const r = validarTextos(textos);
    const seccion = (titulo, lista, icono) => {
        if (!lista.length) return;
        console.log(`\n${icono} ${titulo} (${lista.length})`);
        for (const x of lista) console.log(`   - ${typeof x === "string" ? x : `"${x.frase}" → ${x.lugares.join(", ")}`}`);
    };
    console.log("Validación de climaTextos.json");
    seccion("Combinaciones que faltan", r.faltantes, "✖");
    seccion("Títulos vacíos", r.titulosVacios, "✖");
    seccion("Frases vacías", r.frasesVacias, "✖");
    seccion("Colores sin formato #rrggbb", r.coloresMal, "✖");
    seccion("TODO: combinaciones sin frases (usan genericos)", r.sinFrases, "⚠");
    seccion("Notas TODO", r.todos, "📝");
    seccion("Frases idénticas en estados distintos (¿copy-paste?)", r.repetidas, "⚠");
    const errores = r.faltantes.length + r.titulosVacios.length + r.frasesVacias.length + r.coloresMal.length;
    console.log(`\n${errores ? `✖ ${errores} error(es)` : "✓ Sin errores"} · ⚠ ${r.sinFrases.length} sin frases · ⚠ ${r.repetidas.length} repetidas`);
    process.exitCode = errores ? 1 : 0;
}
