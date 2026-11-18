import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { limitarZoom, zoomParaAjustar, siguienteZoom, scrollParaFijarPunto } from '../utils/areaTrabajo';

// Espacio que tapan los paneles flotantes al ajustar la vista (px de pantalla): arriba la barra de herramientas
const MARGEN_SUPERIOR = 230;
const MARGEN_INFERIOR = 24;

// Zoom y desplazamiento del visor del lienzo:
//   - rueda del mouse: zoom hacia el cursor
//   - barra espaciadora o botón central del mouse + arrastrar: mueve la vista
//   - al abrir, el lienzo del proyecto se ve entero y centrado ("ajustar")
//
// visorRef   el div con scroll que contiene la zona de trabajo
// ancho, alto, area   tamaño del lienzo del proyecto y de la zona de trabajo (utils/areaTrabajo.js)
// alPintar(zoom)      se llama cada vez que el visor queda dibujado con un zoom nuevo
//
// Devuelve:
//   zoom, zoomRef (el mismo valor, para leerlo sin esperar a React), espacio (barra espaciadora presionada)
//   acercar(), alejar(), zoomReal(), ajustar()
//   paneo: { empezar(evento) -> true si el evento es para mover la vista, seguir(evento) -> true si está moviendo,
//            terminar() -> true si estaba moviendo }
function useVistaLienzo(visorRef, { ancho, alto, area }, alPintar) {
    const [zoom, setZoom] = useState(1);
    const zoomRef = useRef(1);
    const zoomPintado = useRef(1); // el zoom con el que está dibujado el visor ahora mismo
    const fijarPunto = useRef(null); // tras cambiar el zoom: qué punto de la zona debe quedar bajo el cursor
    const [espacio, setEspacio] = useState(false);
    const espacioRef = useRef(false);
    const arrastre = useRef(null); // { x, y, izquierda, arriba } mientras se mueve la vista
    const alPintarRef = useRef(alPintar);
    alPintarRef.current = alPintar; // siempre la versión más reciente, sin volver a correr los efectos

    // Cambia el zoom dejando quieto el punto de la zona que está bajo el cursor (o el centro del visor)
    function cambiarZoom(nuevo, cliente) {
        const visor = visorRef.current;
        const limitado = limitarZoom(nuevo);
        if (!visor || limitado === zoomRef.current) return;
        const caja = visor.getBoundingClientRect();
        const puntoX = cliente ? cliente.x - caja.left : visor.clientWidth / 2;
        const puntoY = cliente ? cliente.y - caja.top : visor.clientHeight / 2;
        fijarPunto.current = {
            x: (visor.scrollLeft + puntoX) / zoomRef.current,
            y: (visor.scrollTop + puntoY) / zoomRef.current,
            pantallaX: puntoX,
            pantallaY: puntoY,
        };
        zoomRef.current = limitado;
        setZoom(limitado);
    }

    // Hace caber el lienzo del proyecto en el visor y lo deja centrado en la parte que no tapan los paneles
    function ajustar() {
        const visor = visorRef.current;
        if (!visor) return;
        const libre = visor.clientHeight - MARGEN_SUPERIOR - MARGEN_INFERIOR;
        const ajustado = zoomParaAjustar(visor.clientWidth, libre, ancho, alto, 24);
        fijarPunto.current = {
            x: area.ancho / 2, y: area.alto / 2, pantallaX: visor.clientWidth / 2, pantallaY: MARGEN_SUPERIOR + libre / 2,
        };
        if (ajustado === zoomRef.current && zoomPintado.current === ajustado) {
            // El zoom no cambia y el visor ya está dibujado con él, así que no habrá nuevo dibujo que corrija el scroll: se centra aquí
            visor.scrollLeft = scrollParaFijarPunto(fijarPunto.current.x, fijarPunto.current.pantallaX, ajustado);
            visor.scrollTop = scrollParaFijarPunto(fijarPunto.current.y, fijarPunto.current.pantallaY, ajustado);
            fijarPunto.current = null;
            return;
        }
        zoomRef.current = ajustado;
        setZoom(ajustado);
    }

    // Después de cambiar el zoom, el scroll se corrige para que el punto fijado no se mueva
    useLayoutEffect(() => {
        zoomPintado.current = zoom;
        const visor = visorRef.current;
        const punto = fijarPunto.current;
        if (visor && punto) {
            visor.scrollLeft = scrollParaFijarPunto(punto.x, punto.pantallaX, zoom);
            visor.scrollTop = scrollParaFijarPunto(punto.y, punto.pantallaY, zoom);
            fijarPunto.current = null;
        }
        alPintarRef.current(zoom);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoom]);

    // Al abrir, el lienzo del proyecto se ve entero y centrado
    useLayoutEffect(() => {
        ajustar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Rueda del mouse: zoom hacia el cursor. Se registra a mano porque React la trata como pasiva y
    // entonces no podría evitar que la página se desplace.
    useEffect(() => {
        const visor = visorRef.current;
        if (!visor) return undefined;
        function alRodar(evento) {
            evento.preventDefault();
            const factor = evento.deltaY < 0 ? 1.1 : 1 / 1.1;
            cambiarZoom(zoomRef.current * factor, { x: evento.clientX, y: evento.clientY });
        }
        visor.addEventListener('wheel', alRodar, { passive: false });
        return () => visor.removeEventListener('wheel', alRodar);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Barra espaciadora: mientras está presionada, arrastrar mueve la vista (no cuenta si se está escribiendo
    // o si el foco está en un botón, donde la barra lo activa)
    useEffect(() => {
        const enCampo = (evento) => evento.target?.closest?.('input, textarea, select, button, [contenteditable="true"]');
        function alPresionar(evento) {
            if (evento.code !== 'Space' || enCampo(evento)) return;
            evento.preventDefault();
            espacioRef.current = true;
            setEspacio(true);
        }
        function alSoltar(evento) {
            if (evento.code !== 'Space') return;
            espacioRef.current = false;
            setEspacio(false);
        }
        window.addEventListener('keydown', alPresionar);
        window.addEventListener('keyup', alSoltar);
        return () => {
            window.removeEventListener('keydown', alPresionar);
            window.removeEventListener('keyup', alSoltar);
        };
    }, []);

    const paneo = {
        empezar(evento) {
            if (!(evento.button === 1 || (evento.button === 0 && espacioRef.current))) return false;
            evento.preventDefault();
            evento.currentTarget.setPointerCapture(evento.pointerId);
            const visor = visorRef.current;
            arrastre.current = { x: evento.clientX, y: evento.clientY, izquierda: visor.scrollLeft, arriba: visor.scrollTop };
            return true;
        },
        seguir(evento) {
            const actual = arrastre.current;
            if (!actual) return false;
            visorRef.current.scrollLeft = actual.izquierda - (evento.clientX - actual.x);
            visorRef.current.scrollTop = actual.arriba - (evento.clientY - actual.y);
            return true;
        },
        terminar() {
            if (!arrastre.current) return false;
            arrastre.current = null;
            return true;
        },
    };

    return {
        zoom,
        zoomRef,
        espacio,
        acercar: () => cambiarZoom(siguienteZoom(zoomRef.current, 1)),
        alejar: () => cambiarZoom(siguienteZoom(zoomRef.current, -1)),
        zoomReal: () => cambiarZoom(1),
        ajustar,
        paneo,
    };
}

export default useVistaLienzo;