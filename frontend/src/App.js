import {BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PaginaLogin from './pages/PaginaLogin';
import PaginaRegistro from './pages/PaginaRegistro';
import PanelProyectos from './pages/PanelProyectos';
import VisualizacionFrames from './pages/VisualizacionFrames';
import RutaProtegida from './components/RutaProtegida';
import RutaPublica from './components/RutaPublica';


function App() {
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<RutaPublica><PaginaLogin /></RutaPublica>} />
      <Route path="/registro" element={<RutaPublica><PaginaRegistro /></RutaPublica>} />

      <Route path="/proyectos" element={<RutaProtegida><PanelProyectos /></RutaProtegida>}/>
      <Route path="/proyectos/:id" element={<RutaProtegida><VisualizacionFrames /></RutaProtegida>}/>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </BrowserRouter>
  )
}

export default App;
