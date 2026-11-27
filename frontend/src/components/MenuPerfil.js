import { useNavigate } from 'react-router-dom';
import { CircleUserRound, Keyboard, LogOut } from 'lucide-react';
import MenuDesplegable from './MenuDesplegable';
import { borrarToken, correoDeSesion } from '../services/servicioAPI';

// Botón de perfil, siempre arriba a la derecha. Abre un menú con el correo de la sesión, las preferencias de
// teclado y cerrar sesión.
//
// Props:
//   posicion        dónde se abre el menú: 'abajo' (bajo el botón) o 'izquierda' (a su lado, en la barra derecha)
//   puedeSalir()    se llama antes de cambiar de página; si devuelve false no se sale (cambios sin guardar)
function MenuPerfil({ posicion = 'abajo', puedeSalir = () => true }) {
    const navigate = useNavigate();
    const correo = correoDeSesion();

    function ir(cerrar, accion) {
        cerrar();
        if (puedeSalir()) accion();
    }

    return (
        <MenuDesplegable icono={CircleUserRound} texto="Perfil" posicion={posicion} className="menu-perfil">
            {(cerrar) => (
                <>
                    {correo && <p className="menu-desplegable-nota">{correo}</p>}
                    <button type="button" role="menuitem" onClick={() => ir(cerrar, () => navigate('/preferencias'))}>
                        <Keyboard aria-hidden="true" size={16} /> Preferencias de teclado
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        className="menu-peligro"
                        onClick={() => ir(cerrar, () => { borrarToken(); navigate('/login'); })}
                    >
                        <LogOut aria-hidden="true" size={16} /> Cerrar sesión
                    </button>
                </>
            )}
        </MenuDesplegable>
    );
}

export default MenuPerfil;
