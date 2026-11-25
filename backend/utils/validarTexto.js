// Capas de texto editable (pestañas Video e Imagen). La capa guarda su dibujo como cualquier otra (imagen_data) y,
// además, cómo es su texto, para poder cambiarlo después. Aquí se revisa la forma de esos datos.
// Deben coincidir con fe/src/utils/texto.js.

const FUENTES = ['sans', 'serif', 'mono', 'impacto', 'manuscrita'];
const ALINEACIONES = ['izquierda', 'centro', 'derecha'];
const LARGO_MAXIMO_TEXTO = 500;
const TAMANO_MINIMO = 4; // px
const TAMANO_MAXIMO = 600; // px
const POSICION_MAXIMA = 10000; // px desde el lienzo, hacia cualquier lado

function esNumero(valor, minimo, maximo) {
    return typeof valor === 'number' && Number.isFinite(valor) && valor >= minimo && valor <= maximo;
}

// Devuelve { valor } (undefined si no viene, null si se quita) o { error } con el motivo
function validarTexto(texto) {
    if (texto === undefined) return { valor: undefined };
    if (texto === null) return { valor: null };
    if (typeof texto !== 'object' || Array.isArray(texto)) return { error: 'no es válido.' };
    const { contenido, fuente, tamano, color, negrita, cursiva, alineacion, x, y, rotacion, grupo } = texto;
    if (typeof contenido !== 'string' || !contenido.trim() || contenido.length > LARGO_MAXIMO_TEXTO) {
        return { error: `debe tener de 1 a ${LARGO_MAXIMO_TEXTO} caracteres.` };
    }
    if (!FUENTES.includes(fuente)) return { error: `debe usar una de las fuentes: ${FUENTES.join(', ')}.` };
    if (!Number.isInteger(tamano) || tamano < TAMANO_MINIMO || tamano > TAMANO_MAXIMO) {
        return { error: `debe medir entre ${TAMANO_MINIMO} y ${TAMANO_MAXIMO} px.` };
    }
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return { error: 'debe tener un color #rrggbb.' };
    if (typeof negrita !== 'boolean' || typeof cursiva !== 'boolean') return { error: 'debe indicar negrita y cursiva.' };
    if (!ALINEACIONES.includes(alineacion)) return { error: `debe alinearse a: ${ALINEACIONES.join(', ')}.` };
    if (!esNumero(x, -POSICION_MAXIMA, POSICION_MAXIMA) || !esNumero(y, -POSICION_MAXIMA, POSICION_MAXIMA)) {
        return { error: 'tiene una posición no válida.' };
    }
    if (!esNumero(rotacion, -360, 360)) return { error: 'debe girar entre -360 y 360 grados.' };
    if (grupo !== undefined && (typeof grupo !== 'string' || grupo.length > 40)) return { error: 'tiene un grupo no válido.' };
    const valor = {
        contenido, fuente, tamano, color: color.toLowerCase(), negrita, cursiva, alineacion,
        x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, rotacion: Math.round(rotacion * 10) / 10,
    };
    if (grupo !== undefined) valor.grupo = grupo;
    return { valor };
}

module.exports = { validarTexto };
