const axios = require("axios")

module.exports = async(action) => {
    try {
        const response = await axios.get(`https://nekos.best/api/v2/${action}`, {
            headers: {
                "User-Agent": "Navi (https://discord.gg/MRvHPH9EZu)"
            }
        })
        if (response.data?.results?.length > 0) {
            return response.data.results[0]
        }
    } catch (error) {
        console.log("Error consultando API nekos.best:", error.message)
    }

    return {
        url: "https://c.tenor.com/2CjD23b-uaoAAAAd/tenor.gif",
        anime_name: "Desconocido"
    }
}