import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleUserRound, Keyboard, LogOut } from 'lucide-react';
import BotonIcono from './BotonIcono';
import { borrarToken, correoDeSesion } from '../services/servicioAPI';
import useTeclado from '../hooks/useTeclado';

// Botón de perfil, siempre arriba a la derecha. Abre un menú con el correo de la sesión, las preferencias de
// teclado y cerrar sesión. Se cierra al elegir, al hacer clic afuera o con Esc.
//
// Props:
//   posicion        dónde se abre el menú: 'abajo' (bajo el botón) o 'izquierda' (a su lado, en la barra derecha)
//   puedeSalir()    se llama antes de cambiar de página; si devuelve false no se sale (cambios sin guardar)
function MenuPerfil({ posicion = 'abajo', puedeSalir = () => true }) {
    const [abierto, setAbierto] = useState(false);
    const contenedor = useRef(null);
    const navigate = useNavigate();
    const correo = correoDeSesion();

    useTeclado((evento) => (evento.key === 'Escape' ? () => setAbierto(false) : null), abierto);
    useEffect(() => {
        if (!abierto) return undefined;
        function alHacerClic(evento) {
            if (contenedor.current && !contenedor.current.contains(evento.target)) setAbierto(false);
        }
        document.addEventListener('pointerdown', alHacerClic);
        return () => document.removeEventListener('pointerdown', alHacerClic);
    }, [abierto]);

    function irAPreferencias() {
        setAbierto(false);
        if (puedeSalir()) navigate('/preferencias');
    }

    function cerrarSesion() {
        setAbierto(false);
        if (!puedeSalir()) return;
        borrarToken();
        navigate('/login');
    }

    return (
        <div className={`menu-perfil menu-${posicion}`} ref={contenedor}>
            <BotonIcono
                icono={CircleUserRound}
                texto="Perfil"
                lado={posicion === 'izquierda' ? 'izquierda' : 'abajo'}
                aria-haspopup="menu"
                aria-expanded={abierto}
                aria-pressed={abierto}
                onClick={() => setAbierto((actual) => !actual)}
            />
            {abierto && (
                <div className="menu-perfil-lista" role="menu" aria-label="Perfil">
                    {correo && <p className="menu-perfil-correo">{correo}</p>}
                    <button type="button" role="menuitem" onClick={irAPreferencias}>
                        <Keyboard aria-hidden="true" size={16} /> Preferencias de teclado
                    </button>
                    <button type="button" role="menuitem" className="menu-peligro" onClick={cerrarSesion}>
                        <LogOut aria-hidden="true" size={16} /> Cerrar sesión
                    </button>
                </div>
            )}
        </div>
    );
}

export default MenuPerfil;
