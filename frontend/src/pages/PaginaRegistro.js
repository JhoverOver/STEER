import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registrar, obtenerMensajeError } from '../services/servicioAPI';
import CampoFormulario from '../components/CampoFormulario';
import {
    validarEmailEstricto,
    validarContrasenaSegura,
    validarConfirmacion,
    hayErrores,
    enfocarPrimerError,
}   from '../utils/validaciones';

const IDS_CAMPOS = {email: 'email', contrasena: 'contrasena', confirmacion: 'confirmacion'};


function PaginaRegistro() {
    const [email, setEmail] = useState('');
    const [contrasena, setContrasena] =useState('');
    const [confirmacion, setConfirmacion] = useState('');
    const [errores, setErrores] = useState({});
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    const navigate= useNavigate();

    function mostrarError(mensaje) {
        setError(mensaje);
    }

    function limpiarError(campo) {
        setErrores((actuales) => (actuales[campo] ? { ...actuales, [campo]: '' } :actuales));
    }

    function validar() {
        return {
            email: validarEmailEstricto(email),
            contrasena: validarContrasenaSegura(contrasena),
            confirmacion: validarConfirmacion(confirmacion, contrasena),
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
            await registrar(email.trim(), contrasena);
            // La cuenta queda sin verificar: el código llegó al correo y se ingresa en la página siguiente
            navigate('/verificar', { state: { email: email.trim(), recienEnviado: true } });
        }   catch(err) {
            // 409: el correo ya tiene cuenta. 400 con "correo": temporal o dominio sin correo (se marca el campo)
            const estado = err.response?.status;
            if (estado === 409 || (estado === 400 && /correo|dominio/i.test(err.response.data?.error || ''))) {
                setErrores({email:obtenerMensajeError(err) });
                enfocarPrimerError({email:true}, IDS_CAMPOS);
            }   else {
                mostrarError(obtenerMensajeError(err));
            }
            setCargando(false);
        }
    }

    return (
        <main className="pagina-auth">
            <h1>Crear cuenta</h1>
            <form onSubmit={manejarEnvio} noValidate>

                <CampoFormulario
                id="email"
                etiqueta="Correo (Recibirás un correo de verificación)"
                tipo="email"
                valor={email}
                onChange={(v) => { setEmail(v); limpiarError('email');}}
                error={errores.email}
                autoComplete="email"
                />

                <CampoFormulario
                id="contrasena"
                etiqueta="Contraseña (mín. 8 caracteres, con mayúscula, minúscula y número)"
                tipo="password"
                valor={contrasena}
                onChange={(v) => { setContrasena(v); limpiarError('contrasena');}}
                error={errores.contrasena}
                autoComplete="new-password"
                />

                <CampoFormulario
                id="confirmacion"
                etiqueta="Confirma la contraseña"
                tipo="password"
                valor={confirmacion}
                onChange={(v) => { setConfirmacion(v); limpiarError('confirmacion');}}
                error={errores.confirmacion}
                autoComplete="new-password"
                />

                {error && <p role="alert">{error}</p>}

                <button type="submit" disabled={cargando}>
                    {cargando ? 'Creando cuenta...' : 'Registrarme'}
                </button>
            </form>

            <p>
                ¿Ya estás registrado? <Link to="/login">inicia sesión</Link>
            </p>
        </main>
    );
}

export default PaginaRegistro;