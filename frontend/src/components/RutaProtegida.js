import { Navigate } from 'react-router-dom';
import { Autenticacion } from '../services/servicioAPI';

function RutaProtegida({ children }) {
    if (!Autenticacion()) {
        return <Navigate to="/login" replace />;
    }
    return children;
}

export default RutaProtegida;