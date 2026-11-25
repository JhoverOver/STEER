import { useEffect, useState } from 'react';
import { inicios, duracionTotal, indiceEnTiempo } from '../utils/lineaTiempo';
import { limitar } from '../utils/comunes';

// El cabezal de la pestaña Video: en qué momento de la animación se está y si se está reproduciendo.
// La reproducción es continua: en cada cuadro de pantalla el cabezal avanza lo que pasó desde el anterior (en
// milisegundos, no de frame en frame) y al llegar al final vuelve al comienzo.
//
// frames          los frames del proyecto (con su duración)
// indiceInicial   el frame en que se abre
//
// Devuelve { tiempo, indice, total, reproduciendo, alternar(), buscar(ms), irAFrame(i) }.
// "tiempo" nunca queda después del final, aunque los frames se acorten. Mover el cabezal a mano detiene la reproducción.
function useCabezal(frames, indiceInicial) {
    const total = duracionTotal(frames);
    const [tiempo, setTiempo] = useState(() => inicios(frames)[indiceInicial] || 0);
    const [reproduciendo, setReproduciendo] = useState(false);

    useEffect(() => {
        if (!reproduciendo || total <= 0) return undefined;
        let anterior = performance.now();
        let pedido;
        function avanzar(ahora) {
            const pasado = ahora - anterior;
            anterior = ahora;
            setTiempo((actual) => (Math.min(actual, total) + pasado) % total);
            pedido = requestAnimationFrame(avanzar);
        }
        pedido = requestAnimationFrame(avanzar);
        return () => cancelAnimationFrame(pedido);
    }, [reproduciendo, total]);

    const tiempoSeguro = Math.min(tiempo, Math.max(total - 1, 0));

    function buscar(nuevo) {
        setReproduciendo(false);
        setTiempo(nuevo);
    }

    return {
        tiempo: tiempoSeguro,
        indice: indiceEnTiempo(frames, tiempoSeguro),
        total,
        reproduciendo,
        alternar: () => setReproduciendo((actual) => !actual),
        buscar,
        irAFrame: (i) => buscar(inicios(frames)[limitar(i, 0, frames.length - 1)]),
    };
}

export default useCabezal;
