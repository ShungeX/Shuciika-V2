const { iniciarBarrido } = require("../../functions/imagenesTemporales");

// Imágenes subidas en modals (banners de regalo, foto de ficha): borra de Cloudinary
// las que ya nadie usa. En diferido para no retrasar clientReady.
module.exports = () => {
    setTimeout(() => iniciarBarrido(), 40_000);
};
