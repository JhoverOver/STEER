import { useEffect, useRef, useState } from 'react';
import BotonIcono from './BotonIcono';
import useTeclado from '../hooks/useTeclado';

// Botón con símbolo que abre un menú chico a su lado (Perfil, Exportar). Se cierra al elegir una opción, al hacer
// clic afuera o con Esc.
//
// Props:
//   icono, texto, insignia, disabled, aria-busy   los del botón (ver BotonIcono)
//   posicion   dónde se abre el menú: 'abajo' (bajo el botón) o 'izquierda' (a su lado, en la barra derecha)
//   className  clase extra del contenedor
//   children(cerrar)   las opciones del menú; cada una llama a cerrar() al elegirse
function MenuDesplegable({ icono, texto, insignia, posicion = 'abajo', className = '', children, ...boton }) {
    const [abierto, setAbierto] = useState(false);
    const contenedor = useRef(null);
    const cerrar = () => setAbierto(false);

    useTeclado((evento) => (evento.key === 'Escape' ? cerrar : null), abierto);
    useEffect(() => {
        if (!abierto) return undefined;
        function alHacerClic(evento) {
            if (contenedor.current && !contenedor.current.contains(evento.target)) setAbierto(false);
        }
        document.addEventListener('pointerdown', alHacerClic);
        return () => document.removeEventListener('pointerdown', alHacerClic);
    }, [abierto]);

    return (
        <div className={`menu-desplegable menu-${posicion} ${className}`.trim()} ref={contenedor}>
            <BotonIcono
                icono={icono}
                texto={texto}
                insignia={insignia}
                lado={posicion === 'izquierda' ? 'izquierda' : 'abajo'}
                aria-haspopup="menu"
                aria-expanded={abierto}
                aria-pressed={abierto}
                onClick={() => setAbierto((actual) => !actual)}
                {...boton}
            />
            {abierto && (
                <div className="menu-desplegable-lista" role="menu" aria-label={texto}>
                    {children(cerrar)}
                </div>
            )}
        </div>
    );
}

export default MenuDesplegable;
