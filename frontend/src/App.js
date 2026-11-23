import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PaginaLogin from './pages/PaginaLogin';
import PaginaRegistro from './pages/PaginaRegistro';
import PanelProyectos from './pages/PanelProyectos';
import PaginaProyecto from './pages/PaginaProyecto';
import PaginaPreferencias from './pages/PaginaPreferencias';
import RutaSesion from './components/RutaSesion';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route element={<RutaSesion requiereSesion={false} />}>
          <Route path="/login" element={<PaginaLogin />} />
          <Route path="/registro" element={<PaginaRegistro />} />
        </Route>

        <Route element={<RutaSesion requiereSesion />}>
          <Route path="/proyectos" element={<PanelProyectos />} />
          <Route path="/proyectos/:id/:etapa?" element={<PaginaProyecto />} />
          <Route path="/preferencias" element={<PaginaPreferencias />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;