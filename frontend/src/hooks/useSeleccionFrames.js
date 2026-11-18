import { useMemo, useRef, useState } from 'react';
import { clavesEnRango } from '../utils/operacionesFrames';

// Frames seleccionados en la lista. Solo cuentan las claves que siguen existiendo en "frames"
// (si un frame se elimina, deja de estar seleccionado sin tener que limpiarlo a mano).
//
// Devuelve:
//   activa      Set con las claves seleccionadas
//   claves      las mismas claves, en el orden de la lista
//   alternar(clave, conRango)  marca o desmarca; con Shift (conRango) marca todo desde el último marcado
//   seleccionarTodo(), quitar(), limpiar()   (las dos primeras devuelven true si hicieron algo, para los atajos)
function useSeleccionFrames(frames) {
    const [seleccion, setSeleccion] = useState(() => new Set());
    const ultimaClave = useRef(null);

    const claves = useMemo(() => frames.filter((f) => seleccion.has(f.clave)).map((f) => f.clave), [frames, seleccion]);
    const activa = useMemo(() => new Set(claves), [claves]);

    function alternar(clave, conRango) {
        const nueva = new Set(activa);
        if (conRango && ultimaClave.current) {
            clavesEnRango(frames, ultimaClave.current, clave).forEach((c) => nueva.add(c));
        } else if (nueva.has(clave)) {
            nueva.delete(clave);
        } else {
            nueva.add(clave);
        }
        ultimaClave.current = clave;
        setSeleccion(nueva);
    }

    function limpiar() {
        setSeleccion(new Set());
        ultimaClave.current = null;
    }

    function seleccionarTodo() {
        if (frames.length === 0) return false;
        setSeleccion(new Set(frames.map((f) => f.clave)));
        ultimaClave.current = null;
        return true;
    }

    function quitar() {
        if (activa.size === 0) return false;
        limpiar();
        return true;
    }

    return { activa, claves, alternar, seleccionarTodo, quitar, limpiar };
}

export default useSeleccionFrames;