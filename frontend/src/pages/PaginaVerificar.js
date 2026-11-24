import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { verificarCorreo, reenviarCodigo, guardarToken, obtenerMensajeError } from '../services/servicioAPI';
import CampoFormulario from '../components/CampoFormulario';
import { validarEmail, hayErrores, enfocarPrimerError } from '../utils/validaciones';

const SEGUNDOS_ENTRE_ENVIOS = 60; // los mismos que espera el servidor
const IDS_CAMPOS = { email: 'email', codigo: 'codigo' };

// Página para activar la cuenta con el código de 6 dígitos que llega al correo.
// Se llega desde el registro (con el correo y un código recién enviado) o desde el inicio de sesión de una cuenta
// sin verificar (con el correo; el código anterior puede haber vencido, así que se puede pedir otro de inmediato).
// Si se abre directo, también pide el correo. Al verificar queda la sesión iniciada.
function PaginaVerificar() {
    const location = useLocation();
    const navigate = useNavigate();
    const estado = location.state || {};
    const [email, setEmail] = useState(estado.email || '');
    const [codigo, setCodigo] = useState('');
    const [errores, setErrores] = useState({});
    const [error, setError] = useState('');
    const [aviso, setAviso] = useState(estado.mensaje || '');
    const [cargando, setCargando] = useState(false);
    const [espera, setEspera] = useState(estado.recienEnviado ? SEGUNDOS_ENTRE_ENVIOS : 0);
    const correoConocido = Boolean(estado.email);

    // Cuenta regresiva para poder pedir otro código
    useEffect(() => {
        if (espera <= 0) return undefined;
        const temporizador = setTimeout(() => setEspera((s) => s - 1), 1000);
        return () => clearTimeout(temporizador);
    }, [espera]);

    function limpiarError(campo) {
        setErrores((actuales) => (actuales[campo] ? { ...actuales, [campo]: '' } : actuales));
    }

    async function manejarEnvio(evento) {
        evento.preventDefault();
        setError('');
        const limpio = codigo.replace(/\s/g, '');
        const erroresNuevos = {
            email: validarEmail(email),
            codigo: /^\d{6}$/.test(limpio) ? '' : 'Ingresa los 6 dígitos del código.',
        };
        setErrores(erroresNuevos);
        if (hayErrores(erroresNuevos)) {
            enfocarPrimerError(erroresNuevos, IDS_CAMPOS);
            return;
        }
        setCargando(true);
        try {
            const { token } = await verificarCorreo(email.trim(), limpio);
            guardarToken(token);
            navigate('/proyectos');
        } catch (err) {
            if (err.response?.status === 409) {
                navigate('/login', { state: { mensaje: 'Tu cuenta ya está verificada. Inicia sesión.' } });
                return;
            }
            setError(obtenerMensajeError(err));
            setCargando(false);
        }
    }

    async function pedirOtro() {
        setError('');
        const errorEmail = validarEmail(email);
        if (errorEmail) {
            setErrores({ email: errorEmail });
            enfocarPrimerError({ email: errorEmail }, IDS_CAMPOS);
            return;
        }
        try {
            await reenviarCodigo(email.trim());
            setAviso(`Si ${email.trim()} tiene una cuenta sin verificar, te enviamos un código nuevo.`);
            setCodigo('');
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
                    Te enviamos un código de 6 dígitos a <strong>{estado.email}</strong>. Vence en 15 minutos; si no lo ves,
                    revisa la carpeta de spam.
                </p>
            ) : (
                <p>Ingresa tu correo y el código de 6 dígitos que te enviamos.</p>
            )}
            {aviso && <p role="status">{aviso}</p>}

            <form onSubmit={manejarEnvio} noValidate>
                {!correoConocido && (
                    <CampoFormulario
                        id="email"
                        etiqueta="Correo"
                        tipo="email"
                        valor={email}
                        onChange={(v) => { setEmail(v); limpiarError('email'); }}
                        error={errores.email}
                        autoComplete="email"
                    />
                )}
                <CampoFormulario
                    id="codigo"
                    etiqueta="Código"
                    valor={codigo}
                    onChange={(v) => { setCodigo(v.replace(/[^\d\s]/g, '')); limpiarError('codigo'); }}
                    error={errores.codigo}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={7}
                    placeholder="000000"
                />

                {error && <p role="alert">{error}</p>}

                <button type="submit" disabled={cargando}>
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