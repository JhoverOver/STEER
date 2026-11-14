import { MAXIMO_NOMBRE_CAPA } from './capas'

export const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/webp'];
export const TAMANO_MAXIMO_IMAGEN_MB = 30;

export function motivoRechazo(archivo) {
    if (!archivo || !TIPOS_IMAGEN.includes(archivo.type)) return 'Solo se permiten imágenes PNG, JPG, o WEBP';
    if (archivo.size > TAMANO_MAXIMO_IMAGEN_MB * 1024 * 1024) {
        return `La imagen supera el máximo de ${TAMANO_MAXIMO_IMAGEN_MB} MB`;
    }
    return '';
}

export function checkArchivoImagen(archivo) {
    return motivoRechazo(archivo) === '';
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

export function imagenACapaPNG(archivo, anchoLienzo, altoLienzo) {
    return new Promise((resolver, rechazar) => {
        const direccion = URL.createObjectURL(archivo);
        const imagen = new Image();
        imagen.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = anchoLienzo;
                canvas.height = altoLienzo;
                const { ancho, alto, x, y } = calcularAjuste(
                    imagen.naturalWidth, imagen.naturalHeight, anchoLienzo, altoLienzo,
                );
                canvas.getContext('2d').drawImage(imagen, x, y, ancho, alto);
                canvas.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo crear la capa.'))), 'image/png');
            } catch (error) {
                rechazar(error);
            } finally {
                URL.revokeObjectURL(direccion);
            }
        };
        imagen.onerror = () => {
            URL.revokeObjectURL(direccion);
            rechazar(new Error('No se pudo leer la imagen.'));
        };
        imagen.src = direccion;
    });
}