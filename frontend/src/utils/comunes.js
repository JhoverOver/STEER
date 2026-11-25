// Pequeñas funciones que usan varias partes de la app

// El número dentro de [minimo, maximo]
export function limitar(valor, minimo, maximo) {
    return Math.min(Math.max(valor, minimo), maximo);
}

// Si "nueva" tiene los mismos elementos que "original", devuelve "original": así React y el historial ven que no
// cambió nada y no registran un paso vacío
export function siCambio(original, nueva) {
    const igual = original.length === nueva.length && original.every((x, i) => x === nueva[i]);
    return igual ? original : nueva;
}
