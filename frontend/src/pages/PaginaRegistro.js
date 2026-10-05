import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registrar, obtenerMensajeError } from '../services/servicioAPI';
import CampoFormulario from '../components/CampoFormulario';
import {
    validarObligatorio,
    validarEmail,
    validarContrasenaNueva,
    validarConfirmacion,
    hayErrores,
    enfocarPrimerError,
}   from '../utils/validaciones';

const LARGO_MINIMO_CONTRASENA = 8;
const IDS_CAMPOS = {nombre: 'nombre', email: 'email', contrasena: 'contrasena', confirmacion: 'confirmacion'};


function PaginaRegistro() {
    const [nombre, setNombre] = useState('');
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
            nombre: validarObligatorio(nombre),
            email: validarEmail(email),
            contrasena: validarContrasenaNueva(contrasena, LARGO_MINIMO_CONTRASENA),
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
            await registrar(nombre.trim(), email.trim(), contrasena);
            navigate('/login', {state: {mensaje: 'Cuenta creada'}});
        }   catch(err) {
            if (err.response?.status === 409) {
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
                id="nombre"
                etiqueta="Nombre"
                valor={nombre}
                onChange={(v) => { setNombre(v); limpiarError('nombre');}}
                error={errores.nombre}
                autoComplete="name"
                />

                <CampoFormulario
                id="email"
                etiqueta="Correo"
                tipo="email"
                valor={email}
                onChange={(v) => { setEmail(v); limpiarError('email');}}
                error={errores.email}
                autoComplete="email"
                />

                <CampoFormulario
                id="contrasena"
                etiqueta="Contraseña"
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