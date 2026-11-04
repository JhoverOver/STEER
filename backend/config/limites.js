// Límites del sistema en un solo lugar (Plan de Gestión de Calidad).
// Si los cambias, cambia también MAX_FRAMES y TAMANO_MAXIMO_MB en el frontend.
module.exports = {
    MAX_FRAMES: 100,            // fotogramas por proyecto
    MAX_MB: 10,                 // peso máximo de un archivo subido
    DURACION_MINIMA: 10,        // ms por fotograma
    DURACION_MAXIMA: 10000,     // ms por fotograma
    MAX_ETIQUETAS: 5,
    LARGO_MAXIMO_ETIQUETA: 20,
    ANCHO_MINIATURA: 160,       // px
};
