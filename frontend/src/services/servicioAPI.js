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
    localStorage.removeIten(TOKEN_KEY);
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

const RUTAS_AUTH = ['/auth/iniciar-sesion', '/auth/registrar'];


api.interceptors.response.use(
    (respuesta) => respuesta,
    (error) => {
        const esRutaAuth = RUTAS_AUTH.includes(error.config?.url);
        if (error.response?.status === 401 && !esRutaAuth && Autenticacion) {
            borrarToken();
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
        return 'No se pudo conectar con el servidor. Revisa tu conexión.';
    }
    return error.message || 'Ocurrió un error inesperado.'
}

// AUTENTICACION

export async function registrar(nombre, email, contrasena) {
    const respuesta = await api.post('/auth/registrar', {nombre, email, contrasena });
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

export async function crearProyecto(nombre, desc) {
    const respuesta = await api.post('/proyectos', {nombre, descripcion: desc});
    return respuesta.data;
}

export async function eliminarProyecto(id) {
    await api.delete(`/proyectos/${id}`);
    return true;
}


//GIFS
export async function subirGIF(proyecto_id, archivo) {
    const formData = new FormData();
    formData.append('archivo', archivo);
    const respuesta = await api.post(`/proyectos/${proyecto_id}/gif`, formData);
    return respuesta.data.frames;
}

export async function obtenerFrames(proyecto_id) {
    const respuesta = await api.get(`/proyectos/${proyecto_id}/frames`)
    return respuesta.data.frames;
}

export async function exportar(proyecto_id, formato) {
    if (formato !== 'gif' && formato !== 'mp4') {
        throw new Error('Formato de exportación no válido');
    }
    try {
        const respuesta = await api.get(`/proyectos/${proyecto_id}/exportar/${formato}`, {
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

export default api;