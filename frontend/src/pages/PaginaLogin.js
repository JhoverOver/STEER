import { Link, useLocation, useNavigate } from 'react-router-dom';
import { iniciarSesion, guardarToken, obtenerMensajeError } from '../services/servicioAPI';
import CampoFormulario from '../components/CampoFormulario';
import useFormulario from '../hooks/useFormulario';
import { validarEmail, validarContrasenaObligatoria } from '../utils/validaciones';

function PaginaLogin() {
    const formulario = useFormulario({ email: '', contrasena: '' });
    const { valores, campo, error, cargando } = formulario;
    const navigate = useNavigate();
    const aviso = useLocation().state?.mensaje;

    function manejarEnvio(evento) {
        evento.preventDefault();
        const email = valores.email.trim();
        const valido = formulario.revisar({
            email: validarEmail(valores.email),
            contrasena: validarContrasenaObligatoria(valores.contrasena),
        });
        if (!valido) return;
        formulario.enviar(async () => {
            const { token, usuario } = await iniciarSesion(email, valores.contrasena);
            guardarToken(token, usuario);
            navigate('/proyectos');
        }, (err) => {
            // Contraseña correcta, pero la cuenta no está verificada: a la página del código
            if (err.response?.status !== 403 || !err.response.data?.verificar) return false;
            navigate('/verificar', { state: { email, mensaje: obtenerMensajeError(err) } });
            return true;
        });
    }

    return (
        <main className="pagina-auth">
            <h1>Iniciar sesión</h1>

            {aviso && <p role="status">{aviso}</p>}

            <form onSubmit={manejarEnvio} noValidate>
                <CampoFormulario {...campo('email')} etiqueta="Correo" tipo="email" autoComplete="email" />
                <CampoFormulario {...campo('contrasena')} etiqueta="Contraseña" tipo="password" autoComplete="current-password" />

                {error && <p role="alert">{error}</p>}

                <button type="submit" disabled={cargando} aria-busy={cargando}>
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
