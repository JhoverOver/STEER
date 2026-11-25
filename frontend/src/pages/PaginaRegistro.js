import { Link, useNavigate } from 'react-router-dom';
import { registrar, obtenerMensajeError } from '../services/servicioAPI';
import CampoFormulario from '../components/CampoFormulario';
import useFormulario from '../hooks/useFormulario';
import { validarEmailEstricto, validarContrasenaSegura, validarConfirmacion } from '../utils/validaciones';

function PaginaRegistro() {
    const formulario = useFormulario({ email: '', contrasena: '', confirmacion: '' });
    const { valores, campo, error, cargando } = formulario;
    const navigate = useNavigate();

    function manejarEnvio(evento) {
        evento.preventDefault();
        const email = valores.email.trim();
        const valido = formulario.revisar({
            email: validarEmailEstricto(valores.email),
            contrasena: validarContrasenaSegura(valores.contrasena),
            confirmacion: validarConfirmacion(valores.confirmacion, valores.contrasena),
        });
        if (!valido) return;
        formulario.enviar(async () => {
            await registrar(email, valores.contrasena);
            // La cuenta queda sin verificar: el código llegó al correo y se ingresa en la página siguiente
            navigate('/verificar', { state: { email, recienEnviado: true } });
        }, (err) => {
            // 409: el correo ya tiene cuenta. 400 con "correo": temporal o dominio sin correo (se marca el campo)
            const estado = err.response?.status;
            if (estado !== 409 && !(estado === 400 && /correo|dominio/i.test(err.response.data?.error || ''))) return false;
            formulario.revisar({ email: obtenerMensajeError(err) });
            return true;
        });
    }

    return (
        <main className="pagina-auth">
            <h1>Crear cuenta</h1>
            <form onSubmit={manejarEnvio} noValidate>
                <CampoFormulario {...campo('email')} etiqueta="Correo" tipo="email" autoComplete="email" />

                <CampoFormulario
                    {...campo('contrasena')}
                    etiqueta="Contraseña"
                    placeholder="Mínimo 8, con A, a y 1"
                    tipo="password"
                    autoComplete="new-password"
                />

                <CampoFormulario {...campo('confirmacion')} etiqueta="Confirma la contraseña" tipo="password" autoComplete="new-password" />

                {error && <p role="alert">{error}</p>}

                <button type="submit" disabled={cargando} aria-busy={cargando}>
                    {cargando ? 'Creando cuenta...' : 'Registrarme'}
                </button>
            </form>

            <p>
                ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
            </p>
        </main>
    );
}

export default PaginaRegistro;