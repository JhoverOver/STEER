import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { iniciarSesion, guardarToken, obtenerMensajeError } from '../services/servicioAPI';
import CampoFormulario from '../components/CampoFormulario';
import {
    validarEmail,
    validarContrasenaObligatoria,
    hayErrores,
    enfocarPrimerError,
}   from '../utils/validaciones';

const IDS_CAMPOS = {email: 'email', contrasena: 'contrasena'};

function PaginaLogin() {
    const [email, setEmail] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [errores, setErrores] = useState({});
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const aviso = location.state?.mensaje;

    function mostrarError(mensaje) {
        setError(mensaje);
    }

    function limpiarError(campo) {
        setErrores((actuales) => (actuales[campo] ? { ...actuales, [campo]: '' } :actuales));
    }

    function validar() {
        return {
            email: validarEmail(email),
            contrasena: validarContrasenaObligatoria(contrasena),
        };
    }

    async function manejarEnvio(evento) {
        evento.preventDefault();
        setError('');

        const erroresNuevos = validar();
        setErrores(erroresNuevos);
        if (hayErrores(erroresNuevos)) {
            enfocarPrimerError(erroresNuevos, IDS_CAMPOS);
            return;
        }

        setCargando(true);
        try {
            const {token} = await iniciarSesion(email.trim(), contrasena);
            guardarToken(token);
            navigate('/proyectos');
        }   catch (err) {
            mostrarError(obtenerMensajeError(err))
            setCargando(false);
        }
    }

    return (
        <main className="pagina-auth">
            <h1>Iniciar sesión</h1>

            {aviso && <p role="status">{aviso}</p>}

            <form onSubmit={manejarEnvio} noValidate>
                <CampoFormulario
                id="email"
                etiqueta="Correo"
                tipo="email"
                valor={email}
                onChange={(v) => {setEmail(v); limpiarError('email');}}
                error={errores.email}
                autoComplete="email"
                />

                <CampoFormulario
                id="contrasena"
                etiqueta="Contraseña"
                tipo="password"
                valor={contrasena}
                onChange={(v) => {setContrasena(v); limpiarError('contrasena');}}
                error={errores.contrasena}
                autoComplete="current-password"
                />

                {error && <p role="alert">{error}</p>}

                <button type= "submit" disabled={cargando}>
                    {cargando ? 'Ingresando...' : 'Iniciar sesión'}
                </button>
            </form>

            <p>
                ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
            </p>
        </main>
    );
}

export default PaginaLogin;