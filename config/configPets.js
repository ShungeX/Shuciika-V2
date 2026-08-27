
const petConfig = {
    hambrestd: 300,
    higienestd: 300,
    felicidadstd: 230,
    energiastd: 100,

}

const petDesgaste = {
    hambre: { intervalo: 10, desgasteIntervalo: 1 }, // En minutos    
    higiene: { intervalo: 20, desgasteIntervalo: 4 },     
    felicidad: { intervalo: 15, desgasteIntervalo: 1 },    
    energia: { intervalo: 5, desgasteIntervalo: 2 },    
}

const modificadoresLv = {
        Sencilla: { tiempo: 1.0, xp: 1.0, lvUp: 2 },
        Brillante: { tiempo: 1.2, xp: 1.3, lvUp: 2 },
        Ancestral: { tiempo: 1.5, xp: 1.6, lvUp: 2 },
        Divina: { tiempo: 1.8, xp: 1.8, lvUp: 2 },
        Estelar: { tiempo: 1.9, xp: 2, lvUp: 3 }
}

const modifEtapa = {
        Bebé: 230,
        Niñez: 350,
        Juventud: 540,
}

const pesosEstados = {
    Enfermo: 100
}


module.exports = {petConfig, petDesgaste, modificadoresLv, modifEtapa, pesosEstados};

