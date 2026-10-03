require('dotenv').config();
   const express = require('express');
   const cors = require('cors');
   const authRoutes = require('./routes/authRoutes');
   const proyectoRoutes = require('./routes/proyectoRoutes');

   const app = express();
   app.use(cors());
   app.use(express.json());
   app.use('/api/proyectos', proyectoRoutes);
   app.get('/', (req, res) => {
     res.send('API REST funcionando');
   });

   app.use('/api/auth', authRoutes);

   const PORT = process.env.PORT || 4000;
   app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`))