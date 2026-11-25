import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import BotonIcono from './BotonIcono';
import SelectorLienzo, { problemaLado } from './SelectorLienzo';
import useTeclado from '../hooks/useTeclado';

const ANCLAS = [0, 0.5, 1];
const NOMBRES_X = { 0: 'izquierda', 0.5: 'centro', 1: 'derecha' };
const NOMBRES_Y = { 0: 'arriba', 0.5: 'centro', 1: 'abajo' };

export function nombreAncla(x, y) {
    if (x === 0.5 && y === 0.5) return 'al centro';
    if (x === 0.5) return NOMBRES_Y[y];
    if (y === 0.5) return `a la ${NOMBRES_X[x]}`;
    return `${NOMBRES_Y[y]} a la ${NOMBRES_X[x]}`;
}

// Dónde queda el dibujo actual dentro del lienzo nuevo (en px, puede ser negativo si se recorta)
export function desplazamiento(anterior, nuevo, anclaX, anclaY) {
    return {
        x: Math.round((nuevo.ancho - anterior.ancho) * anclaX),
        y: Math.round((nuevo.alto - anterior.alto) * anclaY),
    };
}

// Ventana para cambiar el tamaño del lienzo (pestaña Frames). El dibujo no se escala: se agrega espacio o se recorta.
// Ancho y alto parten con las medidas actuales. La rejilla 3×3 (el ancla) dice hacia dónde queda pegado el dibujo
// actual: para agregar espacio arriba, el ancla va abajo. Un esquema muestra el lienzo nuevo (borde dorado) y dónde
// queda el actual (relleno). No lleva explicaciones: se entiende probándolo.
//
// Props: anterior { ancho, alto }, ocupado, onAplicar({ ancho, alto, anclaX, anclaY }), onCerrar()
function DialogoLienzo({ anterior, ocupado = false, onAplicar, onCerrar }) {
    const [medidas, setMedidas] = useState({ ancho: String(anterior.ancho), alto: String(anterior.alto) });
    const [ancla, setAncla] = useState({ x: 0.5, y: 0.5 });
    const [errores, setErrores] = useState({});
    const dialogo = useRef(null);

    useEffect(() => dialogo.current?.querySelector('input')?.focus(), []);
    useTeclado((evento) => (evento.key === 'Escape' ? onCerrar : null));

    const nuevo = { ancho: Number(medidas.ancho), alto: Number(medidas.alto) };
    const valido = !problemaLado(medidas.ancho) && !problemaLado(medidas.alto);
    const igual = valido && nuevo.ancho === anterior.ancho && nuevo.alto === anterior.alto;
    const corrido = valido ? desplazamiento(anterior, nuevo, ancla.x, ancla.y) : { x: 0, y: 0 };

    // Esquema: todo cabe en una caja de 160 px
    const mayor = Math.max(anterior.ancho, anterior.alto, valido ? nuevo.ancho : 0, valido ? nuevo.alto : 0);
    const escala = 160 / mayor;

    function aplicar(evento) {
        evento.preventDefault();
        const nuevosErrores = { ancho: problemaLado(medidas.ancho), alto: problemaLado(medidas.alto) };
        setErrores(nuevosErrores);
        if (nuevosErrores.ancho || nuevosErrores.alto || igual) return;
        onAplicar({ ...nuevo, anclaX: ancla.x, anclaY: ancla.y });
    }

    return (
        <div className="fondo-dialogo" onPointerDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
            <form className="dialogo" role="dialog" aria-modal="true" aria-labelledby="titulo-lienzo" ref={dialogo} onSubmit={aplicar} noValidate>
                <header>
                    <h2 id="titulo-lienzo">Tamaño del lienzo</h2>
                    <BotonIcono icono={X} texto="Cerrar" lado="abajo" onClick={onCerrar} />
                </header>
                <SelectorLienzo
                    prefijo="lienzo"
                    ancho={medidas.ancho}
                    alto={medidas.alto}
                    errores={errores}
                    frecuentes={false}
                    onCambiar={(m) => { setMedidas(m); setErrores({}); }}
                />

                <div className="lienzo-ancla">
                    <fieldset>
                        <legend className="solo-lector">Dónde queda el dibujo</legend>
                        <div className="rejilla-ancla">
                            {ANCLAS.map((y) => ANCLAS.map((x) => (
                                <button
                                    key={`${x}-${y}`}
                                    type="button"
                                    aria-label={`Dibujo ${nombreAncla(x, y)}`}
                                    aria-pressed={ancla.x === x && ancla.y === y}
                                    onClick={() => setAncla({ x, y })}
                                />
                            )))}
                        </div>
                    </fieldset>
                    <div className="esquema-lienzo" aria-hidden="true">
                        {valido && (
                            <div
                                className="esquema-nuevo"
                                style={{ width: nuevo.ancho * escala, height: nuevo.alto * escala }}
                            >
                                <div
                                    className="esquema-anterior"
                                    style={{
                                        left: corrido.x * escala,
                                        top: corrido.y * escala,
                                        width: anterior.ancho * escala,
                                        height: anterior.alto * escala,
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <footer>
                    <button type="button" onClick={onCerrar}>Cancelar</button>
                    <button type="submit" className="boton-principal" disabled={ocupado || igual} aria-busy={ocupado}>
                        {ocupado ? 'Cambiando...' : 'Cambiar tamaño'}
                    </button>
                </footer>
            </form>
        </div>
    );
}

export default DialogoLienzo;
