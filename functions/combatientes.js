class Combatiente {
    constructor(data) {
        this.ID = data.ID || data._id;
        this.Nombre = data.Nombre;
        this.HP = data.nucleo.HP;
        this.Mana = data.nucleo.Mana;
        this.stats = data.stats;
        this.avatarURL = data.avatarURL;
        this.statusEffect = [];
        this.defenseActual = 1;
        this.hechizos = data.dominio.hechizos, 
        this.equipamiento = data.dominio.equipo,
        this.statusEffect = [],
        this.isTurn = false
    }

    aplicarDaño(cantidad) {
        this.HP -= Math.max(0, this.HP - cantidad)
    }

    fueDerrotado() {
        return this.HP <= 0;
    }
}

class Personaje extends Combatiente {
    constructor(data) {
        super(data)
        this.autorID = data.ownerID,
        this.resonancia = data.sendero.resonancia,
        this.disonancia = data.sendero.disonancia,
        this.nivelMagico = data.nucleo.nivelMagico
    }
}

class NPC extends Combatiente {
    constructor(data) {
        super(data);
        this.isNPC = true,
        this.attacks = data.attacks,
        this.triggers = data.triggers,
        this.restrictions = data.restrictions
    }
}

module.exports = {
    Personaje, 
    NPC
}