import { useEffect, useRef } from 'react';

// Escucha el teclado mientras el componente está en pantalla (y "activo" es true). Antes cada pestaña, el editor,
// los menús y los diálogos repetían esta misma escucha.
//
// elegir(evento) dice qué hacer con esa tecla: devuelve una función, o nada si la tecla no es para este componente.
// Si hay función, se evita lo que haría el navegador y se ejecuta; si la función devuelve false, la tecla sigue su
// curso normal (Ctrl + C sin frames elegidos, por ejemplo, copia texto como siempre).
// Siempre se usa la versión más reciente de "elegir", sin volver a registrar la escucha.
function useTeclado(elegir, activo = true) {
    const actual = useRef(elegir);
    actual.current = elegir;

    useEffect(() => {
        if (!activo) return undefined;
        function alPulsar(evento) {
            const accion = actual.current(evento);
            if (accion && accion() !== false) evento.preventDefault();
        }
        window.addEventListener('keydown', alPulsar);
        return () => window.removeEventListener('keydown', alPulsar);
    }, [activo]);
}

export default useTeclado;
