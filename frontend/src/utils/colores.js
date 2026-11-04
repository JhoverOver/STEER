// Paleta de colores de proyecto (RF12). Los nombres deben coincidir con config/paleta.js del backend.
export const COLORES = [
    { nombre: 'azul', etiqueta: 'Azul', hex: '#3d7bd9' },
    { nombre: 'verde', etiqueta: 'Verde', hex: '#3fa56b' },
    { nombre: 'amarillo', etiqueta: 'Amarillo', hex: '#d4a72c' },
    { nombre: 'naranja', etiqueta: 'Naranja', hex: '#d9772f' },
    { nombre: 'rojo', etiqueta: 'Rojo', hex: '#c9444f' },
    { nombre: 'morado', etiqueta: 'Morado', hex: '#8a5cc7' },
    { nombre: 'rosa', etiqueta: 'Rosa', hex: '#d9669c' },
    { nombre: 'gris', etiqueta: 'Gris', hex: '#8a8a8a' },
];

export function hexDeColor(nombre) {
    const color = COLORES.find((c) => c.nombre === nombre);
    return color ? color.hex : null;
}
