const { MongoClient, ServerApiVersion} = require("mongodb")



require("dotenv").config();
const uri = process.env.MONGODB_URI
const clientdb = new MongoClient(uri);
const dbname = "Rol_db"
const dbcache = "CachePJ"




module.exports = clientdb