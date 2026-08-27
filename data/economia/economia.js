//Pasar todo a escenarios y trabajos.json
// Ver. desactualizada 

const trabajos = {
    bibliotecario: {
        nombre: "Cuidador de biblioteca",
        img: "https://i.pinimg.com/736x/d5/fe/06/d5fe06d06cd6adc29da4a68d225dd606.jpg",
        descripcion: "Si tu sueño siempre fue mandar a callar gente sin consecuencias, este es tu trabajo ideal. (Cuidado con el tomo volador que siempre se escapa)",
        salario: [10, 18],
        energia: 2,
        limite: 3,
        dificultad: 1,
        propina: false, // Se puede obtener un extra en propina mediante tu suerte
        mortal: false,
    },
    limpieza: {
        nombre: "Encargado de limpieza (Heroe no reconocido)",
        img: "https://i.pinimg.com/736x/d2/98/2e/d2982e988f5864c5115b093c6f33ed32.jpg",
        descripcion: "Los conserjes desaparecieron tras el 'Incidente del Polvo Brillante'. Ahora tú limpias hechizos vomitados, plumas de dragón adolescente, y... ¿es eso un portal en el baño? \n-# Este trabajo no incluye minijuego (en desarrollo), la cantidad de lumens a ganar es reducida significativamente",
        salario: [5, 10],
        energia: 0,
        limite: 0,
        dificultad: 1,
        propina: false, // Se puede obtener un extra en propina mediante tu suerte
        mortal: false,
    },
    mensajero: {
        nombre: "Mensajero Mágico",
        img: "https://i.pinimg.com/736x/26/a4/63/26a4638dcc4d54e3d565c9a4094c6875.jpg",
        descripcion: "Eres la versión barata de los repartidores profesionales RiRi y Dapi. Por eso malbaratan este trabajo, pero gracias a esto aun son populares. (De momento)",
        salario: [30, 70],
        energia: 9,
        limite: Infinity,
        dificultad: 1,
        propina: false, // Se puede obtener un extra en propina mediante tu suerte
        mortal: false,
    },
}

const trabajos_escenarios = {
    asisespiritual_escenario1: {
        titulo: "El alma enamorado",
        text: "*Una alma con sombrero de copa te agarra la manga...*\n-# ¡Oh, alma bondadosa! llevo siglos buscando a mi amada *nombre* ¿Podrias... ayudarme a encontrar su tumba?",
        options: [
            { label: "Claro, te ayudaré", "id": "A", "resultado": { ganancia: 1.3, items: null, message: "Estuvieron horas buscando, sin embargo. No encontraron ninguna pista...\n-# Gracias por tu ayuda alma bondadosa\n-# *Sigilosamente se desvanece*" } },
            { label: "Intentar razonar con el alma", "id": "B", "resultado": { ganancia: 1, items: null, message: "Platicaste acerca de lo complicado que es buscar... \n-# El alma no lo comprende, sin embargo, te deja en paz.\n-# *Sigilosamente se desvanece*" } },
            { label: "Ignoras el llamado de esta alma", "id": "A", "resultado": { ganancia: 0.7, items: null, message: "Aplicas la de 'soy de palo, tengo orejas de pescado'...\n-# Lentamente el llamado de ayuda desaparece..." } },
        ]
    },
    asisespiritual_escenario2: {
        titulo: "El alma panadero confundido",
        text: "*Una vieja alma se te aparece entre neblina de harina*\n-# Parece preocupado, sin embargo recuerdas que aquella alma murió horneando y aún cree que debe entregar sus panes.\n-# Alma aun viviente, ayudame a entregar los panes que tengo pendientes",
        options: [
            { label: "Tranquilo, ya no hay pedidos que entregar, puede descansar", "id": "A", "resultado": { ganancia: 1.3, items: null, message: "El alma parece dejar de estar confundida.\n-# Y sin decir ni una sola palabra, se desvanece lentamente..." } },
            { label: "Señor, este pan ya esta duro, no lo podemos vender", "id": "B", "resultado": { ganancia: 1, items: null, message: "Su mirada expresa tristeza, sin embargo... \n-# El alma comprende el tiempo que se demoró\n-# *Sigilosamente se desvanece*" } },
            { label: "Ignoras el llamado de esta alma", "id": "A", "resultado": { ganancia: 0.7, items: null, message: "Aplicas la de 'soy de palo, tengo orejas de pescado'...\n-# Lentamente el llamado de ayuda desaparece..." } },
        ]
    },
    asisespiritual_escenario3: {
        titulo: "El niño perdido",
        text: "*Una pequeña alma aparece abrazando su oso de peluche. Parece estar triste y pide ayuda para buscar su mamá. Sin embargo, no sabe que esta muerto.",
        options: [
            { label: "Tu mamá está más allá del velo, ven, yo te llevo.", "id": "A", "resultado": { ganancia: 1.3, items: null, message: "La pequeña alma expresa felicidad en su rostro.\n-# Y sin decir ni una sola palabra, se desvanece lentamente..." } },
            { label: "¿Has intentado buscar por allá?", "id": "B", "resultado": { ganancia: 1, items: null, message: "Su pequeña mirada expresa confusión... \n-# Pero te hace caso y camina lentamente hacia donde señalaste\n-# *Sigilosamente se desvanece.*" } },
            { label: "Ignoras el llamado de esta alma", "id": "A", "resultado": { ganancia: 0.7, items: null, message: "Aplicas la de 'soy de palo, tengo orejas de pescado'...\n-# Lentamente el llamado de ayuda desaparece..." } },
        ]
    }


}

module.exports = { trabajos }