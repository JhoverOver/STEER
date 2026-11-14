import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    obtenerAtajos as obtenerAtajosAPI,
    guardarAtajos as guardarAtajosAPI,
    obtenerMensajeError,
} from '../services/servicioAPI';
import {
    ACCIONES, combinarAtajos, atajosParaGuardar, combinacionDeEvento, validarAtajo, formatearCombinacion,
} from '../utils/atajosArte';

// Preferencias de la cuenta (RF44 y RF45): atajos de teclado del editor de imagen.
// Se elige una acción, se presiona la combinación nueva y se guarda. Solo se envía al servidor lo que
// se aparta de los atajos de fábrica.
function PaginaPreferencias() {
    const navigate = useNavigate();
    const [atajos, setAtajos] = useState(null); // { accion: combinacion }; null mientras carga
    const [original, setOriginal] = useState({}); // lo último guardado, para saber si hay cambios
    const [grabando, setGrabando] = useState(null); // id de la acción que espera una tecla
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [guardando, setGuardando] = useState(false);

    function manejarErrorAPI(err) {
        if (err.response?.status === 401) {
            navigate('/login');
            return;
        }
        setError(obtenerMensajeError(err));
    }

    useEffect(() => {
        let vigente = true;
        (async () => {
            try {
                const guardados = await obtenerAtajosAPI();
                if (!vigente) return;
                setAtajos(combinarAtajos(guardados));
                setOriginal(atajosParaGuardar(combinarAtajos(guardados)));
            } catch (err) {
                if (vigente) manejarErrorAPI(err);
            }
        })();
        return () => { vigente = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Mientras se espera una combinación, la próxima tecla se asigna a esa acción
    useEffect(() => {
        if (!grabando) return undefined;
        function alTeclear(evento) {
            evento.preventDefault();
            evento.stopPropagation();
            if (evento.key === 'Escape') {
                setGrabando(null);
                setError('');
                return;
            }
            const combinacion = combinacionDeEvento(evento);
            if (!combinacion) return; // solo se presionó un modificador: se sigue esperando
            const problema = validarAtajo(grabando, combinacion, atajos);
            if (problema) {
                setError(problema);
                return;
            }
            setAtajos((actuales) => ({ ...actuales, [grabando]: combinacion }));
            setGrabando(null);
            setError('');
            setMensaje('');
        }
        window.addEventListener('keydown', alTeclear, true);
        return () => window.removeEventListener('keydown', alTeclear, true);
    }, [grabando, atajos]);

    function restablecer(accion) {
        setAtajos((actuales) => ({ ...actuales, [accion.id]: accion.atajo }));
        setError('');
        setMensaje('');
    }

    function restablecerTodos() {
        setAtajos(combinarAtajos({}));
        setGrabando(null);
        setError('');
        setMensaje('');
    }

    const cambios = atajos ? atajosParaGuardar(atajos) : {};
    const hayCambios = JSON.stringify(cambios) !== JSON.stringify(original);

    async function guardar() {
        setGuardando(true);
        setError('');
        setMensaje('');
        try {
            const guardados = await guardarAtajosAPI(cambios);
            setAtajos(combinarAtajos(guardados));
            setOriginal(atajosParaGuardar(combinarAtajos(guardados)));
            setMensaje('Atajos guardados.');
        } catch (err) {
            manejarErrorAPI(err);
        } finally {
            setGuardando(false);
        }
    }

    return (
        <main>
            <header>
                <h1>Preferencias</h1>
                <Link to="/proyectos">Volver a mis proyectos</Link>
            </header>

            <section aria-labelledby="titulo-atajos">
                <h2 id="titulo-atajos">Atajos de teclado del editor</h2>
                <p>Elige "Cambiar", presiona la combinación nueva (Esc cancela) y guarda.</p>

                {error && <p role="alert">{error}</p>}
                {mensaje && <p role="status">{mensaje}</p>}

                {!atajos ? (
                    !error && <p role="status">Cargando atajos...</p>
                ) : (
                    <>
                        <table>
                            <thead>
                                <tr><th>Acción</th><th>Atajo</th><th>Opciones</th></tr>
                            </thead>
                            <tbody>
                                {ACCIONES.map((accion) => (
                                    <tr key={accion.id}>
                                        <td>{accion.nombre}</td>
                                        <td>
                                            {grabando === accion.id
                                                ? <em>Presiona una combinación...</em>
                                                : <kbd>{formatearCombinacion(atajos[accion.id])}</kbd>}
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                onClick={() => { setGrabando(accion.id); setError(''); setMensaje(''); }}
                                                disabled={guardando || grabando === accion.id}
                                                aria-label={`Cambiar atajo de ${accion.nombre}`}
                                            >
                                                Cambiar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => restablecer(accion)}
                                                disabled={guardando || atajos[accion.id] === accion.atajo}
                                                aria-label={`Restablecer atajo de ${accion.nombre}`}
                                            >
                                                Restablecer
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <button type="button" onClick={guardar} disabled={!hayCambios || guardando || Boolean(grabando)}>
                            {guardando ? 'Guardando...' : 'Guardar atajos'}
                        </button>
                        <button type="button" onClick={restablecerTodos} disabled={guardando}>Restablecer todos</button>
                    </>
                )}
            </section>
        </main>
    );
}

export default PaginaPreferencias;