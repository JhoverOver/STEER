// Capas con forma editable (pestañas Video e Imagen): un texto o un rectángulo. La capa guarda su dibujo como
// cualquier otra (imagen_data) y, además, cómo es su forma, para poder cambiarla después. Aquí se revisan esos datos.
// Deben coincidir con fe/src/utils/formas.js y fe/src/utils/texto.js.

const FUENTES = ['sans', 'serif', 'mono', 'impacto', 'manuscrita'];
const ALINEACIONES = ['izquierda', 'centro', 'derecha'];
const LARGO_MAXIMO_TEXTO = 500;
const TAMANO_MINIMO = 4; // px
const TAMANO_MAXIMO = 600; // px
const LADO_RECTANGULO_MAXIMO = 4000; // px
const POSICION_MAXIMA = 10000; // px desde el lienzo, hacia cualquier lado

const esNumero = (valor, minimo, maximo) => (
    typeof valor === 'number' && Number.isFinite(valor) && valor >= minimo && valor <= maximo
);
const unDecimal = (numero) => Math.round(numero * 10) / 10;

// Lo que tienen todas las formas: centro (x, y), giro, color y, si es copia de otras en varios frames, su grupo
function validarComun({ x, y, rotacion, color, grupo }) {
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return { error: 'debe tener un color #rrggbb.' };
    if (!esNumero(x, -POSICION_MAXIMA, POSICION_MAXIMA) || !esNumero(y, -POSICION_MAXIMA, POSICION_MAXIMA)) {
        return { error: 'tiene una posición no válida.' };
    }
    if (!esNumero(rotacion, -360, 360)) return { error: 'debe girar entre -360 y 360 grados.' };
    if (grupo !== undefined && (typeof grupo !== 'string' || grupo.length > 40)) return { error: 'tiene un grupo no válido.' };
    const valor = { x: unDecimal(x), y: unDecimal(y), rotacion: unDecimal(rotacion), color: color.toLowerCase() };
    if (grupo !== undefined) valor.grupo = grupo;
    return { valor };
}

function validarTexto({ contenido, fuente, tamano, negrita, cursiva, alineacion }) {
    if (typeof contenido !== 'string' || !contenido.trim() || contenido.length > LARGO_MAXIMO_TEXTO) {
        return { error: `debe tener de 1 a ${LARGO_MAXIMO_TEXTO} caracteres.` };
    }
    if (!FUENTES.includes(fuente)) return { error: `debe usar una de las fuentes: ${FUENTES.join(', ')}.` };
    if (!Number.isInteger(tamano) || tamano < TAMANO_MINIMO || tamano > TAMANO_MAXIMO) {
        return { error: `debe medir entre ${TAMANO_MINIMO} y ${TAMANO_MAXIMO} px.` };
    }
    if (typeof negrita !== 'boolean' || typeof cursiva !== 'boolean') return { error: 'debe indicar negrita y cursiva.' };
    if (!ALINEACIONES.includes(alineacion)) return { error: `debe alinearse a: ${ALINEACIONES.join(', ')}.` };
    return { valor: { contenido, fuente, tamano, negrita, cursiva, alineacion } };
}

function validarRectangulo({ ancho, alto }) {
    const lado = (n) => Number.isInteger(n) && n >= 1 && n <= LADO_RECTANGULO_MAXIMO;
    if (!lado(ancho) || !lado(alto)) return { error: `debe medir de 1 a ${LADO_RECTANGULO_MAXIMO} px por lado.` };
    return { valor: { ancho, alto } };
}

const PROPIOS = { texto: validarTexto, rectangulo: validarRectangulo };

// Devuelve { valor } (undefined si no viene, null si se quita) o { error } con el motivo
function validarForma(forma) {
    if (forma === undefined) return { valor: undefined };
    if (forma === null) return { valor: null };
    if (typeof forma !== 'object' || Array.isArray(forma) || !PROPIOS[forma.tipo]) return { error: 'no es válida.' };
    const comun = validarComun(forma);
    if (comun.error) return comun;
    const propio = PROPIOS[forma.tipo](forma);
    if (propio.error) return propio;
    return { valor: { tipo: forma.tipo, ...propio.valor, ...comun.valor } };
}

// Una forma corrida (dx, dy) píxeles: al cambiar el tamaño del lienzo se mueve igual que su dibujo
const moverForma = (forma, dx, dy) => ({ ...forma, x: forma.x + dx, y: forma.y + dy });

// MySQL entrega las columnas JSON ya convertidas; MariaDB, como texto
function leerForma(valor) {
    if (!valor) return null;
    if (typeof valor !== 'string') return valor;
    try {
        return JSON.parse(valor);
    } catch (error) {
        return null;
    }
}

module.exports = { validarForma, moverForma, leerForma };
