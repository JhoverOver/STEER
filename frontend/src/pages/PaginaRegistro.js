import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registrar, obtenerMensajeError } from '../services/servicioAPI';

const LARGO_MINIMO_CONTRASENA = 8;

function PaginaRegistro() {
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [contrasena, setContrasena] =useState('');
    const [confirmacion, setConfirmacion] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    const navigate= useNavigate();

    function mostrarError(mensaje) {
        setError(mensaje);
    }

    function validar() {
        if (!nombre.trim()) return 'El nombre es obligatorio.';
        if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
            return `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres`;
        }
        if (contrasena !== confirmacion) return 'Las contraseñas no coinciden';
        return null;
    }

    async function manejarEnvio(evento) {
        evento.preventDefault();
        setError('');

        const problema =validar();
        if (problema) {
            mostrarError(problema)
            return;
        }

        setCargando(true);
        try {
            await registrar(nombre.trim(), email.trim(), contrasena);
            navigate('/login', {state: {mensaje: 'Cuenta creada.'}});
        } catch (err) {
            mostrarError(obtenerMensajeError(err));
            setCargando(false);
        }
    }

    return (
        <main>
            <h1>Crear cuenta</h1>
            <form onSubmit={manejarEnvio} noValidate>
                <div>
                    <label htmlFor="nombre">Nombre </label>
                    <input
                    id="nombre"
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    autoComplete="name"
                    />
                </div>
                <div>
                    <label htmlFor="email">Correo</label>
                    <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    />
                </div>
                <div>
                    <label htmlFor="contrasena">Contraseña</label>
                    <input
                    id="contrasena"
                    type="password"
                    value={contrasena}
                    onChange={(e) => setContrasena(e.target.value)}
                    autoComplete="new-password"
                    />
                </div>

                <div>
                    <label htmlFor="confirmacion">Confirma la contraseña</label>
                    <input 
                    id="confirmacion"
                    type="password"
                    value={confirmacion}
                    onChange={(e) => setConfirmacion(e.target.value)}
                    autoComplete="new-password"
                    />
                </div>

                {error && <p role="alert">{error}</p>}

                <button type="submit" disabled={cargando}>
                    {cargando ? 'Creando cuenta...' : 'Registrarme'}
                </button>
            </form>

            <p>
                ¿Ya estas registrado? <Link to="/login">inicia sesión</Link>
            </p>
        </main>
    );
}

export default PaginaRegistro;