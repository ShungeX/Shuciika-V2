const { MongoClient, ServerApiVersion, Int32, Double } = require("mongodb")
const config = require("./config/config.js")



require("dotenv").config();
const express = require("express");
const axios = require("axios");
const url = require("url");
const session = require('express-session');
const connectMongo = require('connect-mongo');
const MongoStore = connectMongo.default || connectMongo;
const cors = require('cors');

const GUILD_ID = "716342375303217285"; // ID del servidor de Discord
const uri = process.env.MONGODB_URI
const clientdb = new MongoClient(uri, { family: 4 });
const dbserverName = "Server_db"
const dbname = "Rol_db"
const dbcache = "CachePJ"

const port = process.env.PORT || 3000;
const app = express();

let client = null;
let sessionMiddleware = null;

// CORS para permitir peticiones del frontend
app.use(cors({
    origin: 'http://localhost:5500',
    credentials: true
}));

app.use(express.json());

// Wrapper de sesión diferido para inicializar MongoStore después de que clientdb se conecte
app.use((req, res, next) => {
    if (sessionMiddleware) {
        return sessionMiddleware(req, res, next);
    }
    next();
});

// Ruta de inicio de sesión con Discord (verifica si ya existe sesión activa)
app.get('/api/auth/discord', (req, res) => {
    if (req.session && req.session.user) {
        if (req.session.personaje) {
            console.log(`[Auth] Sesión activa encontrada para ${req.session.user.username}. Redirigiendo directo a dashboard.`);
            return res.redirect('http://localhost:5500/dashboard.html');
        } else {
            console.log(`[Auth] Sesión activa sin personaje para ${req.session.user.username}. Redirigiendo a sin_personaje.`);
            return res.redirect('http://localhost:5500/index.html?estado=sin_personaje');
        }
    }

    const client_id = process.env.ClientID || '721903366837501975';
    const redirect_uri = encodeURIComponent('http://localhost:3000/api/auth/discord/redirect');
    const discordOAuthUrl = `https://discord.com/oauth2/authorize?client_id=${client_id}&response_type=code&redirect_uri=${redirect_uri}&scope=identify+guilds`;
    
    res.redirect(discordOAuthUrl);
});

app.get('/api/auth/discord/login', (req, res) => {
    res.redirect('/api/auth/discord');
});

app.get('/api/auth/discord/redirect', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        console.warn(`[Discord Auth] Autorización cancelada o denegada por usuario: ${error}`);
        return res.redirect('http://localhost:5500/index.html?estado=acceso_denegado');
    }

    if (!code) {
        return res.status(400).send('No se proporcionó ningún código de autorización.');
    }

    try {
        // SOLUCIÓN 1: Agregamos "new" antes de URLSearchParams
        const formData = new url.URLSearchParams({
            client_id: process.env.ClientID,
            client_secret: process.env.ClientSecret,
            grant_type: 'authorization_code',
            code: code.toString(),
            redirect_uri: 'http://localhost:3000/api/auth/discord/redirect',
        });

        const output = await axios.post('https://discord.com/api/v10/oauth2/token',
            formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        if (output.data) {
            const access = output.data.access_token;

            const userInfo = await axios.get('https://discord.com/api/v10/users/@me', {
                headers: {
                    'Authorization': `Bearer ${access}`
                },
            });

            // Ahora sí verás esto en la terminal de Node
            console.log("Tokens de Discord:", output.data);
            const db = clientdb.db(dbname);

            // 2. Buscamos al usuario por su ID de Discord en tu colección (ej. "Personajes" o "Usuarios")
            const perfilExistente = await db.collection("Personajes").findOne({ ownerID: userInfo.data.id });

            if (perfilExistente) {
                console.log(`¡Bienvenido de nuevo, ${userInfo.data.username}! Tu personaje es ${perfilExistente.perfil.Nombre}`);
                req.session.user = {
                    id: userInfo.data.id,
                    username: userInfo.data.username,
                    avatar: userInfo.data.avatar,
                    discriminator: userInfo.data.discriminator,
                    access_token: output.data.access_token,
                    refresh_token: output.data.refresh_token
                };

                const dias = Math.floor(
                    (Date.now() - new Date(perfilExistente.metadata.fechaCreacion * 1000)) / 86400000
                );
                const ahora = Math.floor(Date.now() / 1000)
                const proximaDisponible = perfilExistente?.cooldowns?.recompensa_diaria?.nuevaReclamacion || 0

                const soulExistente = await db.collection("Soul").findOne({ _id: perfilExistente._id });


                req.session.personaje = {
                    nombre: perfilExistente.perfil.Nombre,
                    rol: perfilExistente.perfil.Rol ?? 'Estudiante',
                    reputacion: perfilExistente.perfil.Reputacion ?? 0,
                    grado: perfilExistente.perfil.Grado ?? 'F',
                    fechaCreacion: perfilExistente.metadata.fechaCreacion ?? new Date().toISOString(),
                    energia: soulExistente?.nucleo?.energy ?? null,
                    energiaMax: config.maxEnergy ?? null,
                    lugarExploracion: perfilExistente.perfil.UltimoLugar ?? 'Ninguno',
                    Historia: perfilExistente.perfil.Historia ?? '',
                    avatarURL: perfilExistente.perfil.avatarURL ?? '',
                    recompensaReclamada: ahora < proximaDisponible ?? false
                };
                // Redirigimos al dashboard del frontend
                res.redirect('http://localhost:5500/dashboard.html');
            } else {
                console.log(`Nuevo usuario detectado: ${userInfo.data.username}`);
                // Aquí le dices que primero debe crear su ficha en el servidor de Discord
                // Usuario sin personaje creado
                req.session.sinPersonaje = {
                    username: userInfo.data.username
                };
                res.redirect('http://localhost:5500/index.html?estado=sin_personaje');
            }
        }
    } catch (error) {
        // SOLUCIÓN 3: Atrapamos los errores para saber qué falló exactamente
        console.error("Error en la autenticación de Discord:");
        // Si el error viene de Axios (Discord), mostramos el mensaje exacto de Discord
        if (error.response) {
            console.error(error.response.data);
        } else {
            console.error(error.message);
        }

        // Le avisamos al navegador que hubo un error para que no cargue infinito
        res.status(500).send('Hubo un error al procesar la autorización con Discord.');
    }
});

// Obtener personajes del usuario para el combate
app.get('/api/combat/characters', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });

    try {
        const db = clientdb.db(dbname);
        const db2 = clientdb.db("Server_db");

        // 1. Buscar el documento del usuario que contiene nix.personajes
        const usuario = await db2.collection("usuarios_server").findOne({
            _id: req.session.user.id // ID de Discord del usuario
        });

        if (!usuario || !usuario.nix || !usuario.nix.personajes) {
            return res.json([]);
        }

        // nix.personajes es un array
        const entradas = usuario.nix.personajes;
        const ids = entradas.map(p => typeof p.id !== 'undefined' ? Number(p.id) : Number(p._id));

        // 2. Consultar cada personaje por su _id
        const personajes = await db.collection("Personajes")
            .find({ _id: { $in: ids } })
            .toArray();

        // Consultar la colección Soul para obtener resplandor, FE, HP
        const souls = await db.collection("Soul")
            .find({ _id: { $in: ids } })
            .toArray();

        const soulsMap = {};
        souls.forEach(s => {
            if (s && s._id) {
                soulsMap[s._id.toString()] = s;
            }
        });

        // 3. Mapear solo los campos necesarios para el frontend
        const resultado = personajes.map(char => {
            const charIdStr = char._id.toString();
            const soul = soulsMap[charIdStr] || {};
            return {
                _id: charIdStr,
                nombre: char.perfil?.Nombre || 'Sin nombre',
                avatarURL: char.perfil?.avatarURL || '',
                Historia: char.perfil?.Historia || null,
                resplandor: soul.sendero?.resplandor || 'I',
                FE: soul.sendero?.StelarFragments || 0,
                HP: soul.nucleo?.HP || 0,
                // Un personaje está derrotado si su HP es 0 o menos
                derrotado: (soul.nucleo?.HP ?? 1) <= 0
            };
        });


        console.log("Personajes de combate obtenidos:", resultado);
        res.json(resultado);

    } catch (err) {
        console.error('Error al obtener personajes de combate:', err);
        res.status(500).json({ error: 'Error interno' });
    }
});

const guildId = "716342375303217285";

// GET /api/combat/roles
// Verifica si el usuario tiene roles especiales (para apuestas y modo admin)
app.get('/api/combat/roles', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(500).json({ error: 'Servidor no disponible' });

        const member = await guild.members.fetch(req.session.user.id).catch(() => null);

        const dbServer = clientdb.db("Server_db");
        const usuario = await dbServer.collection("usuarios_server").findOne({ _id: req.session.user.id });
        const esDonador = usuario && (usuario.donadores === true || usuario.donador === true);

        const ROLES_APUESTAS = [
            '737058095599058995',
            '810198633705766962',
            '734142447256469584',
            '796205038665072661'
        ];
        const ROLES_ADMIN = [
            '737058095599058995',
            '746581152717865041'
        ];

        const userRoles = member ? member.roles.cache.map(r => r.id) : [];
        const esBooster = member ? member.roles.cache.has("796205038665072661") : false;
        const tieneRolEspecial = member ? (member.roles.cache.has("810198633705766962") || member.roles.cache.has("737058095599058995")) : false;

        res.json({
            puedeApostrar: ROLES_APUESTAS.some(r => userRoles.includes(r)),
            esAdmin: ROLES_ADMIN.some(r => userRoles.includes(r)),
            puedeSubirImagen: esBooster || tieneRolEspecial || esDonador,
            puedeSubirGif: tieneRolEspecial || esDonador,
            puedeCrearSalaLibre: esBooster || tieneRolEspecial || esDonador
        });

    } catch (err) {
        console.error('Error al verificar roles:', err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// GET /api/combat/inventory
// Devuelve el inventario y los lumens del personaje seleccionado para combate
app.get('/api/combat/inventory', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });

    const personajeIdRaw = req.query.personajeId || req.session.personajeCombateId;
    if (!personajeIdRaw) return res.status(400).json({ error: 'No hay personaje seleccionado' });

    const personajeId = Number(personajeIdRaw);
    req.session.personajeCombateId = personajeId;

    try {
        const db = clientdb.db(dbname);

        const personaje = await db.collection('Personajes').findOne({
            _id: personajeId
        });

        if (!personaje) return res.status(404).json({ error: 'Personaje no encontrado' });

        res.json({
            lumens: personaje.economia?.Lumens ?? 0,
            inventario: personaje.economia?.Inventario ?? []
        });

    } catch (err) {
        console.error('Error al obtener inventario:', err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// GET /api/combat/objects/global
// Devuelve todos los objetos de todas las regiones (solo para admins)
app.get('/api/combat/objects/global', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(500).json({ error: 'Servidor no disponible' });

        const member = await guild.members.fetch(req.session.user.id).catch(() => null);
        if (!member) return res.status(403).json({ error: 'Sin permisos' });

        const ROLES_ADMIN = ['737058095599058995', '746581152717865041'];
        const esAdmin = member.roles.cache.some(r => ROLES_ADMIN.includes(r.id));

        if (!esAdmin) return res.status(403).json({ error: 'Sin permisos' });

        const db = clientdb.db(dbname);

        // Obtiene todos los documentos de Objetos_globales
        const regiones = await db.collection('Objetos_globales').find({}).toArray();

        // Aplanar: { region, objetos: [...] }
        const resultado = regiones.map(r => ({
            region: r._id,
            objetos: r.Objetos ?? []
        }));

        res.json(resultado);

    } catch (err) {
        console.error('Error al obtener objetos globales:', err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// GET /api/admin/objetos/check-permissions
app.get('/api/admin/objetos/check-permissions', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    try {
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        
        const esCreadorDirecto = personas_autorizadas.includes(req.session.user.id) || 
            (member && member.roles.cache.some(r => r.name === 'ADMIN-CREADOR'));
        
        if (esCreadorDirecto) {
            return res.json({ allowed: true, direct: true });
        }

        // Check ticket
        const dbServer = clientdb.db("Server_db");
        const userDoc = await dbServer.collection("usuarios_server").findOne({ _id: req.session.user.id });
        if (userDoc && userDoc.admin && userDoc.admin.tokens) {
            const now = new Date();
            const token = userDoc.admin.tokens.find(t => 
                t.tipo === 'objeto' && !t.usado && (!t.expiresAt || new Date(t.expiresAt) > now)
            );
            if (token) {
                return res.json({ allowed: true, direct: false, hasToken: true });
            }
        }

        return res.json({ allowed: false, message: 'Requiere ticket de autorización' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// GET /api/admin/objetos (Solo Admins)
app.get('/api/admin/objetos', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    try {
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        if (!member) return res.status(403).json({ error: 'Sin permisos' });

        const ROLES_ADMIN = ['737058095599058995', '746581152717865041'];
        const esAdmin = member.roles.cache.some(r => ROLES_ADMIN.includes(r.id));
        if (!esAdmin) return res.status(403).json({ error: 'Sin permisos' });

        const db = clientdb.db(dbname);
        const regiones = await db.collection('Objetos_globales').find({}).toArray();
        const resultado = regiones.map(r => ({
            region: r._id,
            objetos: r.Objetos ?? []
        }));
        res.json(resultado);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// POST /api/admin/objetos (Crear)
app.post('/api/admin/objetos', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    try {
        const dbServer = clientdb.db("Server_db");
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        
        const esCreadorDirecto = personas_autorizadas.includes(req.session.user.id) || 
            (member && member.roles.cache.some(r => r.name === 'ADMIN-CREADOR'));
        
        if (!esCreadorDirecto) {
            const tokenRes = await verificarYConsumirTokenAdmin(req.session.user.id, dbServer, 'objeto');
            if (!tokenRes.ok) {
                return res.status(403).json({ error: tokenRes.error || 'Requiere ticket de autorización' });
            }
        }

        const { region, objeto } = req.body;
        if (!region || !objeto) {
            return res.status(400).json({ error: 'Faltan campos obligatorios (region u objeto).' });
        }

        const db = clientdb.db(dbname);
        const collection = db.collection('Objetos_globales');

        let regionDoc = await collection.findOne({ _id: region });
        if (!regionDoc) {
            await collection.insertOne({ _id: region, Descripcion: `Región ${region}`, Objetos: [] });
            regionDoc = { _id: region, Objetos: [] };
        }

        // Calcular ID autonumérico
        const existingIds = (regionDoc.Objetos || []).map(o => Number(o.ID)).filter(id => !isNaN(id));
        const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

        // Formatear fecha actual México (UTC-6)
        const timeZone = "America/Mexico_City";
        const d = new Date();
        const formatter = new Intl.DateTimeFormat('es-MX', {
            timeZone,
            day: 'numeric',
            month: 'numeric',
            year: 'numeric'
        });
        const [{ value: day },,{ value: month },,{ value: year }] = formatter.formatToParts(d);
        const fechaMexico = `${day}/${month}/${year}`;

        // Normalizar y construir el objeto a guardar
        const normalizedObjeto = {
            ID: new Int32(nextId),
            ID_Autocomplete: `${region}${nextId}`,
            Region: region,
            Nombre: objeto.Nombre || "",
            Descripcion: objeto.Descripcion || "",
            Rareza: objeto.Rareza || "Común",
            Tipo: Array.isArray(objeto.Tipo) ? objeto.Tipo : (objeto.Tipo ? [objeto.Tipo] : []),
            Cantidad: objeto.Cantidad !== undefined ? objeto.Cantidad : null,
            atributos: {
                peso: new Int32(objeto.atributos?.peso ? Number(objeto.atributos.peso) : 0)
            },
            inStore: typeof objeto.inStore !== "undefined" ? Boolean(objeto.inStore) : false,
            precio: new Int32(objeto.inStore ? Number(objeto.precio || 0) : 0),
            vendido: new Int32(0),
            fecha: fechaMexico,
            evento_origen: objeto.evento_origen || null,
            imagenURL: objeto.imagenURL || null,
            intercambiable: typeof objeto.intercambiable !== "undefined" ? Boolean(objeto.intercambiable) : false,
            maximoUnoPorPersona: typeof objeto.maximoUnoPorPersona !== "undefined" ? Boolean(objeto.maximoUnoPorPersona) : (typeof objeto.max1PorPersona !== "undefined" ? Boolean(objeto.max1PorPersona) : false),
            contaminable: typeof objeto.contaminable !== "undefined" ? Boolean(objeto.contaminable) : false,
            purificable: typeof objeto.purificable !== "undefined" ? Boolean(objeto.purificable) : false,
            tiempo_limite: objeto.tiempo_limite || null,
            creador: req.session.user.id,
            restricciones: {
                fe_min: new Int32(objeto.restricciones?.fe_min ? Number(objeto.restricciones.fe_min) : 0),
                fe_max: new Int32(objeto.restricciones?.fe_max ? Number(objeto.restricciones.fe_max) : 0),
                resplandor_min: new Int32(objeto.restricciones?.resplandor_min ? Number(objeto.restricciones.resplandor_min) : 0),
                resplandor_max: new Int32(objeto.restricciones?.resplandor_max ? Number(objeto.restricciones.resplandor_max) : 0),
                clase: objeto.restricciones?.clase || null,
                region: objeto.restricciones?.region || null,
                reputacion: objeto.restricciones?.reputacion || null
            },
            uso: {
                contexto: objeto.uso?.contexto || "ambos",
                consumible: typeof objeto.uso?.consumible !== "undefined" ? Boolean(objeto.uso.consumible) : true,
                requiereSeleccion: typeof objeto.uso?.requiereSeleccion !== "undefined" ? Boolean(objeto.uso.requiereSeleccion) : false,
                objetivo: {
                    tipo: objeto.uso?.objetivo?.tipo || "mismo",
                    cantidad: new Int32(objeto.uso?.requiereSeleccion ? Number(objeto.uso?.objetivo?.cantidad || 1) : 1)
                },
                cooldown: objeto.uso?.cooldown ? new Int32(Number(objeto.uso.cooldown)) : null
            },
            efectos: (objeto.efectos || []).map(ef => {
                return {
                    tipo: ef.tipo ? ef.tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "",
                    stat: ef.stat || null,
                    valor: new Int32(Number(ef.valor || 0)),
                    duracion: ef.duracion ? new Int32(Number(ef.duracion)) : null,
                    condicion: ef.condicion || null
                };
            })
        };

        await collection.updateOne({ _id: region }, { $push: { Objetos: normalizedObjeto } });
        res.json({ success: true, message: 'Objeto creado exitosamente.', objeto: normalizedObjeto });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// PUT /api/admin/objetos/:region/:id (Editar)
app.put('/api/admin/objetos/:region/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    try {
        const dbServer = clientdb.db("Server_db");
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        
        const esCreadorDirecto = personas_autorizadas.includes(req.session.user.id) || 
            (member && member.roles.cache.some(r => r.name === 'ADMIN-CREADOR'));
        
        if (!esCreadorDirecto) {
            const tokenRes = await verificarYConsumirTokenAdmin(req.session.user.id, dbServer, 'objeto');
            if (!tokenRes.ok) {
                return res.status(403).json({ error: tokenRes.error || 'Requiere ticket de autorización' });
            }
        }

        const { region, id } = req.params;
        const { objeto } = req.body;

        if (!objeto) {
            return res.status(400).json({ error: 'Falta el objeto para actualizar.' });
        }

        const db = clientdb.db(dbname);
        const collection = db.collection('Objetos_globales');

        const regionDoc = await collection.findOne({ _id: region });
        if (!regionDoc) {
            return res.status(404).json({ error: 'Región no encontrada.' });
        }

        const targetObj = (regionDoc.Objetos || []).find(o => Number(o.ID) === Number(id));
        if (!targetObj) {
            return res.status(404).json({ error: 'Objeto no encontrado en esta región.' });
        }

        const normalizedObjeto = {
            ID: new Int32(Number(id)),
            ID_Autocomplete: targetObj.ID_Autocomplete,
            Region: region,
            Nombre: objeto.Nombre || "",
            Descripcion: objeto.Descripcion || "",
            Rareza: objeto.Rareza || "Común",
            Tipo: Array.isArray(objeto.Tipo) ? objeto.Tipo : (objeto.Tipo ? [objeto.Tipo] : []),
            Cantidad: targetObj.Cantidad !== undefined ? targetObj.Cantidad : null,
            atributos: {
                peso: new Int32(objeto.atributos?.peso ? Number(objeto.atributos.peso) : 0)
            },
            inStore: typeof objeto.inStore !== "undefined" ? Boolean(objeto.inStore) : false,
            precio: new Int32(objeto.inStore ? Number(objeto.precio || 0) : 0),
            vendido: targetObj.vendido || new Int32(0),
            fecha: targetObj.fecha,
            evento_origen: objeto.evento_origen || null,
            imagenURL: objeto.imagenURL || null,
            intercambiable: typeof objeto.intercambiable !== "undefined" ? Boolean(objeto.intercambiable) : false,
            maximoUnoPorPersona: typeof objeto.maximoUnoPorPersona !== "undefined" ? Boolean(objeto.maximoUnoPorPersona) : (typeof objeto.max1PorPersona !== "undefined" ? Boolean(objeto.max1PorPersona) : false),
            contaminable: typeof objeto.contaminable !== "undefined" ? Boolean(objeto.contaminable) : false,
            purificable: typeof objeto.purificable !== "undefined" ? Boolean(objeto.purificable) : false,
            tiempo_limite: objeto.tiempo_limite || null,
            creador: targetObj.creador || req.session.user.id,
            restricciones: {
                fe_min: new Int32(objeto.restricciones?.fe_min ? Number(objeto.restricciones.fe_min) : 0),
                fe_max: new Int32(objeto.restricciones?.fe_max ? Number(objeto.restricciones.fe_max) : 0),
                resplandor_min: new Int32(objeto.restricciones?.resplandor_min ? Number(objeto.restricciones.resplandor_min) : 0),
                resplandor_max: new Int32(objeto.restricciones?.resplandor_max ? Number(objeto.restricciones.resplandor_max) : 0),
                clase: objeto.restricciones?.clase || null,
                region: objeto.restricciones?.region || null,
                reputacion: objeto.restricciones?.reputacion || null
            },
            uso: {
                contexto: objeto.uso?.contexto || "ambos",
                consumible: typeof objeto.uso?.consumible !== "undefined" ? Boolean(objeto.uso.consumible) : true,
                requiereSeleccion: typeof objeto.uso?.requiereSeleccion !== "undefined" ? Boolean(objeto.uso.requiereSeleccion) : false,
                objetivo: {
                    tipo: objeto.uso?.objetivo?.tipo || "mismo",
                    cantidad: new Int32(objeto.uso?.requiereSeleccion ? Number(objeto.uso?.objetivo?.cantidad || 1) : 1)
                },
                cooldown: objeto.uso?.cooldown ? new Int32(Number(objeto.uso.cooldown)) : null
            },
            efectos: (objeto.efectos || []).map(ef => {
                return {
                    tipo: ef.tipo ? ef.tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "",
                    stat: ef.stat || null,
                    valor: new Int32(Number(ef.valor || 0)),
                    duracion: ef.duracion ? new Int32(Number(ef.duracion)) : null,
                    condicion: ef.condicion || null
                };
            })
        };

        await collection.updateOne(
            { _id: region, "Objetos.ID": Number(id) },
            { $set: { "Objetos.$": normalizedObjeto } }
        );

        res.json({ success: true, message: 'Objeto actualizado exitosamente.', objeto: normalizedObjeto });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// GET /api/admin/hechizos (Solo Admins)
app.get('/api/admin/hechizos', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    try {
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        if (!member) return res.status(403).json({ error: 'Sin permisos' });

        const ROLES_ADMIN = ['737058095599058995', '746581152717865041'];
        const esAdmin = member.roles.cache.some(r => ROLES_ADMIN.includes(r.id));
        if (!esAdmin) return res.status(403).json({ error: 'Sin permisos' });

        const db = clientdb.db(dbname);
        const spells = await db.collection('Hechizos_globales').find({}).toArray();
        res.json(spells);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// POST /api/admin/hechizos (Crear Hechizo)
app.post('/api/admin/hechizos', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    try {
        const dbServer = clientdb.db("Server_db");
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        
        const esCreadorDirecto = personas_autorizadas.includes(req.session.user.id) || 
            (member && member.roles.cache.some(r => r.name === 'ADMIN-CREADOR'));
        
        if (!esCreadorDirecto) {
            const tokenRes = await verificarYConsumirTokenAdmin(req.session.user.id, dbServer, 'objeto');
            if (!tokenRes.ok) {
                return res.status(403).json({ error: tokenRes.error || 'Requiere ticket de autorización' });
            }
        }

        const { hechizo } = req.body;
        if (!hechizo || !hechizo.Nombre || !hechizo.Elemento) {
            return res.status(400).json({ error: 'Faltan campos obligatorios (Nombre o Elemento).' });
        }

        const db = clientdb.db(dbname);
        const collection = db.collection('Hechizos_globales');

        // Calcular ID correlativo para el elemento
        const existingSpells = await collection.find({ Elemento: hechizo.Elemento }).toArray();
        let maxNum = 0;
        existingSpells.forEach(s => {
            const match = String(s._id).match(/-(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
            }
        });
        const nextNum = maxNum + 1;
        const nextId = `${hechizo.Elemento}-${String(nextNum).padStart(3, '0')}`;

        const normalizedHechizo = {
            _id: nextId,
            Nombre: hechizo.Nombre || "",
            Descripcion: hechizo.Descripcion || "",
            Tipo: hechizo.Tipo || "movimiento",
            Elemento: hechizo.Elemento,
            isActive: typeof hechizo.isActive !== "undefined" ? Boolean(hechizo.isActive) : true,
            Req: {
                fe_min: hechizo.Req?.fe_min ? new Int32(Number(hechizo.Req.fe_min)) : null,
                fe_max: hechizo.Req?.fe_max ? new Int32(Number(hechizo.Req.fe_max)) : null,
                resplandor_min: hechizo.Req?.resplandor_min ? new Int32(Number(hechizo.Req.resplandor_min)) : null,
                resplandor_max: hechizo.Req?.resplandor_max ? new Int32(Number(hechizo.Req.resplandor_max)) : null,
                clase: hechizo.Req?.clase || null,
                stats: hechizo.Req?.stats || null
            },
            Mecanicas: {
                cast: {
                    tiempo: new Int32(hechizo.Mecanicas?.cast?.tiempo ? Number(hechizo.Mecanicas.cast.tiempo) : 1),
                    probabilidad: hechizo.Mecanicas?.cast?.probabilidad !== undefined ? Number(hechizo.Mecanicas.cast.probabilidad) : 1.0,
                    interruptible: typeof hechizo.Mecanicas?.cast?.interruptible !== "undefined" ? Boolean(hechizo.Mecanicas.cast.interruptible) : true
                }
            },
            Costos: {
                mana: new Int32(hechizo.Costos?.mana ? Number(hechizo.Costos.mana) : 0),
                Vida: new Int32(hechizo.Costos?.Vida ? Number(hechizo.Costos.Vida) : 0),
                Dinero: new Int32(hechizo.Costos?.Dinero ? Number(hechizo.Costos.Dinero) : 0),
                Cooldown: new Int32(hechizo.Costos?.Cooldown ? Number(hechizo.Costos.Cooldown) : 0)
            },
            Creado: "",
            uso: hechizo.uso || "combate"
        };

        if (hechizo.Mecanicas?.damage && typeof hechizo.Mecanicas.damage.base !== 'undefined') {
            normalizedHechizo.Mecanicas.damage = {
                base: new Int32(Number(hechizo.Mecanicas.damage.base)),
                scaling: {
                    stats: hechizo.Mecanicas.damage.scaling?.stats || "inteligencia",
                    multi: Number(hechizo.Mecanicas.damage.scaling?.multi || 1.0)
                },
                objetivo: hechizo.Mecanicas.damage.objetivo || "enemigos"
            };
        }

        if (hechizo.Mecanicas?.healing && typeof hechizo.Mecanicas.healing.base !== 'undefined') {
            normalizedHechizo.Mecanicas.healing = {
                base: new Int32(Number(hechizo.Mecanicas.healing.base)),
                scaling: {
                    stats: hechizo.Mecanicas.healing.scaling?.stats || "inteligencia",
                    multi: Number(hechizo.Mecanicas.healing.scaling?.multi || 1.0)
                },
                objetivo: hechizo.Mecanicas.healing.objetivo || "aliados"
            };
        }

        if (hechizo.Mecanicas?.Efectos) {
            normalizedHechizo.Mecanicas.Efectos = {};
            for (const [key, val] of Object.entries(hechizo.Mecanicas.Efectos)) {
                normalizedHechizo.Mecanicas.Efectos[key] = {
                    Nombre: val.Nombre || key,
                    base: new Int32(Number(val.base || 0)),
                    duracion: new Int32(Number(val.duracion || 0)),
                    objetivo: val.objetivo || "enemigos",
                    probabilidad: Number(val.probabilidad || 1.0)
                };
            }
        }

        await collection.insertOne(normalizedHechizo);
        res.json({ success: true, message: 'Hechizo creado exitosamente.', hechizo: normalizedHechizo });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// PUT /api/admin/hechizos/:id (Editar Hechizo)
app.put('/api/admin/hechizos/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    try {
        const dbServer = clientdb.db("Server_db");
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        
        const esCreadorDirecto = personas_autorizadas.includes(req.session.user.id) || 
            (member && member.roles.cache.some(r => r.name === 'ADMIN-CREADOR'));
        
        if (!esCreadorDirecto) {
            const tokenRes = await verificarYConsumirTokenAdmin(req.session.user.id, dbServer, 'objeto');
            if (!tokenRes.ok) {
                return res.status(403).json({ error: tokenRes.error || 'Requiere ticket de autorización' });
            }
        }

        const { id } = req.params;
        const { hechizo } = req.body;

        if (!hechizo) {
            return res.status(400).json({ error: 'Falta el hechizo para actualizar.' });
        }

        const db = clientdb.db(dbname);
        const collection = db.collection('Hechizos_globales');

        const targetSpell = await collection.findOne({ _id: id });
        if (!targetSpell) {
            return res.status(404).json({ error: 'Hechizo no encontrado.' });
        }

        const normalizedHechizo = {
            _id: targetSpell._id,
            Nombre: hechizo.Nombre || "",
            Descripcion: hechizo.Descripcion || "",
            Tipo: hechizo.Tipo || "movimiento",
            Elemento: targetSpell.Elemento,
            isActive: typeof hechizo.isActive !== "undefined" ? Boolean(hechizo.isActive) : true,
            Req: {
                fe_min: hechizo.Req?.fe_min ? new Int32(Number(hechizo.Req.fe_min)) : null,
                fe_max: hechizo.Req?.fe_max ? new Int32(Number(hechizo.Req.fe_max)) : null,
                resplandor_min: hechizo.Req?.resplandor_min ? new Int32(Number(hechizo.Req.resplandor_min)) : null,
                resplandor_max: hechizo.Req?.resplandor_max ? new Int32(Number(hechizo.Req.resplandor_max)) : null,
                clase: hechizo.Req?.clase || null,
                stats: hechizo.Req?.stats || null
            },
            Mecanicas: {
                cast: {
                    tiempo: new Int32(hechizo.Mecanicas?.cast?.tiempo ? Number(hechizo.Mecanicas.cast.tiempo) : 1),
                    probabilidad: hechizo.Mecanicas?.cast?.probabilidad !== undefined ? Number(hechizo.Mecanicas.cast.probabilidad) : 1.0,
                    interruptible: typeof hechizo.Mecanicas?.cast?.interruptible !== "undefined" ? Boolean(hechizo.Mecanicas.cast.interruptible) : true
                }
            },
            Costos: {
                mana: new Int32(hechizo.Costos?.mana ? Number(hechizo.Costos.mana) : 0),
                Vida: new Int32(hechizo.Costos?.Vida ? Number(hechizo.Costos.Vida) : 0),
                Dinero: new Int32(hechizo.Costos?.Dinero ? Number(hechizo.Costos.Dinero) : 0),
                Cooldown: new Int32(hechizo.Costos?.Cooldown ? Number(hechizo.Costos.Cooldown) : 0)
            },
            Creado: targetSpell.Creado || "",
            uso: hechizo.uso || "combate"
        };

        if (hechizo.Mecanicas?.damage && typeof hechizo.Mecanicas.damage.base !== 'undefined') {
            normalizedHechizo.Mecanicas.damage = {
                base: new Int32(Number(hechizo.Mecanicas.damage.base)),
                scaling: {
                    stats: hechizo.Mecanicas.damage.scaling?.stats || "inteligencia",
                    multi: Number(hechizo.Mecanicas.damage.scaling?.multi || 1.0)
                },
                objetivo: hechizo.Mecanicas.damage.objetivo || "enemigos"
            };
        }

        if (hechizo.Mecanicas?.healing && typeof hechizo.Mecanicas.healing.base !== 'undefined') {
            normalizedHechizo.Mecanicas.healing = {
                base: new Int32(Number(hechizo.Mecanicas.healing.base)),
                scaling: {
                    stats: hechizo.Mecanicas.healing.scaling?.stats || "inteligencia",
                    multi: Number(hechizo.Mecanicas.healing.scaling?.multi || 1.0)
                },
                objetivo: hechizo.Mecanicas.healing.objetivo || "aliados"
            };
        }

        if (hechizo.Mecanicas?.Efectos) {
            normalizedHechizo.Mecanicas.Efectos = {};
            for (const [key, val] of Object.entries(hechizo.Mecanicas.Efectos)) {
                normalizedHechizo.Mecanicas.Efectos[key] = {
                    Nombre: val.Nombre || key,
                    base: new Int32(Number(val.base || 0)),
                    duracion: new Int32(Number(val.duracion || 0)),
                    objetivo: val.objetivo || "enemigos",
                    probabilidad: Number(val.probabilidad || 1.0)
                };
            }
        }

        await collection.replaceOne({ _id: targetSpell._id }, normalizedHechizo);
        res.json({ success: true, message: 'Hechizo actualizado exitosamente.', hechizo: normalizedHechizo });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Helper para normalizar NPCs en Server
function normalizeNpc(npc) {
    const normalized = {
        Nombre: npc.Nombre || "",
        Descripcion: npc.Descripcion || "",
        Elemento: npc.Elemento || "Neutro",
        Region: npc.Region || "",
        avatarURL: npc.avatarURL || "",
        HP: new Int32(Number(npc.HP || 0)),
        Mana: new Int32(Number(npc.Mana || 0)),
        Faccion: npc.Faccion || null,
        Type: npc.Type || "Enemigo",
        artefactoMagico: typeof npc.artefactoMagico !== "undefined" ? Boolean(npc.artefactoMagico) : false,
        permiteAtaqueBasico: typeof npc.permiteAtaqueBasico !== "undefined" ? Boolean(npc.permiteAtaqueBasico) : true,
        permiteDefensaBasica: typeof npc.permiteDefensaBasica !== "undefined" ? Boolean(npc.permiteDefensaBasica) : true,
        stats: {
            hpMax: new Int32(Number(npc.stats?.hpMax || npc.HP || 0)),
            manaMax: new Int32(Number(npc.stats?.manaMax || npc.Mana || 0)),
            fuerza: new Int32(Number(npc.stats?.fuerza || 0)),
            resistenciaFisica: new Int32(Number(npc.stats?.resistenciaFisica || npc.stats?.resFisica || 0)),
            agilidad: new Int32(Number(npc.stats?.agilidad || 0)),
            sabiduria: new Int32(Number(npc.stats?.sabiduria || 0)),
            inteligencia: new Int32(Number(npc.stats?.inteligencia || 0)),
            resistenciaMagica: new Int32(Number(npc.stats?.resistenciaMagica || npc.stats?.resMagica || 0)),
            poderElemental: new Int32(Number(npc.stats?.poderElemental || 0)),
            percepcion: new Int32(Number(npc.stats?.percepcion || 0)),
            voluntad: new Int32(Number(npc.stats?.voluntad || 0)),
            regeneracion: new Int32(Number(npc.stats?.regeneracion || 0)),
            paradoja: new Int32(Number(npc.stats?.paradoja || 0)),
            destino: new Int32(Number(npc.stats?.destino || 0))
        },
        restrictions: {
            fe_min: npc.restrictions?.fe_min ? new Int32(Number(npc.restrictions.fe_min)) : new Int32(0),
            fe_max: npc.restrictions?.fe_max ? new Int32(Number(npc.restrictions.fe_max)) : new Int32(0),
            questRequired: typeof npc.restrictions?.questRequired !== "undefined" ? Boolean(npc.restrictions.questRequired) : false,
            Surrender: typeof npc.restrictions?.Surrender !== "undefined" ? Boolean(npc.restrictions.Surrender) : false,
            Run: typeof npc.restrictions?.Run !== "undefined" ? Boolean(npc.restrictions.Run) : true,
            probabilidadEscape: typeof npc.restrictions?.probabilidadEscape !== "undefined" ? new Double(Number(npc.restrictions.probabilidadEscape)) : new Double(0.1)
        },
        ataques: (npc.ataques || []).map(a => {
            const normalizedAttack = {
                id: String(a.id || Math.random()),
                name: a.name || a.Nombre || "Ataque",
                type: new Int32(Number(a.type || 2)),
                objetivo: a.objetivo || "enemigos",
                probabilidad: new Int32(Number(a.probabilidad || 50)),
                targeting: a.targeting || "random",
                objetivosCant: new Int32(Number(a.objetivosCant || 1)),
                fases: (a.fases || [1]).map(f => new Int32(Number(f)))
            };
            if (a.type === 1) {
                normalizedAttack.hechizoId = a.hechizoId || "";
            } else {
                if (a.damage) {
                    normalizedAttack.damage = {
                        base: new Int32(Number(a.damage.base || 0)),
                        scaling: a.damage.scaling || { stats: "fuerza", multi: 1.0 }
                    };
                }
                if (a.healing) {
                    normalizedAttack.healing = {
                        base: new Int32(Number(a.healing.base || 0)),
                        scaling: a.healing.scaling || { stats: "inteligencia", multi: 1.0 }
                    };
                }
                const rawEfectos = a.efectos || a.Efectos;
                if (rawEfectos) {
                    if (Array.isArray(rawEfectos)) {
                        normalizedAttack.efectos = rawEfectos.map(ef => ({
                            tipo: String(ef.tipo || "efecto"),
                            Nombre: ef.Nombre || ef.tipo || "Efecto",
                            valor: new Int32(Number(ef.valor !== undefined ? ef.valor : (ef.base || 0))),
                            base: new Int32(Number(ef.base !== undefined ? ef.base : (ef.valor || 0))),
                            duracion: ef.duracion !== null && ef.duracion !== undefined ? new Int32(Number(ef.duracion)) : null,
                            objetivo: ef.objetivo || a.objetivo || "enemigos",
                            probabilidad: Number(ef.probabilidad !== undefined ? ef.probabilidad : 1.0),
                            condicion: ef.condicion || null
                        }));
                        const mapObj = {};
                        rawEfectos.forEach(ef => {
                            const k = String(ef.tipo || "efecto").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                            mapObj[k] = {
                                Nombre: ef.Nombre || ef.tipo || k,
                                base: new Int32(Number(ef.valor !== undefined ? ef.valor : (ef.base || 0))),
                                duracion: ef.duracion !== null && ef.duracion !== undefined ? new Int32(Number(ef.duracion)) : null,
                                objetivo: ef.objetivo || a.objetivo || "enemigos",
                                probabilidad: Number(ef.probabilidad !== undefined ? ef.probabilidad : 1.0)
                            };
                        });
                        normalizedAttack.Efectos = mapObj;
                    } else if (typeof rawEfectos === "object") {
                        normalizedAttack.Efectos = {};
                        const arr = [];
                        for (const [key, val] of Object.entries(rawEfectos)) {
                            normalizedAttack.Efectos[key] = {
                                Nombre: val.Nombre || key,
                                base: new Int32(Number(val.base !== undefined ? val.base : (val.valor || 0))),
                                duracion: val.duracion !== null && val.duracion !== undefined ? new Int32(Number(val.duracion)) : null,
                                objetivo: val.objetivo || "enemigos",
                                probabilidad: Number(val.probabilidad !== undefined ? val.probabilidad : 1.0)
                            };
                            arr.push({
                                tipo: key,
                                Nombre: val.Nombre || key,
                                valor: val.base !== undefined ? val.base : (val.valor || 0),
                                duracion: val.duracion,
                                objetivo: val.objetivo || "enemigos",
                                probabilidad: val.probabilidad || 1.0
                            });
                        }
                        normalizedAttack.efectos = arr;
                    }
                }
                if (a.cast) {
                    normalizedAttack.cast = {
                        tiempo: new Int32(Number(a.cast.tiempo || 1)),
                        probabilidad: Number(a.cast.probabilidad || 1.0),
                        interruptible: typeof a.cast.interruptible !== "undefined" ? Boolean(a.cast.interruptible) : true
                    };
                }
            }
            return normalizedAttack;
        }),
        comportamiento: (npc.comportamiento || []).map(r => ({
            prioridad: new Int32(Number(r.prioridad || 0)),
            peso: new Int32(Number(r.peso || 50)),
            condiciones: (r.condiciones || []).map(c => ({
                tipo: c.tipo || "",
                valor: c.valor || "",
                efecto: c.efecto || "",
                hechizoId: c.hechizoId || "",
                objetoId: c.objetoId || "",
                elemento: c.elemento || ""
            })),
            operador: r.operador || "AND",
            acciones: (r.acciones || []).map(act => {
                const normAct = {
                    tipo: act.tipo || ""
                };
                if (act.tipo === "usar_ataque") {
                    normAct.ataqueId = act.ataqueId;
                } else if (act.tipo === "aplicar_efecto") {
                    normAct.efecto = {
                        Nombre: act.efecto?.Nombre || "",
                        base: new Int32(Number(act.efecto?.base || 0)),
                        duracion: new Int32(Number(act.efecto?.duracion || 1)),
                        objetivo: act.efecto?.objetivo || "enemigos"
                    };
                } else if (act.tipo === "cambiar_fase") {
                    normAct.fase = new Int32(Number(act.fase || 1));
                } else if (act.tipo === "recuperar_hp" || act.tipo === "recuperar_mana") {
                    normAct.valor = new Int32(Number(act.valor || 0));
                }
                return normAct;
            })
        })),
        loot: (npc.loot || []).map(l => {
            const normLoot = {
                typeLoot: l.typeLoot || "lumens",
                dropRate: new Double(Number(l.dropRate || 1.0)),
                quantity: String(l.quantity || "1")
            };
            if (l.typeLoot === "item" && l.itemId) {
                normLoot.itemId = [l.itemId[0], new Int32(Number(l.itemId[1]))];
            }
            return normLoot;
        }),
        boss: npc.boss ? {
            fases: (npc.boss.fases || []).map((f, idx) => {
                const normPhase = {
                    nombre: f.nombre || `Fase ${idx + 1}`,
                    condiciones: (f.condiciones || []).map(c => ({
                        tipo: c.tipo || "",
                        valor: c.valor || "",
                        efecto: c.efecto || "",
                        hechizoId: c.hechizoId || "",
                        objetoId: c.objetoId || "",
                        elemento: c.elemento || ""
                    })),
                    operador: f.operador || "AND",
                    ataquesDesbloqueados: (f.ataquesDesbloqueados || []).map(id => String(id)),
                    bonusStats: {}
                };
                if (f.bonusStats) {
                    for (const [stat, bonus] of Object.entries(f.bonusStats)) {
                        normPhase.bonusStats[stat] = new Int32(Number(bonus));
                    }
                }
                return normPhase;
            })
        } : null,
        metadata: {
            createdBy: npc.metadata?.createdBy || "Admin",
            version: npc.metadata?.version || "1.0.0"
        }
    };
    return normalized;
}

// GET /api/admin/npcs (Solo Admins)
app.get('/api/admin/npcs', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    try {
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        if (!member) return res.status(403).json({ error: 'Sin permisos' });

        const ROLES_ADMIN = ['737058095599058995', '746581152717865041'];
        const esAdmin = member.roles.cache.some(r => ROLES_ADMIN.includes(r.id));
        if (!esAdmin) return res.status(403).json({ error: 'Sin permisos' });

        const db = clientdb.db(dbname);
        const npcsList = await db.collection('NPCs').find({}).toArray();
        res.json(npcsList);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// POST /api/admin/npcs (Crear)
app.post('/api/admin/npcs', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    try {
        const dbServer = clientdb.db("Server_db");
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        
        const esCreadorDirecto = personas_autorizadas.includes(req.session.user.id) || 
            (member && member.roles.cache.some(r => r.name === 'ADMIN-CREADOR'));
        
        if (!esCreadorDirecto) {
            const tokenRes = await verificarYConsumirTokenAdmin(req.session.user.id, dbServer, 'objeto');
            if (!tokenRes.ok) {
                return res.status(403).json({ error: tokenRes.error || 'Requiere ticket de autorización' });
            }
        }

        const { npc } = req.body;
        if (!npc || !npc.Nombre || !npc.Region) {
            return res.status(400).json({ error: 'Faltan campos obligatorios (Nombre o Region).' });
        }

        const db = clientdb.db(dbname);
        const collection = db.collection('NPCs');

        // Calcular ID correlativo
        const existingNpcs = await collection.find({}).toArray();
        let maxNum = 0;
        existingNpcs.forEach(n => {
            const match = String(n._id).match(/NPC-(\d+)/i);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
            }
        });
        const nextNum = maxNum + 1;
        const nextId = `NPC-${String(nextNum).padStart(3, '0')}`;

        const normalized = normalizeNpc(npc);
        normalized._id = nextId;

        await collection.insertOne(normalized);
        res.json({ success: true, message: 'NPC creado exitosamente.', npc: normalized });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// PUT /api/admin/npcs/:id (Editar)
app.put('/api/admin/npcs/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    try {
        const dbServer = clientdb.db("Server_db");
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        
        const esCreadorDirecto = personas_autorizadas.includes(req.session.user.id) || 
            (member && member.roles.cache.some(r => r.name === 'ADMIN-CREADOR'));
        
        if (!esCreadorDirecto) {
            const tokenRes = await verificarYConsumirTokenAdmin(req.session.user.id, dbServer, 'objeto');
            if (!tokenRes.ok) {
                return res.status(403).json({ error: tokenRes.error || 'Requiere ticket de autorización' });
            }
        }

        const { id } = req.params;
        const { npc } = req.body;

        if (!npc) {
            return res.status(400).json({ error: 'Falta el NPC para actualizar.' });
        }

        const db = clientdb.db(dbname);
        const collection = db.collection('NPCs');

        const targetNpc = await collection.findOne({ _id: id });
        if (!targetNpc) {
            return res.status(404).json({ error: 'NPC no encontrado.' });
        }

        const normalized = normalizeNpc(npc);
        normalized._id = targetNpc._id;

        await collection.replaceOne({ _id: targetNpc._id }, normalized);
        res.json({ success: true, message: 'NPC actualizado exitosamente.', npc: normalized });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// GET /api/admin/regiones (Obtener todas las regiones)
app.get('/api/admin/regiones', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    try {
        const db = clientdb.db(dbname);
        const regionesList = await db.collection('Regiones').find({}).toArray();
        res.json(regionesList);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno obteniendo regiones' });
    }
});

// POST /api/admin/regiones (Crear nueva región)
app.post('/api/admin/regiones', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    try {
        const db = clientdb.db(dbname);
        const { region } = req.body;
        if (!region || !region._id || !region.Nombre) {
            return res.status(400).json({ error: 'Faltan campos obligatorios para la región (_id, Nombre).' });
        }
        const existing = await db.collection('Regiones').findOne({ _id: region._id });
        if (existing) {
            return res.status(400).json({ error: 'Ya existe una región con este ID.' });
        }
        if (!region.areas) region.areas = {};
        await db.collection('Regiones').insertOne(region);
        res.json({ success: true, message: 'Región creada exitosamente.', region });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno creando región' });
    }
});

// PUT /api/admin/regiones/:id (Actualizar región completa o parcial con operaciones atómicas)
app.put('/api/admin/regiones/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    try {
        const { id } = req.params;
        const { region, updateQuery } = req.body;
        const db = clientdb.db(dbname);
        const collection = db.collection('Regiones');

        const target = await collection.findOne({ _id: id });
        if (!target) {
            return res.status(404).json({ error: 'Región no encontrada.' });
        }

        if (updateQuery && typeof updateQuery === 'object') {
            // Operación atómica de MongoDB ($set, $unset, etc.)
            await collection.updateOne({ _id: id }, updateQuery);
        } else if (region) {
            region._id = id;
            await collection.replaceOne({ _id: id }, region);
        } else {
            return res.status(400).json({ error: 'No se enviaron datos para actualizar.' });
        }

        const updatedDoc = await collection.findOne({ _id: id });
        res.json({ success: true, message: 'Región actualizada exitosamente.', region: updatedDoc });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno actualizando región' });
    }
});

// DELETE /api/admin/regiones/:id (Eliminar región)
app.delete('/api/admin/regiones/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    try {
        const { id } = req.params;
        const db = clientdb.db(dbname);
        await db.collection('Regiones').deleteOne({ _id: id });
        res.json({ success: true, message: 'Región eliminada exitosamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno eliminando región' });
    }
});

// ==========================================
// ENDPOINTS DE ADMINISTRACIÓN: DIÁLOGOS
// ==========================================

// GET /api/admin/dialogos (Obtener todos los eventos de diálogo)
app.get('/api/admin/dialogos', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    try {
        const db = clientdb.db(dbname);
        const col = db.collection('Dialogos');
        let docs = await col.find({}).toArray();

        // Si la colección está vacía, migrar automáticamente los archivos JSON predeterminados
        if (docs.length === 0) {
            const fs = require('fs');
            const path = require('path');
            const dialogosDir = path.join(__dirname, 'data', 'dialogos');
            const defaultDocs = [];

            if (fs.existsSync(dialogosDir)) {
                const files = fs.readdirSync(dialogosDir);
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        try {
                            const raw = fs.readFileSync(path.join(dialogosDir, file), 'utf8');
                            const parsed = JSON.parse(raw);
                            const items = Array.isArray(parsed) ? parsed : [parsed];
                            for (const item of items) {
                                const idVal = item._id || item.id || item.ID;
                                if (idVal && !defaultDocs.some(d => d._id === idVal)) {
                                    defaultDocs.push({
                                        _id: String(idVal),
                                        requisitos: item.requisitos || null,
                                        limite: item.limite || 0,
                                        canal: item.canal || { Objetivo: 'MD', ID: null },
                                        mensajeMDPersonalizado: item.mensajeMDPersonalizado || null,
                                        cooldownEspera: item.cooldownEspera || 5,
                                        dialogos: Array.isArray(item.dialogos) ? item.dialogos : []
                                    });
                                }
                            }
                        } catch (e) {
                            console.error(`Error migrando ${file}:`, e.message);
                        }
                    }
                }
            }

            if (defaultDocs.length > 0) {
                await col.insertMany(defaultDocs);
                docs = await col.find({}).toArray();
                console.log(`[Server] Se migraron ${defaultDocs.length} eventos de diálogo a la colección Rol_db.Dialogos`);
            }
        }

        res.json(docs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error obteniendo eventos de diálogo' });
    }
});

// GET /api/admin/dialogos/:id (Obtener un evento específico)
app.get('/api/admin/dialogos/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    try {
        const db = clientdb.db(dbname);
        const doc = await db.collection('Dialogos').findOne({ _id: req.params.id });
        if (!doc) return res.status(404).json({ error: 'Diálogo no encontrado' });
        res.json(doc);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error obteniendo evento de diálogo' });
    }
});

// POST /api/admin/dialogos (Crear nuevo diálogo)
app.post('/api/admin/dialogos', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    try {
        const { _id, requisitos, limite, canal, mensajeMDPersonalizado, cooldownEspera, dialogos } = req.body;
        if (!_id) return res.status(400).json({ error: 'El ID del evento es obligatorio.' });

        const db = clientdb.db(dbname);
        const col = db.collection('Dialogos');

        const existe = await col.findOne({ _id: String(_id) });
        if (existe) return res.status(400).json({ error: `Ya existe un diálogo con el ID '${_id}'.` });

        const nuevoDoc = {
            _id: String(_id),
            requisitos: requisitos || null,
            limite: Number(limite) || 0,
            canal: canal || { Objetivo: 'MD', ID: null },
            mensajeMDPersonalizado: mensajeMDPersonalizado ? String(mensajeMDPersonalizado).slice(0, 200) : null,
            cooldownEspera: Math.min(20, Math.max(0, Number(cooldownEspera) || 0)),
            dialogos: Array.isArray(dialogos) ? dialogos : []
        };

        await col.insertOne(nuevoDoc);
        try {
            const dialogoManager = require('./functions/dialogoManager');
            dialogoManager.refrescarDialogoLocal(nuevoDoc._id, nuevoDoc);
        } catch (e) { console.error('Error refrescando dialogoManager local:', e.message); }

        res.json({ success: true, message: 'Diálogo creado exitosamente.', data: nuevoDoc });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error creando evento de diálogo' });
    }
});

// PUT /api/admin/dialogos/:id (Editar diálogo existente)
app.put('/api/admin/dialogos/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    try {
        const { id } = req.params;
        const { requisitos, limite, canal, mensajeMDPersonalizado, cooldownEspera, dialogos } = req.body;

        const db = clientdb.db(dbname);
        const col = db.collection('Dialogos');

        const updateFields = {
            requisitos: requisitos !== undefined ? requisitos : null,
            limite: Number(limite) || 0,
            canal: canal || { Objetivo: 'MD', ID: null },
            mensajeMDPersonalizado: mensajeMDPersonalizado ? String(mensajeMDPersonalizado).slice(0, 200) : null,
            cooldownEspera: Math.min(20, Math.max(0, Number(cooldownEspera) || 0)),
            dialogos: Array.isArray(dialogos) ? dialogos : []
        };

        const result = await col.updateOne({ _id: id }, { $set: updateFields });
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Diálogo no encontrado.' });

        try {
            const dialogoManager = require('./functions/dialogoManager');
            dialogoManager.refrescarDialogoLocal(id, { _id: id, ...updateFields });
        } catch (e) { console.error('Error refrescando dialogoManager local:', e.message); }

        res.json({ success: true, message: 'Diálogo actualizado exitosamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error actualizando evento de diálogo' });
    }
});

// DELETE /api/admin/dialogos/:id (Eliminar diálogo)
app.delete('/api/admin/dialogos/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    try {
        const { id } = req.params;
        const db = clientdb.db(dbname);
        await db.collection('Dialogos').deleteOne({ _id: id });

        try {
            const dialogoManager = require('./functions/dialogoManager');
            dialogoManager.eliminarDialogoLocal(id);
        } catch (e) { console.error('Error eliminando en dialogoManager local:', e.message); }

        res.json({ success: true, message: 'Diálogo eliminado exitosamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error eliminando evento de diálogo' });
    }
});

// Devuelve los datos del usuario y su personaje si hay sesión activa
app.get('/api/me', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    try {
        const db = clientdb.db(dbname);
        const perfilExistente = await db.collection("Personajes").findOne({ ownerID: req.session.user.id });
        if (perfilExistente) {
            const ahora = Math.floor(Date.now() / 1000);
            const proximaDisponible = perfilExistente?.cooldowns?.recompensa_diaria?.nuevaReclamacion || 0;
            let soulExistente = await db.collection("Soul").findOne({ _id: perfilExistente._id });

            // Recargar energía dinámicamente según tiempo transcurrido
            let energiaFinal = soulExistente?.nucleo?.energy ?? 0;
            if (soulExistente) {
                const { recargarEnergia } = require("./functions/dataCharacters.js");
                energiaFinal = await recargarEnergia(energiaFinal, soulExistente);
            }

            // Verificar y crear notificación de rol de recompensa diaria si está disponible
            if (ahora >= proximaDisponible) {
                const notificaciones = perfilExistente.notificaciones || [];
                const tieneNotifRecompensaActiva = notificaciones.some(n => n.tipo === 'recompensa_diaria' && !n.leida);
                if (!tieneNotifRecompensaActiva) {
                    const { agregarNotificacionRol } = require("./utils/notificaciones");
                    await agregarNotificacionRol(
                        req.session.user.id,
                        'recompensa_diaria',
                        '🎁 Recompensa Diaria',
                        'Tu recompensa diaria está lista. Usa el comando /recompensa_diaria en Discord para reclamarla.',
                        null,
                        clientdb,
                        dbname
                    );
                }
            }

            req.session.personaje = {
                nombre: perfilExistente.perfil.Nombre,
                rol: perfilExistente.perfil.Rol ?? 'Estudiante',
                reputacion: perfilExistente.perfil.Reputacion ?? 0,
                grado: perfilExistente.perfil.Grado ?? 'F',
                fechaCreacion: perfilExistente.metadata.fechaCreacion ?? new Date().toISOString(),
                energia: energiaFinal,
                energiaMax: config.maxEnergy ?? 140,
                regeneracionMinutos: config.regeneracionMinutos ?? 10,
                lastEnergyUpdate: soulExistente?.nucleo?.lastEnergyUpdate ?? 0,
                lugarExploracion: perfilExistente.perfil.UltimoLugar ?? 'Ninguno',
                Historia: perfilExistente.perfil.Historia ?? '',
                avatarURL: perfilExistente.perfil.avatarURL ?? '',
                recompensaReclamada: ahora < proximaDisponible
            };
        }
        res.json({
            user: req.session.user,
            personaje: req.session.personaje || null
        });
    } catch (err) {
        console.error("Error en /api/me:", err);
        res.status(500).json({ error: "Error interno" });
    }
});

// GET /api/personaje/activo - Obtiene el personaje activo del jugador según usuarios_server / Personajes / Soul
app.get('/api/personaje/activo', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    try {
        const discordID = String(req.session.user.id);
        const dbServer = clientdb.db(dbserverName || "Server_db");
        const dbRol = clientdb.db("Rol_db");

        // 1. Buscar en usuarios_server para obtener personajeActivo
        const usuarioServer = await dbServer.collection("usuarios_server").findOne({ _id: discordID });
        let personajeId = usuarioServer?.usuario?.nix?.personajeActivo;

        let charDoc = null;
        if (personajeId !== undefined && personajeId !== null) {
            charDoc = await dbRol.collection("Personajes").findOne({ _id: Number(personajeId) });
            if (!charDoc) {
                charDoc = await dbRol.collection("Personajes").findOne({ _id: String(personajeId) });
            }
        }

        // 2. Si no se encuentra por personajeActivo, buscar primer personaje por ownerID
        if (!charDoc) {
            charDoc = await dbRol.collection("Personajes").findOne({ ownerID: discordID });
        }

        if (!charDoc) {
            return res.status(404).json({ error: 'No se encontró personaje activo' });
        }

        // Cargar Soul correspondiente
        const soulDoc = await dbRol.collection("Soul").findOne({ _id: charDoc._id });
        if (soulDoc) {
            charDoc.soul = soulDoc;
        }

        res.json({
            success: true,
            personaje: charDoc
        });
    } catch (err) {
        console.error("Error en /api/personaje/activo:", err);
        res.status(500).json({ error: "Error interno al obtener personaje activo" });
    }
});

// Cierra sesión (elimina sesión de MongoDB y destruye la cookie)
const handleLogout = (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                console.error('Error al destruir la sesión:', err);
                return res.status(500).send('No se pudo cerrar sesión.');
            }
            res.clearCookie('connect.sid');
            res.redirect('http://localhost:5500/index.html');
        });
    } else {
        res.clearCookie('connect.sid');
        res.redirect('http://localhost:5500/index.html');
    }
};

app.get('/api/auth/logout', handleLogout);
app.get('/api/logout', handleLogout);

// POST /api/combat/create-room
app.post('/api/combat/create-room', async (req, res) => {
    const transaccionCache = require("./utils/cache");
    const { duelSystem } = require("./functions/Duelo/duelManager");
    const { buildSalaMessage } = require("./functions/Duelo/combateUI");
    const verificarCondiciones = require("./functions/Duelo/verificarCondiciones");

    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'El bot de Discord no está listo aún' });

    const personajeIdRaw = req.body.personajeId;
    if (!personajeIdRaw) return res.status(400).json({ error: 'No se especificó personajeId' });

    const personajeId = Number(personajeIdRaw);
    const { nombreSala, privacidad, limiteEquipo1, limiteEquipo2, apuestasOn, lumensActivo, lumensValor, objetosApuesta, imageSala, tipoApuesta, adminObjetos, adminLumens } = req.body;

    try {
        const dbServer = clientdb.db("Server_db");
        const dbRol = clientdb.db(dbname);

        // Validar pertenencia del personaje
        const usuario = await dbServer.collection("usuarios_server").findOne({ _id: req.session.user.id });
        if (!usuario || !usuario.nix || !usuario.nix.personajes) {
            return res.status(403).json({ error: 'No tienes personajes autorizados' });
        }

        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        
        const esBooster = member ? member.roles.cache.has("796205038665072661") : false;
        const tieneRolEspecial = member ? (member.roles.cache.has("810198633705766962") || member.roles.cache.has("737058095599058995")) : false;
        const esDonador = usuario && (usuario.donadores === true || usuario.donador === true);

        const ROLES_ADMIN = ['737058095599058995', '746581152717865041'];
        const esAdmin = member ? ROLES_ADMIN.some(r => member.roles.cache.has(r)) : false;

        if (adminObjetos || adminLumens || (apuestasOn && tipoApuesta === 'libre')) {
            if (!esAdmin) {
                if (tipoApuesta === 'libre' && !esBooster && !tieneRolEspecial && !esDonador) {
                    return res.status(403).json({ error: 'Permisos insuficientes' });
                }
                if (adminObjetos || adminLumens) {
                    return res.status(403).json({ error: 'Permisos insuficientes' });
                }
            } else {
                const tokenType = (apuestasOn && tipoApuesta === 'libre') ? 'apuestas_libre' : 'economia';
                const tokenCheck = await verificarYConsumirTokenAdmin(req.session.user.id, dbServer, tokenType);
                if (!tokenCheck.ok) {
                    return res.status(403).json({ error: 'Permisos insuficientes' });
                }
            }
        }

        // Validar permisos para tipo de apuesta "libre" (Entrada Libre)
        if (apuestasOn && tipoApuesta === 'libre') {
            if (!esBooster && !tieneRolEspecial && !esDonador) {
                return res.status(403).json({ error: 'No tienes permisos para crear salas con tipo de apuesta "Entrada Libre". Esta opción es exclusiva para Boosters, Donadores y roles especiales.' });
            }
        }

        // Validar enlace de imagen si fue proporcionado
        if (imageSala && imageSala.trim() !== '') {
            const puedeSubirImagen = esBooster || tieneRolEspecial || esDonador;

            if (!puedeSubirImagen) {
                return res.status(403).json({ error: 'No tienes permisos para agregar una imagen a la sala. Esta opción es exclusiva para Boosters, Donadores y roles autorizados.' });
            }

            const isGif = /\.(gif)(?:\?.*)?$/i.test(imageSala);
            if (isGif) {
                const puedeSubirGif = tieneRolEspecial || esDonador;
                if (!puedeSubirGif) {
                    return res.status(403).json({ error: 'No tienes permisos para agregar imágenes animadas (GIF) a la sala. Esta opción es exclusiva para Donadores y los roles de soporte 810198633705766962 / 737058095599058995.' });
                }
            }

            const allowedExtensions = isGif ? ['png', 'jpg', 'jpeg', 'webp', 'gif'] : ['png', 'jpg', 'jpeg', 'webp'];
            const urlPattern = new RegExp(`^(https?:\\/\\/.*\\.(?:${allowedExtensions.join('|')}))(?:\\?.*)?$`, 'i');
            if (!urlPattern.test(imageSala)) {
                return res.status(400).json({ error: `El enlace de la imagen no es válido. Debe ser un link directo que termine en ${allowedExtensions.map(e => '.' + e).join(', ')}.` });
            }
        }

        const tienePersonaje = usuario.nix.personajes.some(p => {
            const pid = typeof p.id !== 'undefined' ? Number(p.id) : Number(p._id);
            return pid === personajeId;
        });

        if (!tienePersonaje) {
            return res.status(403).json({ error: 'El personaje no te pertenece' });
        }

        // Cargar personaje y alma frescos
        const character = await dbRol.collection("Personajes").findOne({ _id: personajeId });
        const soul = await dbRol.collection("Soul").findOne({ _id: personajeId });

        if (!character || !soul) {
            return res.status(404).json({ error: 'Personaje o alma no encontrados' });
        }

        // Verificar condiciones usando verificarCondiciones
        const cond = verificarCondiciones(character, soul);
        if (!cond.puede) {
            return res.status(400).json({ error: cond.razon });
        }

        // Verificar que no tenga ya un estado de sala activo en el cache local
        const statusActual = transaccionCache.getStatus(personajeId);
        if (statusActual && statusActual.status) {
            return res.status(400).json({ error: 'Tu personaje ya está en una sala de combate activa' });
        }

        // Estructura de characterData con la misma exclusión
        const { aspiracion, Historia, Cumpleaños, Peso, Estatura, Descripcion, Familia, CiudadOrg, Sexo, ...infoperfil } = character.perfil;
        const { XP, energy, lastEnergyUpdate, energiaAlmica, ...infoNucleo } = soul.nucleo;
        const { hilosLunares, StelarFragments, ...infoSendero } = soul.sendero;

        const characterData = {
            ownerId: req.session.user.id,
            perfil: infoperfil,
            social: { compañero: character.social?.compañero, team: character.social?.team },
            nucleo: infoNucleo,
            stats: soul.stats,
            dominio: soul.dominio,
            sendero: infoSendero
        };

        const limitTeam1 = Number(limiteEquipo1) || 1;
        const limitTeam2 = Number(limiteEquipo2) || 1;
        const codeSala = await duelSystem.createCode(6);
        const modoDuelo = `${limitTeam1} vs ${limitTeam2}`;

        // Obtener objeto Discord User del autor
        const userDiscord = await client.users.fetch(req.session.user.id).catch(() => null);
        if (!userDiscord) {
            return res.status(500).json({ error: 'No se pudo obtener el usuario de Discord' });
        }

        // Construir mensajes
        const payloadApuestas = {
            lumens: (apuestasOn && lumensActivo) ? lumensValor : 0,
            objetos: apuestasOn ? (objetosApuesta || []).filter(o => o.id) : [],
            adminLumens: !!adminLumens,
            adminObjetos: !!adminObjetos
        };

        // Congelar recursos del creador (excepto si fue creada usando administrador)

        if (apuestasOn) {
            const congelarHelper = require("./functions/Economia/congelarHelper");
            const lumensAFreeze = adminLumens ? 0 : (payloadApuestas.lumens || 0);
            const objetosAFreeze = adminObjetos ? [] : (payloadApuestas.objetos || []).map(o => ({ id: o.id, nombre: o.nombre, cantidad: o.cantidad }));
            
            if (lumensAFreeze > 0 || objetosAFreeze.length > 0) {
                const congeladoOk = await congelarHelper.congelar(personajeId, lumensAFreeze, objetosAFreeze);
                if (!congeladoOk) {
                    return res.status(400).json({ error: 'No tienes suficientes lumens u objetos en tu inventario para cubrir la apuesta configurada.' });
                }
            }
        }

        const messages = buildSalaMessage(userDiscord, privacidad === 'privada', {
            character,
            soul,
            codeSala,
            nombreSala,
            modoDuelo,
            imageSala: imageSala || null,
            apuestas: payloadApuestas,
            tipoApuesta: apuestasOn ? (tipoApuesta || 'espejo') : null
        });

        // Enviar serverMessage al canal
        const channel = await client.channels.fetch("1434739977291567215").catch(() => null);
        let messageS = null;
        if (channel) {
            messageS = await channel.send({ components: messages.serverMessage, flags: ["IsComponentsV2"] }).catch(err => {
                console.error("Error al enviar mensaje al canal global:", err);
                return null;
            });
        }

        // Enviar salaMessage por DM
        let dmEnviado = true;
        let messageA = null;
        try {
            messageA = await userDiscord.send({ components: messages.salaMessage, flags: ["IsComponentsV2"] });
        } catch (err) {
            console.error("Error al enviar DM al autor:", err);
            dmEnviado = false;
        }

        const messageServer = messageS ? {
            guild: messageS.guildId,
            channel: messageS.channelId,
            message: messageS.id
        } : null;

        const messageAutor = messageA ? {
            guild: messageA.guildId,
            channel: messageA.channelId,
            message: messageA.id
        } : null;

        const dataSala = {
            autor: req.session.user.id,
            autorCharacter: characterData.perfil.Nombre,
            duelType: 'PvP',
            team1: { [personajeId]: characterData },
            team2: {},
            limitTeam1,
            limitTeam2,
            code: codeSala,
            nombreSala,
            imageSala: imageSala || null,
            isPrivate: privacidad === 'privada',
            isNPC: false,
            estado: 'En espera...',
            creado: Math.floor(Date.now() / 1000),
            apuestas: payloadApuestas,
            tipoApuesta: apuestasOn ? (tipoApuesta || 'espejo') : null,
            messageAutor,
            messageServer
        };

        // Guardar en cache con expiración
        await transaccionCache.set(codeSala, dataSala, () => {
            const todosLosPersonajes = [
                ...Object.keys(dataSala.team1),
                ...Object.keys(dataSala.team2)
            ];
            todosLosPersonajes.forEach(characterId => {
                transaccionCache.deleteStatus(Number(characterId));
            });
            console.log(`Sala ${codeSala} expiró (creada vía web), personajes liberados`);
        });

        // Bloquear status del personaje
        await transaccionCache.setStatus(personajeId, { code: 1, salaCode: codeSala, Nombre: "En sala" }, { active: true, time: 3000 });

        req.session.personajeCombateId = personajeId; // Guardar en sesión para consultas futuras
        res.json({ ok: true, codeSala, dmEnviado });

    } catch (error) {
        console.error("Error al crear sala:", error);
        res.status(500).json({ error: 'Error interno del servidor al crear la sala' });
    }
});

// POST /api/combat/create-npc-room
app.post('/api/combat/create-npc-room', async (req, res) => {
    const transaccionCache = require("./utils/cache");
    const { duelSystem } = require("./functions/Duelo/duelManager");
    const verificarCondiciones = require("./functions/Duelo/verificarCondiciones");

    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'El bot de Discord no está listo aún' });

    const personajeIdRaw = req.body.personajeId;
    if (!personajeIdRaw) return res.status(400).json({ error: 'No se especificó personajeId' });
    const personajeId = Number(personajeIdRaw);

    try {
        const dbServer = clientdb.db("Server_db");
        const dbRol = clientdb.db(dbname);

        // Validar pertenencia del personaje
        const usuario = await dbServer.collection("usuarios_server").findOne({ _id: req.session.user.id });
        if (!usuario || !usuario.nix || !usuario.nix.personajes) {
            return res.status(403).json({ error: 'No tienes personajes autorizados' });
        }

        const tienePersonaje = usuario.nix.personajes.some(p => {
            const pid = typeof p.id !== 'undefined' ? Number(p.id) : Number(p._id);
            return pid === personajeId;
        });

        if (!tienePersonaje) {
            return res.status(403).json({ error: 'El personaje no te pertenece' });
        }

        // Cargar personaje y alma
        const character = await dbRol.collection("Personajes").findOne({ _id: personajeId });
        const soul = await dbRol.collection("Soul").findOne({ _id: personajeId });

        if (!character || !soul) {
            return res.status(404).json({ error: 'Personaje o alma no encontrados' });
        }

        // Verificar condiciones
        const cond = verificarCondiciones(character, soul);
        if (!cond.puede) {
            return res.status(400).json({ error: cond.razon });
        }

        // Verificar sala activa
        const statusActual = transaccionCache.getStatus(personajeId);
        if (statusActual && statusActual.status) {
            return res.status(400).json({ error: 'Tu personaje ya está en una sala de combate activa' });
        }

        const { aspiracion, Historia, Cumpleaños, Peso, Estatura, Descripcion, Familia, CiudadOrg, Sexo, ...infoperfil } = character.perfil;
        const { XP, energy, lastEnergyUpdate, energiaAlmica, ...infoNucleo } = soul.nucleo;
        const { hilosLunares, StelarFragments, ...infoSendero } = soul.sendero;

        const characterData = {
            ownerId: req.session.user.id,
            perfil: infoperfil,
            social: { compañero: character.social?.compañero, team: character.social?.team },
            nucleo: infoNucleo,
            stats: soul.stats,
            dominio: soul.dominio,
            sendero: infoSendero
        };

        const codeSala = await duelSystem.createCode(6);
        const { buildSalaMessage } = require("./functions/Duelo/combateUI");
        const userDiscord = await client.users.fetch(req.session.user.id).catch(() => null);

        let messageS = null;
        let messageA = null;
        let dmEnviado = true;

        const dataSalaTemp = {
            autor: req.session.user.id,
            autorCharacter: characterData.perfil.Nombre,
            duelType: 'NPC',
            team1: { [personajeId]: characterData },
            team2: {},
            limitTeam1: 10,
            limitTeam2: 10,
            code: codeSala,
            nombreSala: `${characterData.perfil.Nombre} vs NPCs`,
            imageSala: null,
            isPrivate: true,
            isNPC: true,
            modeTest: true,
            estado: 'Configurando NPCs...',
            npcLobbyStarted: false,
            creado: Math.floor(Date.now() / 1000),
            apuestas: { lumens: 0, objetos: [], adminLumens: false, adminObjetos: false },
            tipoApuesta: null
        };

        if (userDiscord) {
            const messages = buildSalaMessage(userDiscord, true, {
                ...dataSalaTemp,
                character,
                soul
            });

            // Enviar serverMessage al canal global (1434739977291567215)
            const channelGlobal = await client.channels.fetch("1434739977291567215").catch(() => null);
            if (channelGlobal) {
                messageS = await channelGlobal.send({ components: messages.serverMessage, flags: ["IsComponentsV2"] }).catch(err => {
                    console.error("Error al enviar mensaje de sala NPC al canal global:", err);
                    return null;
                });
            }

            try {
                messageA = await userDiscord.send({ components: messages.salaMessage, flags: ["IsComponentsV2"] });
            } catch (err) {
                console.error("Error al enviar DM al autor de sala NPC:", err);
                dmEnviado = false;
            }
        }

        const messageAutor = messageA ? {
            guild: messageA.guildId,
            channel: messageA.channelId,
            message: messageA.id
        } : null;

        const messageServer = messageS ? {
            guild: messageS.guildId,
            channel: messageS.channelId,
            message: messageS.id
        } : null;

        const dataSala = {
            ...dataSalaTemp,
            messageAutor,
            messageServer
        };

        // Guardar en cache con expiración
        await transaccionCache.set(codeSala, dataSala, () => {
            const todosLosPersonajes = [
                ...Object.keys(dataSala.team1),
                ...Object.keys(dataSala.team2)
            ];
            todosLosPersonajes.forEach(characterId => {
                if (!isNaN(characterId)) {
                    transaccionCache.deleteStatus(Number(characterId));
                }
            });
            console.log(`Sala NPC ${codeSala} expiró, personajes liberados`);
        });

        // Bloquear status del personaje
        await transaccionCache.setStatus(personajeId, { code: 1, salaCode: codeSala, Nombre: "En sala" }, { active: true, time: 3000 });

        req.session.personajeCombateId = personajeId;
        res.json({ ok: true, codeSala, sala: dataSala, dmEnviado });

    } catch (error) {
        console.error("Error al crear sala NPC:", error);
        res.status(500).json({ error: 'Error interno del servidor al crear la sala' });
    }
});

// GET /api/combat/npc-choices
app.get('/api/combat/npc-choices', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    const personajeIdRaw = req.query.personajeId;
    if (!personajeIdRaw) return res.status(400).json({ error: 'Falta personajeId' });
    const personajeId = Number(personajeIdRaw);

    try {
        const dbRol = clientdb.db(dbname);
        const character = await dbRol.collection("Personajes").findOne({ _id: personajeId });
        if (!character) return res.status(404).json({ error: 'Personaje no encontrado' });

        const npcsDefeated = character.registros?.npcDefeat || [];

        // Fetch all NPCs from NPCs collection
        const npcs = await dbRol.collection("NPCs").find({}).toArray();

        res.json({
            npcsDefeated,
            allNpcs: npcs
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// POST /api/combat/room/:code/update-npc-teams
app.post('/api/combat/room/:code/update-npc-teams', async (req, res) => {
    const transaccionCache = require("./utils/cache");
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });

    const code = req.params.code;
    const sala = transaccionCache.get(code);
    if (!sala) return res.status(404).json({ error: 'Sala no encontrada' });
    if (!sala.isNPC) return res.status(400).json({ error: 'La sala no es una sala contra NPCs' });
    if (sala.autor !== req.session.user.id) return res.status(403).json({ error: 'No tienes permisos para modificar esta sala' });

    const { team1List, team2List, modeTest } = req.body;
    if (!Array.isArray(team1List) || !Array.isArray(team2List)) {
        return res.status(400).json({ error: 'Estructuras de equipo no válidas' });
    }

    try {
        const dbRol = clientdb.db(dbname);
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        const ROLES_ADMIN = ['737058095599058995', '746581152717865041'];
        const esAdmin = member ? ROLES_ADMIN.some(r => member.roles.cache.has(r)) : false;

        // Count NPCs
        const npc1Count = team1List.filter(e => e.isNPC).length;
        const npc2Count = team2List.filter(e => e.isNPC).length;
        const totalNpcs = npc1Count + npc2Count;

        if (esAdmin) {
            if (team1List.length > 10) return res.status(400).json({ error: 'El equipo aliado no puede superar los 10 integrantes.' });
            if (team2List.length > 10) return res.status(400).json({ error: 'El equipo enemigo no puede superar los 10 integrantes.' });
        } else {
            if (totalNpcs > 4) return res.status(400).json({ error: 'Límite excedido: Sin modo administrador activo, el máximo de NPCs añadibles en total es 4.' });
            if (team1List.length > 10) return res.status(400).json({ error: 'El equipo aliado no puede superar los 10 integrantes.' });
            if (team2List.length > 10) return res.status(400).json({ error: 'El equipo enemigo no puede superar los 10 integrantes.' });
        }

        const newTeam1 = {};
        const newTeam2 = {};

        const allNpcIds = [...new Set([...team1List.filter(e => e.isNPC).map(e => e.id), ...team2List.filter(e => e.isNPC).map(e => e.id)])];
        const npcDocs = await dbRol.collection("NPCs").find({ _id: { $in: allNpcIds } }).toArray();
        const npcDocsMap = new Map(npcDocs.map(n => [n._id, n]));

        for (let i = 0; i < team1List.length; i++) {
            const entry = team1List[i];
            if (entry.isNPC) {
                const doc = npcDocsMap.get(entry.id);
                if (!doc) return res.status(400).json({ error: `NPC ${entry.id} no encontrado en la base de datos.` });
                const npcKey = `${entry.id}_aliado_${i}`;
                newTeam1[npcKey] = { ...doc, isNPC: true };
            } else {
                const charId = Number(entry.id);
                const existing = sala.team1[charId] || sala.team2[charId];
                if (existing) {
                    newTeam1[charId] = existing;
                } else {
                    return res.status(400).json({ error: `El jugador ${charId} no forma parte de esta sala.` });
                }
            }
        }

        for (let i = 0; i < team2List.length; i++) {
            const entry = team2List[i];
            if (entry.isNPC) {
                const doc = npcDocsMap.get(entry.id);
                if (!doc) return res.status(400).json({ error: `NPC ${entry.id} no encontrado en la base de datos.` });
                const npcKey = `${entry.id}_enemigo_${i}`;
                newTeam2[npcKey] = { ...doc, isNPC: true };
            } else {
                const charId = Number(entry.id);
                const existing = sala.team1[charId] || sala.team2[charId];
                if (existing) {
                    newTeam2[charId] = existing;
                } else {
                    return res.status(400).json({ error: `El jugador ${charId} no forma parte de esta sala.` });
                }
            }
        }

        // Preservar cualquier jugador real que ya se haya unido a team1 o team2
        Object.entries(sala.team1 || {}).forEach(([charId, data]) => {
            if (!data.isNPC && !isNaN(charId)) {
                const idNum = Number(charId);
                if (!newTeam1[idNum] && !newTeam2[idNum]) {
                    newTeam1[idNum] = data;
                }
            }
        });

        Object.entries(sala.team2 || {}).forEach(([charId, data]) => {
            if (!data.isNPC && !isNaN(charId)) {
                const idNum = Number(charId);
                if (!newTeam1[idNum] && !newTeam2[idNum]) {
                    newTeam2[idNum] = data;
                }
            }
        });

        sala.team1 = newTeam1;
        sala.team2 = newTeam2;

        if (esAdmin && typeof modeTest !== 'undefined') {
            sala.modeTest = !!modeTest;
        } else {
            sala.modeTest = true;
        }

        // Actualizar mensajes en Discord si existen
        if (sala.messageAutor && sala.messageAutor.channel && sala.messageAutor.message) {
            try {
                const userDiscord = await client.users.fetch(sala.autor).catch(() => null);
                if (userDiscord) {
                    const { buildSalaMessage } = require("./functions/Duelo/combateUI");
                    const messages = buildSalaMessage(userDiscord, sala.isPrivate, sala);
                    const channelA = await client.channels.fetch(sala.messageAutor.channel).catch(() => null);
                    if (channelA) {
                        const msgA = await channelA.messages.fetch(sala.messageAutor.message).catch(() => null);
                        if (msgA) await msgA.edit({ components: messages.salaMessage }).catch(() => null);
                    }
                    if (sala.messageServer && sala.messageServer.channel && sala.messageServer.message) {
                        const channelS = await client.channels.fetch(sala.messageServer.channel).catch(() => null);
                        if (channelS) {
                            const msgS = await channelS.messages.fetch(sala.messageServer.message).catch(() => null);
                            if (msgS) await msgS.edit({ components: messages.serverMessage }).catch(() => null);
                        }
                    }
                }
            } catch (errEdit) {
                console.warn("No se pudieron actualizar los mensajes de Discord:", errEdit);
            }
        }

        transaccionCache.set(code, sala);
        res.json({ ok: true, sala });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno al actualizar la sala' });
    }
});

// POST /api/combat/room/:code/start-npc-lobby
app.post('/api/combat/room/:code/start-npc-lobby', async (req, res) => {
    const transaccionCache = require("./utils/cache");
    const { buildSalaMessage } = require("./functions/Duelo/combateUI");
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });

    const code = req.params.code;
    const sala = transaccionCache.get(code);
    if (!sala) return res.status(404).json({ error: 'Sala no encontrada' });
    if (!sala.isNPC) return res.status(400).json({ error: 'La sala no es una sala contra NPCs' });
    if (sala.autor !== req.session.user.id) return res.status(403).json({ error: 'No tienes permisos para modificar esta sala' });

    if (Object.keys(sala.team2).length === 0) {
        return res.status(400).json({ error: 'Debes añadir al menos un NPC enemigo antes de iniciar el combate.' });
    }

    try {
        const dbRol = clientdb.db(dbname);
        const creatorId = Number(Object.keys(sala.team1).find(k => !isNaN(k)));
        const character = await dbRol.collection("Personajes").findOne({ _id: creatorId });
        const soul = await dbRol.collection("Soul").findOne({ _id: creatorId });

        sala.estado = "En espera...";
        sala.npcLobbyStarted = true;

        const userDiscord = await client.users.fetch(sala.autor).catch(() => null);
        if (!userDiscord) {
            return res.status(500).json({ error: 'No se pudo obtener el usuario de Discord' });
        }

        const messages = buildSalaMessage(userDiscord, sala.isPrivate, {
            ...sala,
            character,
            soul
        });

        // Actualizar o enviar mensaje por DM
        let dmEnviado = true;
        if (sala.messageAutor && sala.messageAutor.channel && sala.messageAutor.message) {
            try {
                const channelA = await client.channels.fetch(sala.messageAutor.channel).catch(() => null);
                if (channelA) {
                    const msgA = await channelA.messages.fetch(sala.messageAutor.message).catch(() => null);
                    if (msgA) await msgA.edit({ components: messages.salaMessage }).catch(() => null);
                }
            } catch (e) {
                console.error("Error al actualizar DM:", e);
            }
        } else {
            try {
                const messageA = await userDiscord.send({ components: messages.salaMessage, flags: ["IsComponentsV2"] });
                sala.messageAutor = {
                    guild: messageA.guildId,
                    channel: messageA.channelId,
                    message: messageA.id
                };
            } catch (err) {
                console.error("Error al enviar DM al autor:", err);
                dmEnviado = false;
            }
        }

        transaccionCache.set(code, sala);
        res.json({ ok: true, dmEnviado, codeSala: code });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno al iniciar la sala contra NPCs' });
    }
});

// GET /api/combat/active-room
app.get('/api/combat/active-room', async (req, res) => {
    const transaccionCache = require("./utils/cache");
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });

    try {
        const dbServer = clientdb.db("Server_db");
        const usuario = await dbServer.collection("usuarios_server").findOne({ _id: req.session.user.id });
        if (!usuario || !usuario.nix || !usuario.nix.personajes) {
            return res.json(null);
        }

        const ids = usuario.nix.personajes.map(p => typeof p.id !== 'undefined' ? Number(p.id) : Number(p._id));

        for (const personajeId of ids) {
            const statusObj = transaccionCache.getStatus(personajeId);
            if (statusObj && statusObj.status && statusObj.status.salaCode) {
                const code = statusObj.status.salaCode;
                const sala = transaccionCache.get(code);
                if (sala) {
                    req.session.personajeCombateId = personajeId; // Sincronizar el id en la sesión
                    return res.json({
                        code: sala.code,
                        creado: sala.creado,
                        estado: sala.estado,
                        limitTeam1: sala.limitTeam1,
                        limitTeam2: sala.limitTeam2,
                        nombreSala: sala.nombreSala,
                        isNPC: !!sala.isNPC,
                        modeTest: !!sala.modeTest,
                        team1: sala.team1,
                        team2: sala.team2
                    });
                }
            }
        }
        res.json(null);
    } catch (error) {
        console.error("Error al obtener sala activa:", error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/combat/rooms
// Devuelve todas las salas activas en el sistema (solo para admins)
app.get('/api/combat/rooms', async (req, res) => {
    const transaccionCache = require("./utils/cache");
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });

    try {
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        const userRoles = member ? member.roles.cache.map(r => r.id) : [];
        const ROLES_ADMIN = ['737058095599058995', '746581152717865041'];
        const esAdmin = ROLES_ADMIN.some(r => userRoles.includes(r));

        if (!esAdmin) {
            return res.status(403).json({ error: 'No tienes permisos de administrador.' });
        }

        const salas = Array.from(transaccionCache.cache.values()).map(sala => ({
            code: sala.code,
            autor: sala.autor,
            autorCharacter: sala.autorCharacter,
            nombreSala: sala.nombreSala,
            estado: sala.estado,
            limitTeam1: sala.limitTeam1,
            limitTeam2: sala.limitTeam2,
            isPrivate: sala.isPrivate,
            creado: sala.creado,
            imageSala: sala.imageSala,
            apuestas: sala.apuestas,
            tipoApuesta: sala.tipoApuesta,
            team1: Object.values(sala.team1 || {}).map(ch => ({
                Nombre: ch.perfil?.Nombre || ch.Nombre || 'Combatiente',
                ownerId: ch.ownerId
            })),
            team2: Object.values(sala.team2 || {}).map(ch => ({
                Nombre: ch.perfil?.Nombre || ch.Nombre || 'Combatiente',
                ownerId: ch.ownerId
            }))
        }));

        res.json(salas);

    } catch (err) {
        console.error('Error al obtener todas las salas:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/combat/room/:code
// Permite a los admins modificar las propiedades de una sala (nombre, imagen)
app.put('/api/combat/room/:code', async (req, res) => {
    const transaccionCache = require("./utils/cache");
    const { buildSalaMessage } = require("./functions/Duelo/combateUI");
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });

    const code = req.params.code;
    const sala = transaccionCache.get(code);
    if (!sala) return res.status(404).json({ error: 'Sala no encontrada' });

    try {
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        const userRoles = member ? member.roles.cache.map(r => r.id) : [];
        const ROLES_ADMIN = ['737058095599058995', '746581152717865041'];
        const esAdmin = ROLES_ADMIN.some(r => userRoles.includes(r));

        if (!esAdmin) {
            return res.status(403).json({ error: 'No tienes permisos de administrador.' });
        }

        const { nombreSala, imageSala } = req.body;

        if (typeof nombreSala !== 'undefined') sala.nombreSala = nombreSala;
        if (typeof imageSala !== 'undefined') sala.imageSala = imageSala;

        // Guardar de nuevo en el cache
        transaccionCache.set(code, sala);

        // Actualizar mensajes en Discord
        if (client) {
            const userDiscord = await client.users.fetch(sala.autor).catch(() => null);
            if (userDiscord) {
                const messages = buildSalaMessage(userDiscord, sala.isPrivate, sala);
                
                if (sala.messageAutor) {
                    try {
                        const dmChannel = await userDiscord.createDM();
                        const msg = await dmChannel.messages.fetch(sala.messageAutor.message);
                        if (msg) await msg.edit({ components: messages.salaMessage });
                    } catch (e) {
                        console.error("Error al actualizar DM de autor:", e);
                    }
                }

                if (sala.messageServer) {
                    try {
                        const channel = await client.channels.fetch(sala.messageServer.channel);
                        const msg = await channel.messages.fetch(sala.messageServer.message);
                        if (msg) await msg.edit({ components: messages.serverMessage });
                    } catch (e) {
                        console.error("Error al actualizar canal global:", e);
                    }
                }
            }
        }

        res.json({ ok: true });

    } catch (error) {
        console.error("Error al modificar sala:", error);
        res.status(500).json({ error: 'Error interno al modificar la sala' });
    }
});

// DELETE /api/combat/room/:code
app.delete('/api/combat/room/:code', async (req, res) => {
    const transaccionCache = require("./utils/cache");
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });

    const code = req.params.code;
    const sala = transaccionCache.get(code);
    if (!sala) return res.status(404).json({ error: 'Sala no encontrada' });

    try {
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        const userRoles = member ? member.roles.cache.map(r => r.id) : [];
        const ROLES_ADMIN = ['737058095599058995', '746581152717865041'];
        const esAdmin = ROLES_ADMIN.some(r => userRoles.includes(r));

        if (sala.autor !== req.session.user.id && !esAdmin) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar esta sala' });
        }

        // Eliminar del cache de salas
        transaccionCache.delete(code);

        // Liberar estados de todos los personajes
        const personajes = [
            ...Object.keys(sala.team1),
            ...Object.keys(sala.team2)
        ];
        for (const characterId of personajes) {
            await transaccionCache.deleteStatus(Number(characterId));
        }

        // Limpiar mensajes de Discord para consistencia
        if (client) {
            if (sala.messageAutor) {
                try {
                    const user = await client.users.fetch(sala.autor);
                    const dmChannel = await user.createDM();
                    const msg = await dmChannel.messages.fetch(sala.messageAutor.message);
                    if (msg) {
                        const json = [
                            {
                                "type": 10,
                                "content": `# Sala de duelo eliminada\n-# La sala con código \`${code}\` ha sido eliminada por el creador desde la interfaz web.`
                            }
                        ]

                        await msg.edit({
                            components: json,
                            flags: ["IsComponentsV2"]
                        });
                    }
                } catch (e) {
                    console.error("No se pudo editar el DM del autor al eliminar sala:", e);
                }
            }
            if (sala.messageServer) {
                try {
                    const channel = await client.channels.fetch(sala.messageServer.channel);
                    const msg = await channel.messages.fetch(sala.messageServer.message);
                    if (msg) {
                        await msg.delete();
                    }
                } catch (e) {
                    console.error("No se pudo eliminar el mensaje del canal al eliminar sala:", e);
                }
            }
        }

        res.json({ ok: true });
    } catch (error) {
        console.error("Error al eliminar sala:", error);
        res.status(500).json({ error: 'Error interno al eliminar la sala' });
    }
});


const { v4: uuidv4 } = require("uuid");
const personas_autorizadas = ["665421882694041630"]; // Array de ID para usuarios que no requieren autorización

// POST /api/combat/admin/request
// Crea una nueva petición de autorización para administradores
app.post('/api/combat/admin/request', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    const { tipo, motivo, data, expiresAt, usos } = req.body;

    if (!motivo || motivo.trim() === '') {
        return res.status(400).json({ error: 'El motivo es requerido y no puede estar vacío.' });
    }

    if (!expiresAt && (usos === 0 || usos === null)) {
        return res.status(400).json({ error: 'No se puede configurar expiración infinita y usos infinitos al mismo tiempo.' });
    }

    try {
        const dbServer = clientdb.db("Server_db");
        
        const ROLES_ADMIN = ['737058095599058995', '746581152717865041'];
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        const esAdmin = member ? ROLES_ADMIN.some(r => member.roles.cache.has(r)) : false;

        if (!esAdmin) {
            return res.status(403).json({ error: 'Solo los administradores pueden enviar peticiones de autorización.' });
        }

        const userDiscord = await client.users.fetch(req.session.user.id).catch(() => null);
        const solicitanteTag = userDiscord ? userDiscord.tag : req.session.user.id;

        const requestDoc = {
            _id: uuidv4(),
            solicitanteId: req.session.user.id,
            solicitanteTag,
            tipo,
            motivo,
            data,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            usos: Number(usos) || 0,
            estado: 'Pendiente',
            fechaSolicitud: new Date()
        };

        // Guardar petición en base de datos
        await dbServer.collection("peticiones").insertOne(requestDoc);

        const solicitadaEpoch = Math.floor(Date.now() / 1000);
        const expEpoch = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : null;
        
        let infoString = '';
        if (tipo === 'economia') {
            if (data.subtipo === 'lumens') {
                infoString = `- Economia: Lumens: ${data.cantidad}, Acción: ${data.accion}`;
            } else {
                infoString = `- Economia: Objeto: ${data.nombre}, Cantidad: ${data.cantidad}, Rareza: ${data.rareza}, Acción: ${data.accion}`;
            }
        } else if (tipo === 'apuestas_libre') {
            infoString = `- Apuestas de Sorteo / Libre`;
        } else if (tipo === 'stat') {
            infoString = `- Stat: ${data.stat}, Valor anterior: ${data.valorAnterior}, Valor nuevo: ${data.valorNuevo}`;
        } else if (tipo === 'evento') {
            infoString = `- Evento: ${data.nombreEvento}, Duración: ${data.duracion}, Multiplicador: ${data.multiplicador}`;
        } else if (tipo === 'sancion') {
            infoString = `- Sanción: ${data.tipoSancion}, Duración: ${data.duracion}, Motivo: ${motivo}`;
        } else if (tipo === 'correccion') {
            infoString = `- Corrección manual: Campo: ${data.campo}, Valor anterior: ${data.valorAnterior}, Valor nuevo: ${data.valorNuevo}, Motivo: ${motivo}`;
        }

        const peticionMessage = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": [
                    {
                        "type": 9,
                        "accessory": {
                            "type": 11,
                            "media": {
                                "url": "https://i.pinimg.com/736x/04/22/54/042254499e121c59a46e3b9941282b88.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "### Petición de Administrador"
                            },
                            {
                                "type": 10,
                                "content": `- ID de la Petición: \`${requestDoc._id}\`\n- Usuario solicitante: <@!${req.session.user.id}>\n- Tipo de petición: ${tipo}\n- Fecha: <t:${solicitadaEpoch}:F>\n- Expiración solicitada: ${expEpoch ? `<t:${expEpoch}:F>` : 'Indefinida'}\n- Cantidad de usos solicitada: ${requestDoc.usos === 0 ? 'Infinitos' : requestDoc.usos}\n- Estado: Pendiente`
                            }
                        ]
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 10,
                        "content": `## Info:\n${infoString}\n\n**Motivo:** ${motivo}`
                    }
                ]
            }
        ];

        const logChannel = await client.channels.fetch("872702942065606666").catch(() => null);
        if (logChannel) {
            const msg = await logChannel.send({ components: peticionMessage, flags: ["IsComponentsV2"] }).catch(err => {
                console.error("Error al enviar mensaje de petición a Discord:", err);
                return null;
            });
            if (msg) {
                await dbServer.collection("peticiones").updateOne(
                    { _id: requestDoc._id },
                    { $set: { messageId: msg.id, channelId: logChannel.id } }
                );
            }
        }

        res.json({ ok: true });
    } catch (err) {
        console.error('Error al procesar petición de administrador:', err);
        res.status(500).json({ error: 'Error interno al procesar la petición.' });
    }
});

// GET /api/combat/admin/requests
// Obtiene todas las peticiones (Solo Admins)
app.get('/api/combat/admin/requests', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    try {
        const dbServer = clientdb.db("Server_db");
        const ROLES_ADMIN = ['737058095599058995', '746581152717865041'];
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        const esAdmin = member ? ROLES_ADMIN.some(r => member.roles.cache.has(r)) : false;

        if (!esAdmin) {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }

        const requests = await dbServer.collection("peticiones").find().sort({ fechaSolicitud: -1 }).toArray();
        res.json(requests);
    } catch (err) {
        console.error('Error al obtener peticiones:', err);
        res.status(500).json({ error: 'Error interno.' });
    }
});

// POST /api/combat/admin/request/aprobar/:id
// Aprueba una petición y genera el token de administración (Solo Admins)
app.post('/api/combat/admin/request/aprobar/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    const reqId = req.params.id;
    const { expiresAt, usos } = req.body;

    try {
        const dbServer = clientdb.db("Server_db");
        const ROLES_ADMIN = ['737058095599058995', '746581152717865041'];
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        const esAdmin = member ? ROLES_ADMIN.some(r => member.roles.cache.has(r)) : false;

        if (!esAdmin) {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }

        const request = await dbServer.collection("peticiones").findOne({ _id: reqId });
        if (!request) {
            return res.status(404).json({ error: 'Petición no encontrada.' });
        }

        if (request.estado !== 'Pendiente') {
            return res.status(400).json({ error: 'Esta petición ya ha sido resuelta.' });
        }

        const finalExpiresAt = expiresAt ? new Date(expiresAt) : null;
        const finalUsos = typeof usos !== 'undefined' ? Number(usos) : request.usos;

        // Modificar estado de petición
        await dbServer.collection("peticiones").updateOne(
            { _id: reqId },
            { $set: { estado: 'Aprobada', fechaAprobacion: new Date(), aprobadoPor: req.session.user.id, expiresAt: finalExpiresAt, usos: finalUsos } }
        );

        // Crear token en el perfil del solicitante
        const tokenObject = {
            token: uuidv4(),
            solicitanteId: request.solicitanteId,
            aprobadoPor: req.session.user.id,
            tipo: request.tipo,
            data: {
                usos: finalUsos,
                usosRestantes: finalUsos,
                ...request.data
            },
            expiresAt: finalExpiresAt,
            usado: false,
            fechaSolicitud: request.fechaSolicitud,
            fechaAprobacion: new Date()
        };

        await dbServer.collection("usuarios_server").updateOne(
            { _id: request.solicitanteId },
            { $push: { "admin.tokens": tokenObject } },
            { upsert: true }
        );

        // Editar el mensaje original de Discord
        const logChannel = await client.channels.fetch(request.channelId || "872702942065606666").catch(() => null);
        const logMsg = (logChannel && request.messageId) ? await logChannel.messages.fetch(request.messageId).catch(() => null) : null;
        
        if (logMsg) {
            const solicitadaEpoch = Math.floor(request.fechaSolicitud.getTime() / 1000);
            const reqExpEpoch = request.expiresAt ? Math.floor(request.expiresAt.getTime() / 1000) : null;
            const appExpEpoch = finalExpiresAt ? Math.floor(finalExpiresAt.getTime() / 1000) : null;
            const aprobacionEpoch = Math.floor(Date.now() / 1000);

            let infoString = '';
            if (request.tipo === 'economia') {
                if (request.data.subtipo === 'lumens') {
                    infoString = `- Economia: Lumens: ${request.data.cantidad}, Acción: ${request.data.accion}`;
                } else {
                    infoString = `- Economia: Objeto: ${request.data.nombre}, Cantidad: ${request.data.cantidad}, Rareza: ${request.data.rareza}, Acción: ${request.data.accion}`;
                }
            } else if (request.tipo === 'apuestas_libre') {
                infoString = `- Apuestas de Sorteo / Libre`;
            } else if (request.tipo === 'stat') {
                infoString = `- Stat: ${request.data.stat}, Valor anterior: ${request.data.valorAnterior}, Valor nuevo: ${request.data.valorNuevo}`;
            } else if (request.tipo === 'evento') {
                infoString = `- Evento: ${request.data.nombreEvento}, Duración: ${request.data.duracion}, Multiplicador: ${request.data.multiplicador}`;
            } else if (request.tipo === 'sancion') {
                infoString = `- Sanción: ${request.data.tipoSancion}, Duración: ${request.data.duracion}, Motivo: ${request.motivo}`;
            } else if (request.tipo === 'correccion') {
                infoString = `- Corrección manual: Campo: ${request.data.campo}, Valor anterior: ${request.data.valorAnterior}, Valor nuevo: ${request.data.valorNuevo}, Motivo: ${request.motivo}`;
            }

            const updatedComponents = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 9,
                            "accessory": {
                                "type": 11,
                                "media": {
                                    "url": "https://i.pinimg.com/736x/04/22/54/042254499e121c59a46e3b9941282b88.jpg"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "### Petición de Administrador"
                                },
                                {
                                    "type": 10,
                                    "content": `- ID de la Petición: \`${request._id}\`\n- Usuario solicitante: <@!${request.solicitanteId}>\n- Tipo de petición: ${request.tipo}\n- Fecha: <t:${solicitadaEpoch}:F>\n- Expiración solicitada: ${reqExpEpoch ? `<t:${reqExpEpoch}:F>` : 'Indefinida'}\n- Cantidad de usos solicitada: ${request.usos === 0 ? 'Infinitos' : request.usos}\n- Estado: **Aprobada**`
                                }
                            ]
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": `## Info:\n${infoString}\n\n**Motivo:** ${request.motivo}`
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": `### 🌟 Detalles de Aprobación\n- **Aprobado por**: <@!${req.session.user.id}>\n- **Fecha de Aprobación**: <t:${aprobacionEpoch}:F>\n- **Expiración aprobada**: ${appExpEpoch ? `<t:${appExpEpoch}:F>` : 'Indefinida'}\n- **Usos aprobados**: ${finalUsos === 0 ? 'Infinitos' : finalUsos}`
                        }
                    ]
                }
            ];

            await logMsg.edit({ components: updatedComponents, flags: ["IsComponentsV2"] }).catch(err => {
                console.error("Error al editar mensaje de Discord (aprobar):", err);
            });
        }

        // Notificar por MD al solicitante
        const solicitanteUser = await client.users.fetch(request.solicitanteId).catch(() => null);
        if (solicitanteUser) {
            const dmChannel = await solicitanteUser.createDM().catch(() => null);
            if (dmChannel) {
                const appExpEpoch = finalExpiresAt ? Math.floor(finalExpiresAt.getTime() / 1000) : null;
                const dmComponents = [
                    {
                        "type": 10,
                        "content": `### 🌟 Tu Petición ha sido Aprobada\n- **ID de Petición**: \`${request._id}\`\n- **Tipo**: ${request.tipo}\n- **Aprobado por**: <@!${req.session.user.id}>\n- **Expiración aprobada**: ${appExpEpoch ? `<t:${appExpEpoch}:F>` : 'Indefinida'}\n- **Usos aprobados**: ${finalUsos === 0 ? 'Infinitos' : finalUsos}\n- **Motivo original**: *${request.motivo}*`
                    }
                ];
                await dmChannel.send({ components: dmComponents, flags: ["IsComponentsV2"] }).catch(() => null);
            }
        }

        res.json({ ok: true });
    } catch (err) {
        console.error('Error al aprobar petición:', err);
        res.status(500).json({ error: 'Error interno.' });
    }
});

// POST /api/combat/admin/request/rechazar/:id
// Rechaza una petición (Solo Admins)
app.post('/api/combat/admin/request/rechazar/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    if (!client) return res.status(503).json({ error: 'Bot no disponible aún' });

    const reqId = req.params.id;
    const { motivoRechazo } = req.body;

    try {
        const dbServer = clientdb.db("Server_db");
        const ROLES_ADMIN = ['737058095599058995', '746581152717865041'];
        const guild = client.guilds.cache.get("716342375303217285");
        const member = guild ? await guild.members.fetch(req.session.user.id).catch(() => null) : null;
        const esAdmin = member ? ROLES_ADMIN.some(r => member.roles.cache.has(r)) : false;

        if (!esAdmin) {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }

        const request = await dbServer.collection("peticiones").findOne({ _id: reqId });
        if (!request) {
            return res.status(404).json({ error: 'Petición no encontrada.' });
        }

        if (request.estado !== 'Pendiente') {
            return res.status(400).json({ error: 'Esta petición ya ha sido resuelta.' });
        }

        await dbServer.collection("peticiones").updateOne(
            { _id: reqId },
            { $set: { estado: 'Rechazada', fechaAprobacion: new Date(), aprobadoPor: req.session.user.id, motivoRechazo: motivoRechazo || '' } }
        );

        // Editar el mensaje original de Discord
        const logChannel = await client.channels.fetch(request.channelId || "872702942065606666").catch(() => null);
        const logMsg = (logChannel && request.messageId) ? await logChannel.messages.fetch(request.messageId).catch(() => null) : null;
        
        if (logMsg) {
            const solicitadaEpoch = Math.floor(request.fechaSolicitud.getTime() / 1000);
            const reqExpEpoch = request.expiresAt ? Math.floor(request.expiresAt.getTime() / 1000) : null;
            const rechazoEpoch = Math.floor(Date.now() / 1000);

            let infoString = '';
            if (request.tipo === 'economia') {
                if (request.data.subtipo === 'lumens') {
                    infoString = `- Economia: Lumens: ${request.data.cantidad}, Acción: ${request.data.accion}`;
                } else {
                    infoString = `- Economia: Objeto: ${request.data.nombre}, Cantidad: ${request.data.cantidad}, Rareza: ${request.data.rareza}, Acción: ${request.data.accion}`;
                }
            } else if (request.tipo === 'apuestas_libre') {
                infoString = `- Apuestas de Sorteo / Libre`;
            } else if (request.tipo === 'stat') {
                infoString = `- Stat: ${request.data.stat}, Valor anterior: ${request.data.valorAnterior}, Valor nuevo: ${request.data.valorNuevo}`;
            } else if (request.tipo === 'evento') {
                infoString = `- Evento: ${request.data.nombreEvento}, Duración: ${request.data.duracion}, Multiplicador: ${request.data.multiplicador}`;
            } else if (request.tipo === 'sancion') {
                infoString = `- Sanción: ${request.data.tipoSancion}, Duración: ${request.data.duracion}, Motivo: ${request.motivo}`;
            } else if (request.tipo === 'correccion') {
                infoString = `- Corrección manual: Campo: ${request.data.campo}, Valor anterior: ${request.data.valorAnterior}, Valor nuevo: ${request.data.valorNuevo}, Motivo: ${request.motivo}`;
            }

            const updatedComponents = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 9,
                            "accessory": {
                                "type": 11,
                                "media": {
                                    "url": "https://i.pinimg.com/736x/04/22/54/042254499e121c59a46e3b9941282b88.jpg"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "### Petición de Administrador"
                                },
                                {
                                    "type": 10,
                                    "content": `- ID de la Petición: \`${request._id}\`\n- Usuario solicitante: <@!${request.solicitanteId}>\n- Tipo de petición: ${request.tipo}\n- Fecha: <t:${solicitadaEpoch}:F>\n- Expiración solicitada: ${reqExpEpoch ? `<t:${reqExpEpoch}:F>` : 'Indefinida'}\n- Cantidad de usos solicitada: ${request.usos === 0 ? 'Infinitos' : request.usos}\n- Estado: **Rechazada**`
                                }
                            ]
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": `## Info:\n${infoString}\n\n**Motivo:** ${request.motivo}`
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": `### ❌ Detalles de Rechazo\n- **Rechazado por**: <@!${req.session.user.id}>\n- **Fecha de Rechazo**: <t:${rechazoEpoch}:F>${motivoRechazo ? `\n- **Motivo del rechazo**: ${motivoRechazo}` : ''}`
                        }
                    ]
                }
            ];

            await logMsg.edit({ components: updatedComponents, flags: ["IsComponentsV2"] }).catch(err => {
                console.error("Error al editar mensaje de Discord (rechazar):", err);
            });
        }

        // Notificar por MD al solicitante
        const solicitanteUser = await client.users.fetch(request.solicitanteId).catch(() => null);
        if (solicitanteUser) {
            const dmChannel = await solicitanteUser.createDM().catch(() => null);
            if (dmChannel) {
                const dmComponents = [
                    {
                        "type": 10,
                        "content": `### ❌ Tu Petición ha sido Rechazada\n- **ID de Petición**: \`${request._id}\`\n- **Tipo**: ${request.tipo}\n- **Rechazado por**: <@!${req.session.user.id}>\n- **Motivo original**: *${request.motivo}*${motivoRechazo ? `\n- **Motivo de Rechazo**: ${motivoRechazo}` : ''}`
                    }
                ];
                await dmChannel.send({ components: dmComponents, flags: ["IsComponentsV2"] }).catch(() => null);
            }
        }

        res.json({ ok: true });
    } catch (err) {
        console.error('Error al rechazar petición:', err);
        res.status(500).json({ error: 'Error interno.' });
    }
});
async function verificarYConsumirTokenAdmin(userId, dbServer, tokenType = 'economia') {
    if (personas_autorizadas.includes(userId)) {
        return { ok: true };
    }

    const userDoc = await dbServer.collection("usuarios_server").findOne({ _id: userId });
    if (!userDoc || !userDoc.admin || !userDoc.admin.tokens) {
        return { ok: false, error: 'Permisos insuficientes' };
    }

    const now = new Date();
    const tokenIdx = userDoc.admin.tokens.findIndex(t => {
        if (t.tipo !== tokenType) return false;
        if (t.usado) return false;
        if (t.expiresAt && new Date(t.expiresAt) <= now) return false;
        return true;
    });

    if (tokenIdx === -1) {
        return { ok: false, error: 'Permisos insuficientes' };
    }

    const token = userDoc.admin.tokens[tokenIdx];
    
    // Consumir el token
    if (token.data && typeof token.data.usos !== 'undefined' && token.data.usos > 0) {
        if (typeof token.data.usosRestantes === 'undefined') {
            token.data.usosRestantes = token.data.usos;
        }
        token.data.usosRestantes--;
        if (token.data.usosRestantes <= 0) {
            token.usado = true;
        }
    }

    await dbServer.collection("usuarios_server").updateOne(
        { _id: userId },
        { $set: { [`admin.tokens.${tokenIdx}`]: token } }
    );

    return { ok: true };
}

// GET /api/combat/notifications
app.get('/api/combat/notifications', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    try {
        const db = clientdb.db(dbname);
        const character = await db.collection("Personajes").findOne({ ownerID: req.session.user.id });
        if (!character) return res.json([]);

        let notifications = character.notificaciones || [];
        notifications.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        res.json(notifications);
    } catch (err) {
        console.error("Error al obtener notificaciones:", err);
        res.status(500).json({ error: "Error interno" });
    }
});

// POST /api/combat/notifications/read-all
app.post('/api/combat/notifications/read-all', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    try {
        const db = clientdb.db(dbname);
        const character = await db.collection("Personajes").findOne({ ownerID: req.session.user.id });
        if (!character) return res.status(404).json({ error: 'Personaje no encontrado' });

        let notifications = character.notificaciones || [];
        notifications = notifications.map(n => ({ ...n, leida: true }));

        await db.collection("Personajes").updateOne(
            { _id: character._id },
            { $set: { notificaciones: notifications } }
        );
        res.json({ ok: true });
    } catch (err) {
        console.error("Error al marcar todas como leídas:", err);
        res.status(500).json({ error: "Error interno" });
    }
});

// POST /api/combat/notifications/read/:id
app.post('/api/combat/notifications/read/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    const notifId = req.params.id;
    try {
        const db = clientdb.db(dbname);
        const character = await db.collection("Personajes").findOne({ ownerID: req.session.user.id });
        if (!character) return res.status(404).json({ error: 'Personaje no encontrado' });

        let notifications = character.notificaciones || [];
        notifications = notifications.map(n => {
            if (n._id === notifId) {
                return { ...n, leida: true };
            }
            return n;
        });

        await db.collection("Personajes").updateOne(
            { _id: character._id },
            { $set: { notificaciones: notifications } }
        );
        res.json({ ok: true });
    } catch (err) {
        console.error("Error al marcar como leída:", err);
        res.status(500).json({ error: "Error interno" });
    }
});

// POST /api/combat/notifications/delete/:id
app.post('/api/combat/notifications/delete/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    const notifId = req.params.id;
    try {
        const db = clientdb.db(dbname);
        const character = await db.collection("Personajes").findOne({ ownerID: req.session.user.id });
        if (!character) return res.status(404).json({ error: 'Personaje no encontrado' });

        let notifications = character.notificaciones || [];
        notifications = notifications.filter(n => n._id !== notifId);

        await db.collection("Personajes").updateOne(
            { _id: character._id },
            { $set: { notificaciones: notifications } }
        );
        res.json({ ok: true });
    } catch (err) {
        console.error("Error al eliminar notificación:", err);
        res.status(500).json({ error: "Error interno" });
    }
});

// POST /api/combat/notifications/delete-read
app.post('/api/combat/notifications/delete-read', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
    try {
        const db = clientdb.db(dbname);
        const character = await db.collection("Personajes").findOne({ ownerID: req.session.user.id });
        if (!character) return res.status(404).json({ error: 'Personaje no encontrado' });

        let notifications = character.notificaciones || [];
        notifications = notifications.filter(n => !n.leida);

        await db.collection("Personajes").updateOne(
            { _id: character._id },
            { $set: { notificaciones: notifications } }
        );
        res.json({ ok: true });
    } catch (err) {
        console.error("Error al eliminar leídas:", err);
        res.status(500).json({ error: "Error interno" });
    }
});

// ═══ ENDPOINTS CONFIGURACIÓN SISTEMA (GLOBAL, ROL, STAFF) ═══

// GET /api/admin/system-config
app.get('/api/admin/system-config', async (req, res) => {
    try {
        const dbServer = clientdb.db("Server_db");
        const configColl = dbServer.collection("config");

        const [globalDoc, rolDoc, staffDoc] = await Promise.all([
            configColl.findOne({ _id: "global" }),
            configColl.findOne({ _id: "rol" }),
            configColl.findOne({ _id: "staff" })
        ]);

        return res.json({
            success: true,
            global: globalDoc || { _id: "global", prefix: "s!", version: "1.5.0 ✨", versionEco: "0.1", versionSV: "0.1", versionRol: "0.1", versionPETS: "0.1", token: null },
            rol: rolDoc || { _id: "rol", maxEnergy: 140, regeneracionMinutos: 10 },
            staff: staffDoc || { _id: "staff", Director: [], Subdirector: [], Administradores: [], Vigilantes: [], Ayudantes: [] }
        });
    } catch (error) {
        console.error("Error al obtener system-config:", error);
        return res.status(500).json({ error: "Error interno al obtener configuración de sistema" });
    }
});

// POST /api/admin/system-config/save
app.post('/api/admin/system-config/save', async (req, res) => {
    try {
        const { target, data } = req.body;
        if (!target || !data) {
            return res.status(400).json({ error: "Parámetros faltantes" });
        }

        const dbServer = clientdb.db("Server_db");
        const configColl = dbServer.collection("config");

        if (target === "global") {
            const updateObj = {
                prefix: String(data.prefix ?? "s!"),
                version: String(data.version ?? "1.5.0 ✨"),
                versionEco: String(data.versionEco ?? "0.1"),
                versionSV: String(data.versionSV ?? "0.1"),
                versionRol: String(data.versionRol ?? "0.1"),
                versionPETS: String(data.versionPETS ?? "0.1"),
                token: null
            };
            await configColl.updateOne({ _id: "global" }, { $set: updateObj }, { upsert: true });
            config.refrescarLocal("global", updateObj);
        } else if (target === "rol") {
            const updateObj = {
                maxEnergy: new Int32(Number(data.maxEnergy ?? 140)),
                regeneracionMinutos: new Int32(Number(data.regeneracionMinutos ?? 10))
            };
            await configColl.updateOne({ _id: "rol" }, { $set: updateObj }, { upsert: true });
            config.refrescarLocal("rol", { maxEnergy: Number(data.maxEnergy ?? 140), regeneracionMinutos: Number(data.regeneracionMinutos ?? 10) });
        } else if (target === "staff") {
            const updateObj = {
                Director: Array.isArray(data.Director) ? data.Director : [],
                Subdirector: Array.isArray(data.Subdirector) ? data.Subdirector : [],
                Administradores: Array.isArray(data.Administradores) ? data.Administradores : [],
                Vigilantes: Array.isArray(data.Vigilantes) ? data.Vigilantes : [],
                Ayudantes: Array.isArray(data.Ayudantes) ? data.Ayudantes : []
            };
            await configColl.updateOne({ _id: "staff" }, { $set: updateObj }, { upsert: true });
            config.refrescarLocal("staff", updateObj);
        } else {
            return res.status(400).json({ error: "Target de configuración no válido" });
        }

        return res.json({ success: true, message: `Configuración de ${target} guardada correctamente.` });
    } catch (error) {
        console.error("Error al guardar system-config:", error);
        return res.status(500).json({ error: "Error interno al guardar configuración de sistema" });
    }
});

// GET /api/admin/discord-user/:id
app.get('/api/admin/discord-user/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        if (!userId) return res.status(400).json({ error: "ID faltante" });

        if (client && client.users) {
            try {
                const user = await client.users.fetch(userId);
                if (user) {
                    return res.json({
                        success: true,
                        id: user.id,
                        username: user.username,
                        globalName: user.globalName || user.username,
                        avatar: user.displayAvatarURL()
                    });
                }
            } catch (err) {
                // Silencioso
            }
        }

        const dbRol = clientdb.db("Rol_db");
        const charDoc = await dbRol.collection("Personajes").findOne({ ownerID: String(userId) });
        if (charDoc && charDoc.perfil) {
            return res.json({
                success: true,
                id: String(userId),
                username: charDoc.perfil.Nombre || `Usuario (${userId})`,
                globalName: charDoc.perfil.Nombre || `Usuario (${userId})`,
                avatar: charDoc.perfil.avatarURL || ""
            });
        }

        return res.json({
            success: true,
            id: String(userId),
            username: `Usuario (${userId})`,
            globalName: `Usuario (${userId})`,
            avatar: ""
        });
    } catch (error) {
        return res.status(500).json({ error: "Error resolviendo usuario" });
    }
});

clientdb.iniciarServidorWeb = () => {
    sessionMiddleware = session({
        secret: process.env.SESSION_SECRET || 'nixworld_secret_temp',
        resave: false,
        saveUninitialized: false,
        rolling: true,
        store: MongoStore.create({
            client: clientdb,
            dbName: dbserverName,
            ttl: 7 * 24 * 60 * 60 // 7 días en segundos
        }),
        cookie: {
            secure: false,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días en ms
        }
    });

    app.listen(port, () => {
        console.log(`🌐 Escuchando servidor web correctamente (${port})`);
    });
};

function setDiscordClient(discordClient) {
    client = discordClient;
}

clientdb.setDiscordClient = setDiscordClient;

module.exports = clientdb;