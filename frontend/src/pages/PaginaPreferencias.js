import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import BotonIcono from '../components/BotonIcono';
import {
    obtenerAtajos as obtenerAtajosAPI,
    guardarAtajos as guardarAtajosAPI,
    obtenerMensajeError,
} from '../services/servicioAPI';
import {
    ACCIONES, combinarAtajos, atajosParaGuardar, combinacionDeEvento, validarAtajo, formatearCombinacion,
} from '../utils/atajosArte';

// Preferencias de la cuenta (RF44 y RF45): atajos de teclado del editor de imagen.
// Se hace clic en el atajo de una acción, se presiona la combinación nueva y se guarda. Solo se envía al servidor lo que
// se aparta de los atajos de fábrica.
function PaginaPreferencias() {
    const [atajos, setAtajos] = useState(null); // { accion: combinacion }; null mientras carga
    const [original, setOriginal] = useState({}); // lo último guardado, para saber si hay cambios
    const [grabando, setGrabando] = useState(null); // id de la acción que espera una tecla
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        let vigente = true;
        (async () => {
            try {
                const guardados = await obtenerAtajosAPI();
                if (!vigente) return;
                setAtajos(combinarAtajos(guardados));
                setOriginal(atajosParaGuardar(combinarAtajos(guardados)));
            } catch (err) {
                if (vigente) setError(obtenerMensajeError(err));
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
            setError(obtenerMensajeError(err));
        } finally {
            setGuardando(false);
        }
    }

    return (
        <main className="pagina-preferencias">
            <header>
                <Link
                    to="/proyectos"
                    className="boton-icono ayuda-abajo"
                    aria-label="Volver a mis proyectos"
                    data-ayuda="Volver a mis proyectos"
                >
                    <ArrowLeft aria-hidden="true" size={18} />
                </Link>
                <h1>Preferencias</h1>
            </header>

            <section aria-labelledby="titulo-atajos">
                <h2 id="titulo-atajos">Atajos de teclado</h2>

                {error && <p role="alert">{error}</p>}
                {mensaje && <p role="status">{mensaje}</p>}

                {!atajos ? (
                    !error && <p role="status" aria-busy="true">Cargando...</p>
                ) : (
                    <>
                        <table>
                            <thead>
                                <tr><th>Acción</th><th>Atajo</th><th><span className="solo-lector">Restablecer</span></th></tr>
                            </thead>
                            <tbody>
                                {ACCIONES.map((accion) => (
                                    <tr key={accion.id}>
                                        <td>{accion.nombre}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className={`boton-atajo${grabando === accion.id ? ' grabando' : ''}`}
                                                onClick={() => { setGrabando(accion.id); setError(''); setMensaje(''); }}
                                                disabled={guardando}
                                                aria-label={`Cambiar atajo de ${accion.nombre}`}
                                                title="Clic y presiona la combinación nueva"
                                            >
                                                {grabando === accion.id ? '...' : <kbd>{formatearCombinacion(atajos[accion.id])}</kbd>}
                                            </button>
                                        </td>
                                        <td>
                                            {atajos[accion.id] !== accion.atajo && (
                                                <BotonIcono
                                                    icono={RotateCcw}
                                                    texto={`Restablecer atajo de ${accion.nombre}`}
                                                    onClick={() => restablecer(accion)}
                                                    disabled={guardando}
                                                />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="acciones-preferencias">
                            <button type="button" onClick={restablecerTodos} disabled={guardando}>Restablecer todos</button>
                            <button type="button" className="boton-principal" onClick={guardar} disabled={!hayCambios || guardando || Boolean(grabando)} aria-busy={guardando}>
                                {guardando ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </>
                )}
            </section>
        </main>
    );
}

export default PaginaPreferencias;