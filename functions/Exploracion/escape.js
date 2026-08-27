function getEscapeP(base, agilidad, inteligencia) {
    const A = (agilidad || 0) / 20;
    const I = (inteligencia || 0) / 20;
    const E = (base || 100) / 100;

    const weightA = 0.3;
    const weightI = 0.1;
    const weightE = 0.6;

    let p = (A * weightA) + (I * weightI) + ((1 - E) * weightE);
    let prob = Math.round(Math.max(0, Math.min(1, p)) * 100);

    return { value: p, porcentaje: prob };
}

module.exports = { getEscapeP };

