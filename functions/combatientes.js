class Combatiente {
    constructor(id, data) {
        console.log(data)
        this.ID = id
        this.ownerId = data.ownerId;
        this.Nombre = data.perfil.Nombre;
        this.HP = data.nucleo.HP;
        this.Mana = data.nucleo.Mana;
        this.stats = data.stats;
        this.avatarURL = data.perfil.avatarURL;
        this.statusEffect = [];
        this.defenseActual = 1;
        this.hechizos = data.dominio.hechizos,
            this.equipamiento = data.dominio.equipo,
            this.statusEffect = [],
            this.statusTurn = {
                aturdido: false,
                ralentizado: 0,
                acelerado: 0,
            }
        this.tempo = data.stats.agilidad, // Agilidad del usuario de forma poetica: tempo
            this.compas = 0 // Barra de acción, determinada a 1000 puntos.
        this.isAct = true,
            this.defeated = false,
            this.isTurn = false
        console.log(this.ID)

        const arma = this.equipamiento.find(item => item.tipo === "arma")
        if(arma) {
            this.ataquePredeterminado = arma.skillId
        }else {
            this.ataquePredeterminado = "default_001"
        }
    }

    aplicarDaño(cantidad) {
        this.HP -= Math.max(0, this.HP - cantidad)
    }

    fueDerrotado() {
        return this.HP <= 0;
    }

    get effectiveTempo() {
        let actualTempo = this.tempo;
        if (this.estadoAlterado.ralentizado > 0) {
            actualTempo *= (1 - this.estadoAlterado.ralentizado); // Ej: 0.5 para -50%
        }
        if (this.estadoAlterado.acelerado > 0) {
            actualTempo *= (1 + this.estadoAlterado.acelerado); // Ej: 0.5 para +50%
        }

        return Math.max(1, actualTempo);
    }

}

class Personaje extends Combatiente {
    constructor(id, data) {
        super(id, data)
        this.ownerID = data.ownerID,
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