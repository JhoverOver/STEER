import { Navigate, Outlet } from 'react-router-dom';
import { Autenticacion } from '../services/servicioAPI';

// Ruta "de diseño": envuelve a otras rutas y solo las muestra si la sesión está como se pide.
//   requiereSesion  true: solo con sesión iniciada (si no, al inicio de sesión)
//                   false: solo sin sesión (si ya hay una, a los proyectos)
function RutaSesion({ requiereSesion }) {
    if (Autenticacion() !== requiereSesion) {
        return <Navigate to={requiereSesion ? '/login' : '/proyectos'} replace />;
    }
    return <Outlet />;
}

export default RutaSesion;