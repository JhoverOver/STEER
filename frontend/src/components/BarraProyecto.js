import { FolderOpen } from 'lucide-react';
import BotonIcono from './BotonIcono';

// Barra fija a la derecha de la pantalla del proyecto: abre y cierra Archivos, y lleva a cada parte del proyecto.
// Siempre se ve, para pasar de una parte a otra sin perder los archivos subidos.
//
// Props:
//   etapas   [{ id, nombre, icono, disponible, actual }]   (las no disponibles necesitan frames)
//   onEtapa(id)
//   archivosAbierto, cantidadArchivos, onArchivos()
//   perfil   el botón de perfil (MenuPerfil), que va arriba del todo
function BarraProyecto({ etapas, onEtapa, archivosAbierto, cantidadArchivos, onArchivos, perfil }) {
    return (
        <nav className="barra-proyecto" aria-label="Partes del proyecto">
            {perfil}
            {perfil && <hr />}
            <BotonIcono
                icono={FolderOpen}
                texto={archivosAbierto ? 'Cerrar archivos' : 'Archivos'}
                lado="izquierda"
                aria-pressed={archivosAbierto}
                insignia={cantidadArchivos || undefined}
                onClick={onArchivos}
            />
            <hr />
            {etapas.map((etapa) => (
                <BotonIcono
                    key={etapa.id}
                    icono={etapa.icono}
                    texto={etapa.disponible ? etapa.nombre : `${etapa.nombre} (primero agrega frames)`}
                    lado="izquierda"
                    activo={etapa.actual}
                    disabled={!etapa.disponible}
                    onClick={() => onEtapa(etapa.id)}
                />
            ))}
        </nav>
    );
}

export default BarraProyecto;