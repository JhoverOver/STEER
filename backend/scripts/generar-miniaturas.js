// Uso (una sola vez, tras aplicar la migración):  node scripts/generar-miniaturas.js
// Crea la miniatura de los proyectos que ya tenían frames antes de existir esa función.
require('dotenv').config();
const pool = require('../config/db');
const crudProyecto = require('../models/crudProyecto');
const procesadorFrames = require('../services/procesadorFrames');

async function main() {
    const ids = await crudProyecto.proyectosSinMiniatura();
    console.log(`Proyectos sin miniatura: ${ids.length}`);
    let hechos = 0;
    for (const id of ids) {
        try {
            const primero = await crudProyecto.obtenerPrimerFrame(id);
            if (!primero) continue;
            const miniatura = await procesadorFrames.generarMiniatura(primero.imagen_data);
            await crudProyecto.guardarMiniatura(id, miniatura);
            hechos++;
        } catch (error) {
            console.error(`Proyecto ${id}: ${error.message}`);
        }
    }
    console.log(`Miniaturas generadas: ${hechos}`);
    await pool.end();
}

main().catch((error) => { console.error(error); process.exit(1); });
