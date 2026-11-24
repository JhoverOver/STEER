import axios from 'axios'

const TOKEN_KEY = 'token';

const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000/api',
    timeout: 30000, // 30 segundos
});

export function guardarToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

export function borrarToken() {
    localStorage.removeItem(TOKEN_KEY);
}

export function Autenticacion() {
    return Boolean(localStorage.getItem(TOKEN_KEY));
}


function agregarPeticionToken(request) {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
        request.headers.Authorization = `Bearer ${token}`;
    }
    return request;
}
api.interceptors.request.use(agregarPeticionToken)

const RUTAS_AUTH = ['/auth/iniciar-sesion', '/auth/registrar', '/auth/verificar', '/auth/reenviar-codigo'];


// Sesión vencida o token inválido (401) en cualquier petición que no sea de inicio de sesión o registro:
// se borra el token y se vuelve al inicio de sesión. Así ninguna página tiene que revisar el 401 por su cuenta.
api.interceptors.response.use(
    (respuesta) => respuesta,
    (error) => {
        const esRutaAuth = RUTAS_AUTH.includes(error.config?.url);
        if (error.response?.status === 401 && !esRutaAuth && Autenticacion()) {
            borrarToken();
            window.location.assign('/login');
        }
        return Promise.reject(error);
    }
);

// ERRORES
export function obtenerMensajeError(error) {
    if (error.response) {
        return error.response.data?.error || `El servidor respondió con un error (${error.response.status}).`;  
    }
    if (error.request) {
        return 'No se pudo conectar con el servidor';
    }
    return error.message || 'Ocurrió un error.'
}

// AUTENTICACION

// Crea la cuenta sin verificar; el servidor envía un código de 6 dígitos al correo
export async function registrar(email, contrasena) {
    const respuesta = await api.post('/auth/registrar', { email, contrasena });
    return respuesta.data;
}

// Activa la cuenta con el código del correo. Devuelve { token, usuario }: la sesión queda lista para iniciar
export async function verificarCorreo(email, codigo) {
    const respuesta = await api.post('/auth/verificar', { email, codigo });
    return respuesta.data;
}

export async function reenviarCodigo(email) {
    const respuesta = await api.post('/auth/reenviar-codigo', { email });
    return respuesta.data;
}

export async function iniciarSesion(email, contrasena) {
    const respuesta = await api.post('/auth/iniciar-sesion', { email, contrasena });
    return respuesta.data;
}

//PROYECTOS

export async function obtenerProyectos() {
    const respuesta = await api.get('/proyectos');
    return respuesta.data;
}

export async function obtenerProyecto(id) {
    const respuesta = await api.get(`/proyectos/${id}`);
    return respuesta.data;
}

export async function crearProyecto(nombre, desc, etiquetas = [], color = null, desdeCero = false) {
    const respuesta = await api.post('/proyectos', {nombre, descripcion: desc, etiquetas, color, desde_cero: desdeCero});
    return respuesta.data;
}

// datos puede incluir nombre, descripcion, etiquetas y color; solo se cambia lo que se envía.
export async function actualizarProyecto(id, datos) {
    const respuesta = await api.put(`/proyectos/${id}`, datos);
    return respuesta.data;
}

export async function eliminarProyecto(id) {
    await api.delete(`/proyectos/${id}`);
    return true;
}


// IMPORTAR

// Importa un GIF, PNG, JPG o WEBP como frames (RF3). modo: 'agregar' (al final, ajustado al lienzo) o 'reemplazar'.
// Devuelve { frames, pistas, ancho, alto, agregados, modo }
export async function importarArchivo(proyecto_id, archivo, modo = 'agregar') {
    const formData = new FormData();
    formData.append('modo', modo); // va antes del archivo: así el servidor lo conoce al recibirlo
    formData.append('archivo', archivo);
    const respuesta = await api.post(`/proyectos/${proyecto_id}/importar`, formData, { timeout: 120000 });
    const { frames, ancho, alto, pistas = [], agregados, modo: modoUsado } = respuesta.data;
    return { frames, ancho, alto, pistas, agregados, modo: modoUsado };
}

// Frames y pistas de keyframes del proyecto: { frames, pistas }
export async function obtenerFrames(proyecto_id) {
    const respuesta = await api.get(`/proyectos/${proyecto_id}/frames`);
    return { frames: respuesta.data.frames, pistas: respuesta.data.pistas || [] };
}

// Guarda la lista de frames y la de pistas. "archivos" son los PNG de las capas modificadas y de las pistas nuevas.
// Devuelve { frames, pistas } tal como quedaron guardados
export async function guardarFrames(proyecto_id, lista, archivos = [], pistas = []) {
    if (archivos.length === 0) {
        const respuesta = await api.put(`/proyectos/${proyecto_id}/frames`, { frames: lista, pistas });
        return { frames: respuesta.data.frames, pistas: respuesta.data.pistas || [] };
    }
    const formData = new FormData();
    formData.append('lista', JSON.stringify(lista));
    formData.append('pistas', JSON.stringify(pistas));
    archivos.forEach(({ campo, blob }) => formData.append(campo, blob, `${campo}.png`));
    // Subir muchas capas puede tardar más que las demás peticiones
    const respuesta = await api.put(`/proyectos/${proyecto_id}/frames`, formData, { timeout: 120000 });
    return { frames: respuesta.data.frames, pistas: respuesta.data.pistas || [] };
}

// CAPAS

// Capas de un fotograma
export async function obtenerCapas(proyecto_id, frame_id) {
    const respuesta = await api.get(`/proyectos/${proyecto_id}/frames/${frame_id}/capas`);
    return respuesta.data.capas;
}

const RUTAS_EXPORTACION = { gif: 'gif', mp4: 'mp4'};

export async function exportar(proyecto_id, formato) {
    const ruta = RUTAS_EXPORTACION[formato];
    if (!ruta) {
        throw new Error('Formato de exportación inválido: usa "gif" o "mp4".');
    }
    try {
        const respuesta = await api.get(`/proyectos/${proyecto_id}/exportar/${ruta}`, {
            responseType: 'arraybuffer',
        });
        return new Blob([respuesta.data], {type: respuesta.headers['content-type']});
    } catch (error) {
        if (error.response?.data instanceof ArrayBuffer || ArrayBuffer.isView(error.response?.data)) {
            try {
                error.response.data = JSON.parse(new TextDecoder().decode(error.response.data));
            } catch {
                //permanece igual si no es un JSON
            }
        }
        throw error;
    }
}

// PREFERENCIAS

// Atajos que el usuario cambió: { accion: combinacion }.
export async function obtenerAtajos() {
    const respuesta = await api.get('/preferencias/atajos');
    return respuesta.data.atajos;
}

export async function guardarAtajos(atajos) {
    const respuesta = await api.put('/preferencias/atajos', { atajos });
    return respuesta.data.atajos;
}

export default api;