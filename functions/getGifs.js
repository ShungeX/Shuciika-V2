const axios = require("axios")

module.exports = async(action) => {

    try {
        const response = await axios.get(`https://nekos.best/api/v2/${action}`)
        if(response.data.results.length > 0) {
            return response.data.results[0]
        }
    } catch (error) {
        console.log(error)
        return null
    }
}