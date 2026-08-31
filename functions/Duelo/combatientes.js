class Combatiente {
    constructor(id, data = {}) {
        console.log(data)
        this.ID = id
        this.ownerId = data.ownerId;
        this.Nombre = data.perfil?.Nombre || "Aventurero";
        this.HP = data.nucleo?.HP ?? 100;
        this.Mana = data.nucleo?.Mana ?? 50;
        this.stats = data.stats || {};
        this.avatarURL = data.perfil?.avatarURL || "";
        this.statusEffect = [];
        this.defenseActual = 1;

        const dominio = data.dominio
        console.log("Combatientes.js", dominio)
        this.hechizos = dominio.hechizos || [];
        this.equipamiento = dominio.equipo || [];

        this.tempo = this.stats.agilidad || 10; // Agilidad del usuario
        this.compas = 0; // Barra de acción
        this.isAct = true;
        this.defeated = false;
        this.surrender = false;
        this.isTurn = false;

        console.log(this.ID)

        const arma = (this.equipamiento || []).find(item => item && item.tipo === "arma");
        if (arma) {
            this.ataquePredeterminado = arma.skillId;
        } else {
            this.ataquePredeterminado = "default_001";
        }
    }

    aplicarDaño(cantidad) {
        this.ultimoDanioRecibido = Number(cantidad) || 0;
        this.vidaAntesDelGolpe = this.HP;
        this.HP = Math.max(0, this.HP - cantidad);
        if (this.fueDerrotado()) this.defeated = true;
    }

    aplicarCuracion(cantidad, esAccionInstantanea = false) {
        if (this.defeated && !esAccionInstantanea) return;
        const hpMax = this.stats?.hpMax ?? 99999;
        this.HP = Math.min(hpMax, this.HP + cantidad);
        if (this.HP > 0 && !this.surrender) {
            this.defeated = false;
            this._alreadyLoggedDefeat = false;
        }
    }

    fueDerrotado() {
        if (this.surrender) return true;
        console.log("combatiente.js - Revisando derrota de " + this.Nombre + ": HP actual = " + this.HP)
        return this.HP <= 0;
    }

    get effectiveTempo() {
        const baseCompas = Math.floor(1000 / (1 + (this.tempo * 0.08)));
        
        let modVelocidad = 0;
        for (const eff of (this.statusEffect || [])) {
            const id = String(eff.id || eff.Nombre || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (id === 'slowed' || id === 'lentitud') {
                modVelocidad -= 50;
            } else if (id === 'hasted' || id === 'acelerado') {
                modVelocidad += 50;
            } else if (id === 'speed' || id === 'velocidad') {
                modVelocidad += Number(eff.base || 0);
            } else if (id === 'furia' && eff.base?.velocidad !== undefined) {
                modVelocidad += Number(eff.base.velocidad);
            }
        }
        
        const compasEfectivo = Math.max(1, Math.floor(baseCompas * (1 - modVelocidad / 100)));
        return 1000 / compasEfectivo;
    }

    get effectiveAgilidad() {
        const baseAgilidad = this.stats?.agilidad || 0;
        let modAgilidad = 0;
        for (const eff of (this.statusEffect || [])) {
            const id = String(eff.id || eff.Nombre || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (id === 'furia' && eff.base?.agilidad !== undefined) {
                modAgilidad += Number(eff.base.agilidad);
            }
        }
        return Math.max(0, baseAgilidad * (1 + modAgilidad / 100));
    }

    get effectivePrecision() {
        let modPrecision = 0;
        for (const eff of (this.statusEffect || [])) {
            const id = String(eff.id || eff.Nombre || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (id === 'furia' && eff.base?.precision !== undefined) {
                modPrecision += Number(eff.base.precision);
            }
        }
        return modPrecision;
    }

}

class Personaje extends Combatiente {
    constructor(id, data = {}) {
        super(id, data);
        const sendero = data.sendero || data.Sendero || {};
        const fragmentos = data.fragmentos || data.Fragmentos || {};
        this.resonancia = sendero.resonancia || 0;
        this.disonancia = sendero.disonancia || 0;
        this.resplandor = sendero.resplandor ?? data.resplandor ?? 'I';
        this.StelarFragmentsTotal = Number(
            sendero.StelarFragmentsTotal 
            ?? fragmentos.StelarFragmentsTotal 
            ?? data.StelarFragmentsTotal 
            ?? 0
        );
        this.StelarFragments = Number(
            sendero.StelarFragments 
            ?? fragmentos.StelarFragments 
            ?? this.StelarFragmentsTotal
        );
    }
}

class NPC extends Combatiente {
    constructor(id, data) {
        super(id, {
            ownerId: "NPC_" + id,
            perfil: { Nombre: data.Nombre, avatarURL: data.avatarURL },
            nucleo: { HP: data.HP, Mana: data.Mana },
            stats: data.stats || {},
            dominio: { hechizos: [], equipo: [] }
        });
        this.isNPC = true;
        this.nivelMagico = data.nivelMagico || data.stats?.nivelMagico || data.restrictions?.fe_min || 1;
        this.elemento = data.Elemento || "Neutro";
        this.Elemento = data.Elemento || "Neutro";
        this.ataques = data.ataques || [];
        this.loot = data.loot || [];
        this.restrictions = data.restrictions || {};
        this.boss = data.boss || null;
        this.comportamiento = data.comportamiento || [];
        this.permiteAtaqueBasico = data.permiteAtaqueBasico !== false;
        this.permiteDefensaBasica = data.permiteDefensaBasica !== false;
        this.fase = 1;
        this.fasesCompletadas = [];
        this.damageDealt = 0;
        this.reputacion = 0;
        this.ataquePredeterminado = "default_001";

        if (this.stats) {
            this.stats.resFisica = this.stats.resFisica ?? this.stats.resistenciaFisica ?? 5;
            this.stats.resMagica = this.stats.resMagica ?? this.stats.resistenciaMagica ?? 5;
            this.stats.hpMax = this.stats.hpMax ?? data.HP ?? 100;
            this.stats.manaMax = this.stats.manaMax ?? data.Mana ?? 50;
            this.stats.fuerza = this.stats.fuerza ?? 5;
            this.stats.agilidad = this.stats.agilidad ?? 5;
            this.stats.sabiduria = this.stats.sabiduria ?? 5;
            this.stats.inteligencia = this.stats.inteligencia ?? 5;
            this.stats.sintonia = this.stats.sintonia ?? 1;
            this.stats.precision = this.stats.precision ?? 100;
        }
    }
}

module.exports = {
    Personaje,
    NPC
}