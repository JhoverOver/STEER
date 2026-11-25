import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { verificarCorreo, reenviarCodigo, guardarToken, obtenerMensajeError } from '../services/servicioAPI';
import CampoFormulario from '../components/CampoFormulario';
import useFormulario from '../hooks/useFormulario';
import { validarEmail } from '../utils/validaciones';

const SEGUNDOS_ENTRE_ENVIOS = 60; // los mismos que espera el servidor

// Página para activar la cuenta con el código de 6 dígitos que llega al correo.
// Se llega desde el registro (con el correo y un código recién enviado) o desde el inicio de sesión de una cuenta
// sin verificar (con el correo; el código anterior puede haber vencido, así que se puede pedir otro de inmediato).
// Si se abre directo, también pide el correo. Al verificar queda la sesión iniciada.
function PaginaVerificar() {
    const location = useLocation();
    const navigate = useNavigate();
    const estado = location.state || {};
    const formulario = useFormulario({ email: estado.email || '', codigo: '' });
    const { valores, campo, error, setError, cargando } = formulario;
    const email = valores.email.trim();
    const [aviso, setAviso] = useState(estado.mensaje || '');
    const [espera, setEspera] = useState(estado.recienEnviado ? SEGUNDOS_ENTRE_ENVIOS : 0);
    const correoConocido = Boolean(estado.email);

    // Cuenta regresiva para poder pedir otro código
    useEffect(() => {
        if (espera <= 0) return undefined;
        const temporizador = setTimeout(() => setEspera((s) => s - 1), 1000);
        return () => clearTimeout(temporizador);
    }, [espera]);

    function manejarEnvio(evento) {
        evento.preventDefault();
        const limpio = valores.codigo.replace(/\s/g, '');
        const valido = formulario.revisar({
            email: validarEmail(valores.email),
            codigo: /^\d{6}$/.test(limpio) ? '' : 'Ingresa los 6 dígitos del código.',
        });
        if (!valido) return;
        formulario.enviar(async () => {
            const { token, usuario } = await verificarCorreo(email, limpio);
            guardarToken(token, usuario);
            navigate('/proyectos');
        }, (err) => {
            if (err.response?.status !== 409) return false;
            navigate('/login', { state: { mensaje: 'Tu cuenta ya está verificada. Inicia sesión.' } });
            return true;
        });
    }

    async function pedirOtro() {
        setError('');
        if (!formulario.revisar({ email: validarEmail(valores.email) })) return;
        try {
            await reenviarCodigo(email);
            setAviso(`Si ${email} tiene una cuenta sin verificar, te enviamos un código nuevo.`);
            formulario.cambiar('codigo', '');
            setEspera(SEGUNDOS_ENTRE_ENVIOS);
        } catch (err) {
            // 429: el servidor envió un código hace poco (por ejemplo, al registrarse); se espera lo que falta
            const faltan = err.response?.status === 429 ? Number(err.response.data?.espera) : 0;
            if (faltan > 0) setEspera(faltan);
            setError(obtenerMensajeError(err));
        }
    }

    return (
        <main className="pagina-auth pagina-verificar">
            <h1>Verifica tu correo</h1>
            {correoConocido ? (
                <p>
                    Te enviamos un código a <strong>{estado.email}</strong> (revisa también spam).
                </p>
            ) : null}
            {aviso && <p role="status">{aviso}</p>}

            <form onSubmit={manejarEnvio} noValidate>
                {!correoConocido && (
                    <CampoFormulario {...campo('email')} etiqueta="Correo" tipo="email" autoComplete="email" />
                )}
                <CampoFormulario
                    {...campo('codigo')}
                    onChange={(v) => formulario.cambiar('codigo', v.replace(/[^\d\s]/g, ''))}
                    etiqueta="Código"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={7}
                    placeholder="000000"
                />

                {error && <p role="alert">{error}</p>}

                <button type="submit" disabled={cargando} aria-busy={cargando}>
                    {cargando ? 'Verificando...' : 'Verificar y entrar'}
                </button>
            </form>

            <button type="button" className="boton-reenviar" onClick={pedirOtro} disabled={espera > 0 || cargando}>
                {espera > 0 ? `Pedir otro código (${espera} s)` : 'Pedir otro código'}
            </button>

            <p>
                <Link to="/login">Volver a iniciar sesión</Link>
            </p>
        </main>
    );
}

export default PaginaVerificar;