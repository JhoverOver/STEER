import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { iniciarSesion, guardarToken, obtenerMensajeError } from '../services/servicioAPI';

function PaginaLogin() {
    const [email, setEmail] = useState('')
    const [contrasena, setContrasena] = useState('')
    const [error, setError] = useState('')
    const [cargando, setCargando] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const aviso= location.state?.mensaje;

    function mostrarError(mensaje) {
        setError(mensaje);
    }


async function manejarEnvio(evento) {
    evento.preventDefault();
    setError('');
    setCargando(true);
    try {
        const {token} = await iniciarSesion(email.trim(),contrasena)
        guardarToken(token);
        navigate('/proyectos');
    } catch(err) {
        mostrarError(obtenerMensajeError(err));
        setCargando(false);
    }
}

return (
    <main>
        <h1>Iniciar sesión</h1>

        {aviso && <p role="status">{aviso}</p>}

        <form onSubmit={manejarEnvio}>
            <div>
                <label htmlFor="email">Correo</label>
                <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                />
            </div>

            <div>
                <label htmlFor="contrasena">Contraseña</label>
                <input
                id="contrasena"
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                autoComplete="current-password"
                required
                />
            </div>

            {error && <p role="alert">{error}</p>}

            <button type="submit" disabled={cargando}>
                {cargando ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
        </form>
        <p>
            ¿No tienes una cuenta? <Link to="/registro">Regístrate</Link>
        </p>
    </main>
);
}

export default PaginaLogin;