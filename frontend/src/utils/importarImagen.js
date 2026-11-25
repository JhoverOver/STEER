// Lo que se puede subir a Steer y cómo se convierte en capa. Una sola regla para los tres lugares donde se sube
// algo: la ventana Archivos, importar frames y agregar una imagen como capa en el editor.
import { MAXIMO_NOMBRE_CAPA, MAX_MB } from '../config/limites';
import { aBlob, cargarImagen, crearCanvas } from './imagenes';

export const TIPOS_IMPORTABLES = ['image/gif', 'image/png', 'image/jpeg', 'image/webp']; // frames y Archivos
export const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/webp']; // capa del editor (una sola imagen)
export const NOMBRES_TIPO = { 'image/gif': 'GIF', 'image/png': 'PNG', 'image/jpeg': 'JPG', 'image/webp': 'WEBP' };

// Por qué el archivo no sirve, o '' si sirve
export function motivoRechazo(archivo, tipos = TIPOS_IMPORTABLES) {
    const nombre = archivo?.name ? `"${archivo.name}"` : 'El archivo';
    if (!archivo || !tipos.includes(archivo.type)) {
        const lista = tipos.map((t) => NOMBRES_TIPO[t]);
        return `${nombre} no es ${lista.slice(0, -1).join(', ')} ni ${lista[lista.length - 1]}.`;
    }
    if (archivo.size > MAX_MB * 1024 * 1024) return `${nombre} supera el máximo de ${MAX_MB} MB.`;
    return '';
}

export function nombreDesdeArchivo(nombreArchivo) {
    const base = String(nombreArchivo || '').replace(/\.[^.]*$/, '').trim();
    return (base ||  'Imagen').slice(0, MAXIMO_NOMBRE_CAPA);
}

export function calcularAjuste(anchoImagen, altoImagen, anchoLienzo, altoLienzo) {
    const escala = Math.min(1, anchoLienzo / anchoImagen, altoLienzo / altoImagen);
    const ancho = Math.max(1, Math.round(anchoImagen * escala));
    const alto = Math.max(1, Math.round(altoImagen * escala));
    return {
        ancho,
        alto,
        x: Math.round((anchoLienzo - ancho) / 2),
        y: Math.round((altoLienzo - alto) / 2),
    };
}

// La imagen como PNG del tamaño del lienzo: achicada si no cabe y centrada
export async function imagenACapaPNG(archivo, anchoLienzo, altoLienzo) {
    const direccion = URL.createObjectURL(archivo);
    try {
        const imagen = await cargarImagen(direccion);
        const canvas = crearCanvas(anchoLienzo, altoLienzo);
        const { ancho, alto, x, y } = calcularAjuste(imagen.naturalWidth, imagen.naturalHeight, anchoLienzo, altoLienzo);
        canvas.getContext('2d').drawImage(imagen, x, y, ancho, alto);
        return await aBlob(canvas);
    } finally {
        URL.revokeObjectURL(direccion);
    }
}