require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const proyectoRoutes = require('./routes/proyectoRoutes');
const preferenciasRoutes = require('./routes/preferenciasRoutes');
const { manejarErrores } = require('./middleware/errores');

const app = express();
// En producción, FRONTEND_URL limita qué sitio puede llamar a la API (si no existe, se permite cualquiera)
app.use(cors(process.env.FRONTEND_URL ? { origin: process.env.FRONTEND_URL } : undefined));
app.use(express.json());

app.get('/', (req, res) => res.send('API REST funcionando'));
app.use('/api/auth', authRoutes);
app.use('/api/proyectos', proyectoRoutes);
app.use('/api/preferencias', preferenciasRoutes);

// Siempre al final: responde los errores de todas las rutas
app.use(manejarErrores);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));