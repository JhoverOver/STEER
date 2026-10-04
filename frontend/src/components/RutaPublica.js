import {Navigate} from 'react-router-dom';
import {Autenticacion} from '../services/servicioAPI';


function RutaPublica({ children }) {
    if (Autenticacion()) {
        return <Navigate to="/proyectos" replace />;
    }
    return children;
}

export default RutaPublica;