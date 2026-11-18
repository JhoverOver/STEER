import { useState } from 'react';
import { checkDuracion, MENSAJE_DURACION } from '../utils/operacionesFrames';
import { DURACION_MINIMA, DURACION_MAXIMA, DURACION_INICIAL } from '../config/limites';

// Barra de herramientas de la lista de frames: historial, selección, portapapeles, orden, duración y guardado.
// Las acciones que no tienen frames seleccionados actúan sobre todos (invertir y duración).
//
// Props:
//   deshabilitado        hay una operación con el servidor en curso
//   total, seleccionados cantidad de frames y de frames seleccionados
//   puedeDeshacer, puedeRehacer, puedePegar, puedeInsertar, puedeInvertir, sinGuardar, guardando
//   acciones   { deshacer, rehacer, seleccionarTodo, quitarSeleccion, copiar, pegar, insertar, eliminar,
//                invertir, mover(direccion), aplicarDuracion(valor), guardar }
function BarraEdicionFrames({
    deshabilitado, total, seleccionados, puedeDeshacer, puedeRehacer, puedePegar, puedeInsertar, puedeInvertir,
    sinGuardar, guardando, acciones,
}) {
    const [duracion, setDuracion] = useState(String(DURACION_INICIAL));
    const [errorDuracion, setErrorDuracion] = useState('');

    const haySeleccion = seleccionados > 0;
    const todosMarcados = total > 0 && seleccionados === total;

    function aplicarDuracion() {
        const valor = duracion.trim() === '' ? NaN : Number(duracion);
        if (!checkDuracion(valor)) {
            setErrorDuracion(MENSAJE_DURACION);
            return;
        }
        setErrorDuracion('');
        acciones.aplicarDuracion(valor);
    }

    return (
        <div role="toolbar" aria-label="Herramientas de edición">
            <div role="group" aria-label="Historial">
                <button type="button" onClick={acciones.deshacer} disabled={deshabilitado || !puedeDeshacer}>Deshacer</button>
                <button type="button" onClick={acciones.rehacer} disabled={deshabilitado || !puedeRehacer}>Rehacer</button>
            </div>

            <div role="group" aria-label="Selección">
                {!todosMarcados && (
                    <button type="button" onClick={acciones.seleccionarTodo} disabled={deshabilitado || total === 0}>
                        Seleccionar todo
                    </button>
                )}
                {haySeleccion && (
                    <button type="button" onClick={acciones.quitarSeleccion} disabled={deshabilitado}>Quitar selección</button>
                )}
                <button type="button" onClick={acciones.copiar} disabled={deshabilitado || !haySeleccion}>Copiar</button>
                <button type="button" onClick={acciones.pegar} disabled={deshabilitado || !puedePegar}>Pegar</button>
                <button
                    type="button"
                    onClick={acciones.insertar}
                    disabled={deshabilitado || !puedeInsertar}
                    title="Agrega un frame vacío"
                >
                    Insertar frame en blanco
                </button>
                <button
                    type="button"
                    className="boton-peligro"
                    onClick={acciones.eliminar}
                    disabled={deshabilitado || !haySeleccion}
                >
                    Eliminar
                </button>
            </div>

            <div role="group" aria-label="Orden">
                <button
                    type="button"
                    title="Invierte el orden de los frames seleccionados. (mínimo 2)."
                    onClick={acciones.invertir}
                    disabled={deshabilitado || !puedeInvertir}
                >
                    {haySeleccion ? `Invertir orden (${seleccionados})` : 'Invertir orden (todos)'}
                </button>
                <button type="button" onClick={() => acciones.mover(-1)} disabled={deshabilitado || !haySeleccion}>
                    Mover a la izquierda
                </button>
                <button type="button" onClick={() => acciones.mover(1)} disabled={deshabilitado || !haySeleccion}>
                    Mover a la derecha
                </button>
            </div>

            <div role="group" aria-label="Duración">
                <label htmlFor="duracion-global">Duración (ms)</label>
                <input
                    id="duracion-global"
                    type="number"
                    min={DURACION_MINIMA}
                    max={DURACION_MAXIMA}
                    step="1"
                    value={duracion}
                    disabled={deshabilitado}
                    onChange={(e) => { setDuracion(e.target.value); setErrorDuracion(''); }}
                    aria-invalid={errorDuracion ? 'true' : undefined}
                    onKeyDown={(e) => { if (e.key === 'Enter') aplicarDuracion(); }}
                />
                <button type="button" onClick={aplicarDuracion} disabled={deshabilitado || total === 0}>
                    {haySeleccion ? `Aplicar a la selección (${seleccionados})` : 'Aplicar a todos'}
                </button>
                {errorDuracion && <p className="mensaje-campo" role="alert">{errorDuracion}</p>}
            </div>

            <div role="group" aria-label="Guardado">
                <button
                    type="button"
                    className="boton-principal"
                    onClick={acciones.guardar}
                    disabled={deshabilitado || !sinGuardar}
                    title="Al guardar se reinicia el historial de deshacer"
                >
                    {guardando ? 'Guardando...' : 'Guardar'}
                </button>
            </div>
        </div>
    );
}

export default BarraEdicionFrames;