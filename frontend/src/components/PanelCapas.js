import { useState } from 'react';
import { MAX_CAPAS, MAXIMO_NOMBRE_CAPA, checkEspacio, checkNombre } from '../utils/capas';

// Lista de capas del fotograma que se edita (RF26 a RF34). No toca píxeles ni guarda nada: muestra las capas
// y avisa al editor lo que el usuario pide. La capa de más arriba se muestra primera.
//
// Props:
//   capas, claveActiva      lista de capas (utils/capas.js, la primera es la de abajo) y la seleccionada
//   onSeleccionar(clave)    elegir la capa activa
//   onAgregar()             capa nueva sobre la activa
//   onDuplicar()            duplicar la activa
//   onEliminar(clave)       eliminar (el panel pide confirmación antes)
//   onRenombrar(clave, nombre)
//   onReordenar(clave, destino)   destino: posición nueva (0 = abajo del todo)
//   onVisibilidad(clave), onBloqueo(clave)
function PanelCapas({
    capas, claveActiva, onSeleccionar, onAgregar, onDuplicar, onEliminar, onRenombrar, onReordenar, onVisibilidad, onBloqueo,
}) {
    const [editando, setEditando] = useState(null); // { clave, texto } mientras se renombra
    const [error, setError] = useState('');
    const [confirmando, setConfirmando] = useState(null); // clave de la capa que se quiere eliminar

    const hayEspacio = checkEspacio(capas);
    const arriba = [...capas].reverse();

    function empezarRenombre(capa) {
        setConfirmando(null);
        setError('');
        setEditando({ clave: capa.clave, texto: capa.nombre });
    }

    function guardarRenombre(evento) {
        evento.preventDefault();
        if (!checkNombre(editando.texto)) {
            setError(`El nombre debe tener entre 1 y ${MAXIMO_NOMBRE_CAPA} caracteres.`);
            return;
        }
        onRenombrar(editando.clave, editando.texto.trim());
        setEditando(null);
        setError('');
    }

    function cancelarRenombre() {
        setEditando(null);
        setError('');
    }

    function confirmarEliminar(clave) {
        onEliminar(clave);
        setConfirmando(null);
    }

    return (
        <section className="panel-capas" aria-label="Capas">
            <h2>Capas <span>({capas.length} / {MAX_CAPAS})</span></h2>
            <div className="panel-capas-acciones">
                <button type="button" onClick={onAgregar} disabled={!hayEspacio}>Agregar capa</button>
                <button type="button" onClick={onDuplicar} disabled={!hayEspacio || !claveActiva}>Duplicar capa</button>
            </div>
            {!hayEspacio && <p role="status">Llegaste al máximo de {MAX_CAPAS} capas por fotograma.</p>}
            {error && <p role="alert">{error}</p>}

            <ul>
                {arriba.map((capa) => {
                    const indice = capas.indexOf(capa);
                    const activa = capa.clave === claveActiva;
                    return (
                        <li key={capa.clave} className={activa ? 'capa-activa' : undefined} aria-current={activa ? 'true' : undefined}>
                            {editando && editando.clave === capa.clave ? (
                                <form onSubmit={guardarRenombre} onKeyDown={(e) => { if (e.key === 'Escape') cancelarRenombre(); }}>
                                    <input
                                        aria-label="Nombre de la capa"
                                        value={editando.texto}
                                        maxLength={MAXIMO_NOMBRE_CAPA}
                                        autoFocus
                                        onChange={(e) => setEditando({ ...editando, texto: e.target.value })}
                                    />
                                    <button type="submit">Guardar</button>
                                    <button type="button" onClick={cancelarRenombre}>Cancelar</button>
                                </form>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="capa-nombre"
                                        aria-pressed={activa}
                                        onClick={() => onSeleccionar(capa.clave)}
                                        onDoubleClick={() => empezarRenombre(capa)}
                                    >
                                        {capa.nombre}
                                    </button>
                                    <button type="button" onClick={() => onVisibilidad(capa.clave)} aria-label={`${capa.visible ? 'Ocultar' : 'Mostrar'} ${capa.nombre}`}>
                                        {capa.visible ? 'Ocultar' : 'Mostrar'}
                                    </button>
                                    <button type="button" onClick={() => onBloqueo(capa.clave)} aria-label={`${capa.bloqueada ? 'Desbloquear' : 'Bloquear'} ${capa.nombre}`}>
                                        {capa.bloqueada ? 'Desbloquear' : 'Bloquear'}
                                    </button>
                                    <button type="button" onClick={() => onReordenar(capa.clave, indice + 1)} disabled={indice === capas.length - 1} aria-label={`Subir ${capa.nombre}`}>Subir</button>
                                    <button type="button" onClick={() => onReordenar(capa.clave, indice - 1)} disabled={indice === 0} aria-label={`Bajar ${capa.nombre}`}>Bajar</button>
                                    <button type="button" onClick={() => empezarRenombre(capa)} aria-label={`Renombrar ${capa.nombre}`}>Renombrar</button>
                                    {confirmando === capa.clave ? (
                                        <span>
                                            ¿Eliminar?
                                            <button type="button" onClick={() => confirmarEliminar(capa.clave)}>Sí, eliminar</button>
                                            <button type="button" onClick={() => setConfirmando(null)}>No</button>
                                        </span>
                                    ) : (
                                        <button type="button" onClick={() => setConfirmando(capa.clave)} disabled={capas.length <= 1} aria-label={`Eliminar ${capa.nombre}`}>Eliminar</button>
                                    )}
                                </>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

export default PanelCapas;