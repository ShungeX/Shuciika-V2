function formatearTextoLim(texto, limite) {
    function truncarTexto(texto, limite) {
        if (texto.length <= limite) return texto;
        return texto.slice(0, limite - 3).trimEnd() + "...";
      }

    function cerrarMarkdown(texto) {
        const negritas = (texto.match(/\*\*/g) || []).length;
        const cursivas = (texto.match(/\*/g) || []).length - negritas * 2;
        const subrayado = (texto.match(/__/g) || []).length;
        const guionbajo = (texto.match(/_/g) || []).length - subrayado * 2;
        let resultado = texto;
      
        if (negritas % 2 !== 0) resultado += "**";
        if (cursivas % 2 !== 0) resultado += "*";
        if (subrayado % 2 !== 0) resultado += "__";
        if (guionbajo % 2 !== 0) resultado += "_";
      
        return resultado;
      }

    function truncarConMarkdown(texto, limite) {
        const truncado = truncarTexto(texto, limite);
        return cerrarMarkdown(truncado);
      }

    return texto
    .split(/\r?\n/)
    .map(p => `-# ${truncarConMarkdown(p.trim(), limite)}`)
    .join('\n');
}

module.exports = { formatearTextoLim }
