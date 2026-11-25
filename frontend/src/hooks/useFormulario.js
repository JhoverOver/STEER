import { useState } from 'react';
import { obtenerMensajeError } from '../services/servicioAPI';
import { hayErrores } from '../utils/validaciones';

// Estado común de los formularios (iniciar sesión, registrarse, verificar el correo, crear o editar un proyecto):
// el valor de cada campo, su error, el error general y si se está enviando. Antes cada formulario lo repetía.
//
// iniciales   { campo: valor inicial }
// prefijo     se antepone al id de cada campo ("nuevo" -> "nuevo-nombre"), para tener dos formularios en la página
//
// Devuelve:
//   valores, cambiar(campo, valor), errores, error, setError, cargando
//   campo(nombre)        props para CampoFormulario: id, valor, onChange (borra el error del campo) y error
//   revisar(errores)     muestra los errores; si hay alguno, enfoca el primer campo con error y devuelve false
//   enviar(accion, alFallar)   corre "accion" marcando que se está enviando. Si falla, alFallar(err) puede
//                              atender el error y devolver true; si no, se muestra el mensaje del servidor
function useFormulario(iniciales, prefijo = '') {
    const [valores, setValores] = useState(iniciales);
    const [errores, setErrores] = useState({});
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);
    const idDe = (nombre) => (prefijo ? `${prefijo}-${nombre}` : nombre);

    function cambiar(nombre, valor) {
        setValores((actuales) => ({ ...actuales, [nombre]: valor }));
        setErrores((actuales) => (actuales[nombre] ? { ...actuales, [nombre]: '' } : actuales));
    }

    function campo(nombre) {
        return { id: idDe(nombre), valor: valores[nombre], onChange: (valor) => cambiar(nombre, valor), error: errores[nombre] };
    }

    function revisar(nuevos) {
        setErrores(nuevos);
        if (!hayErrores(nuevos)) return true;
        const primero = Object.keys(nuevos).find((nombre) => nuevos[nombre]);
        document.getElementById(idDe(primero))?.focus();
        return false;
    }

    async function enviar(accion, alFallar) {
        setError('');
        setCargando(true);
        try {
            await accion();
        } catch (err) {
            setCargando(false);
            if (!alFallar || !alFallar(err)) setError(obtenerMensajeError(err));
        }
    }

    return { valores, cambiar, errores, error, setError, cargando, campo, revisar, enviar };
}

export default useFormulario;
