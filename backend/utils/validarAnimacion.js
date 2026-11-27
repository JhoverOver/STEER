// Animación de una capa (pestaña Video): keyframes que mueven, escalan y giran la capa de una fila a lo largo del
// tiempo. Cada capa animada guarda los keyframes de su fila y, aparte (capas.original_data), su dibujo sin animar,
// para volver a aplicarlos sin perder calidad. Deben coincidir con fe/src/utils/animacion.js.
//
//   { id, caja: { x, y, ancho, alto }, keyframes: [{ tiempo, dx, dy, escalaX, escalaY, angulo }], forma? }
//
// "caja" es lo que se transforma (su centro es el punto fijo al escalar y girar), en píxeles del lienzo. "forma" es
// la forma sin animar de una capa de texto o rectángulo (su dibujo se vuelve a hacer desde ella).
const { MAX_KEYFRAMES, LADO_MAXIMO, FACTOR_AREA_TRABAJO, DURACION_MAXIMA, MAX_FRAMES } = require('../config/limites');
const { validarForma } = require('./validarForma');

const LIMITE_POSICION = LADO_MAXIMO * FACTOR_AREA_TRABAJO;
const TIEMPO_MAXIMO = DURACION_MAXIMA * MAX_FRAMES;
const ESCALA = [0.01, 100];

const esNumero = (valor, minimo, maximo) => (
    typeof valor === 'number' && Number.isFinite(valor) && valor >= minimo && valor <= maximo
);
const redondear = (numero, decimales) => Math.round(numero * 10 ** decimales) / 10 ** decimales;

function validarCaja(caja) {
    if (!caja || typeof caja !== 'object') return null;
    const { x, y, ancho, alto } = caja;
    const posicion = (n) => esNumero(n, -LIMITE_POSICION, LIMITE_POSICION);
    if (!posicion(x) || !posicion(y) || !esNumero(ancho, 0, LIMITE_POSICION) || !esNumero(alto, 0, LIMITE_POSICION)) return null;
    return { x: redondear(x, 1), y: redondear(y, 1), ancho: redondear(ancho, 1), alto: redondear(alto, 1) };
}

function validarKeyframe(k) {
    if (!k || typeof k !== 'object') return null;
    const { tiempo, dx, dy, escalaX, escalaY, angulo } = k;
    if (!Number.isInteger(tiempo) || tiempo < 0 || tiempo > TIEMPO_MAXIMO) return null;
    const posicion = (n) => esNumero(n, -LIMITE_POSICION, LIMITE_POSICION);
    if (!posicion(dx) || !posicion(dy)) return null;
    if (!esNumero(escalaX, ...ESCALA) || !esNumero(escalaY, ...ESCALA) || !esNumero(angulo, -3600, 3600)) return null;
    return {
        tiempo, dx: redondear(dx, 1), dy: redondear(dy, 1),
        escalaX: redondear(escalaX, 4), escalaY: redondear(escalaY, 4), angulo: redondear(angulo, 2),
    };
}

// Devuelve { valor } (undefined si no viene, null si se quita) o { error } con el motivo
function validarAnimacion(animacion) {
    if (animacion === undefined) return { valor: undefined };
    if (animacion === null) return { valor: null };
    if (typeof animacion !== 'object' || Array.isArray(animacion)) return { error: 'no es válida.' };
    const { id, caja, keyframes, forma } = animacion;
    if (typeof id !== 'string' || !id || id.length > 40) return { error: 'no tiene un id válido.' };
    const cajaLimpia = validarCaja(caja);
    if (!cajaLimpia) return { error: 'tiene una caja no válida.' };
    if (!Array.isArray(keyframes) || keyframes.length < 1 || keyframes.length > MAX_KEYFRAMES) {
        return { error: `debe tener de 1 a ${MAX_KEYFRAMES} keyframes.` };
    }
    const limpios = keyframes.map(validarKeyframe);
    if (limpios.some((k) => !k)) return { error: 'tiene un keyframe no válido.' };
    limpios.sort((a, b) => a.tiempo - b.tiempo);
    if (limpios.some((k, i) => i > 0 && k.tiempo === limpios[i - 1].tiempo)) return { error: 'tiene dos keyframes en el mismo momento.' };
    const valor = { id, caja: cajaLimpia, keyframes: limpios };
    if (forma !== undefined && forma !== null) {
        const formaLimpia = validarForma(forma);
        if (formaLimpia.error) return { error: `tiene una forma que ${formaLimpia.error}` };
        valor.forma = formaLimpia.valor;
    }
    return { valor };
}

// La animación corrida (dx, dy) píxeles: al cambiar el tamaño del lienzo se mueve igual que el dibujo
function moverAnimacion(animacion, dx, dy) {
    const movida = { ...animacion, caja: { ...animacion.caja, x: animacion.caja.x + dx, y: animacion.caja.y + dy } };
    if (animacion.forma) movida.forma = { ...animacion.forma, x: animacion.forma.x + dx, y: animacion.forma.y + dy };
    return movida;
}

module.exports = { validarAnimacion, moverAnimacion };
