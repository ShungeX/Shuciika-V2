const fs = require('fs')
const path = require("path")
const getAllFiles = require('./getAllFiles')

module.exports = (exceptions = []) => {
        let buttons = []
        const buttonsCategories = getAllFiles(
            path.join(__dirname, "..", "interactionFuncions", "selectMenus"),
            true
        )

    
        for(const buttonsCategory of buttonsCategories) {
                const buttonsFiles = getAllFiles(buttonsCategory)
                for(const buttonsFile of buttonsFiles) {
                    const buttonsObject = require(buttonsFile)
                    if(exceptions.includes(buttonsObject.name)) {
                        continue;
                    }
                    buttons.push(buttonsObject);
                }
                
                
            }
    return buttons;
}