import axios from 'axios'

const TOKEN_KEY = 'token';
const CORREO_KEY = 'correo'; // correo de la sesión, para mostrarlo en el menú de perfil

const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000/api',
    timeout: 30000, // 30 segundos
});

export function guardarToken(token, usuario) {
    localStorage.setItem(TOKEN_KEY, token);
    if (usuario?.email) localStorage.setItem(CORREO_KEY, usuario.email);
}

export function borrarToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CORREO_KEY);
}

export function correoDeSesion() {
    return localStorage.getItem(CORREO_KEY) || '';
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

// Crea un proyecto vacío: el lienzo se fija después, en la pestaña Frames
export async function crearProyecto({ nombre, etiquetas = [], color = null }) {
    const respuesta = await api.post('/proyectos', { nombre, etiquetas, color });
    return respuesta.data;
}

// datos puede incluir nombre, etiquetas y color; solo se cambia lo que se envía.
export async function actualizarProyecto(id, datos) {
    const respuesta = await api.put(`/proyectos/${id}`, datos);
    return respuesta.data;
}

export async function eliminarProyecto(id) {
    await api.delete(`/proyectos/${id}`);
    return true;
}


// FRAMES

// Importa un GIF, PNG, JPG o WEBP como frames (RF3). modo: 'agregar' (al final, ajustado al lienzo) o 'reemplazar'.
// Devuelve { frames, ancho, alto, agregados, modo }
export async function importarArchivo(proyecto_id, archivo, modo = 'agregar') {
    const formData = new FormData();
    formData.append('modo', modo); // va antes del archivo: así el servidor lo conoce al recibirlo
    formData.append('archivo', archivo);
    const respuesta = await api.post(`/proyectos/${proyecto_id}/importar`, formData, { timeout: 120000 });
    return respuesta.data;
}

// En un proyecto sin frames: fija el tamaño del lienzo y crea un frame en blanco.
// Devuelve { frames, ancho, alto }
export async function crearFrameVacio(proyecto_id, ancho, alto) {
    const respuesta = await api.post(`/proyectos/${proyecto_id}/frames/vacio`, { ancho, alto });
    return respuesta.data;
}

// Cambia el tamaño del lienzo sin escalar el dibujo. anclaX y anclaY: 0, 0.5 o 1 (dónde queda el dibujo actual).
// Devuelve { frames, ancho, alto }
export async function cambiarLienzo(proyecto_id, { ancho, alto, anclaX, anclaY }) {
    // Se rehacen las capas de todos los frames: puede tardar más que las demás peticiones
    const respuesta = await api.put(`/proyectos/${proyecto_id}/lienzo`, { ancho, alto, anclaX, anclaY }, { timeout: 180000 });
    return respuesta.data;
}

// Frames del proyecto: { frames }
export async function obtenerFrames(proyecto_id) {
    const respuesta = await api.get(`/proyectos/${proyecto_id}/frames`);
    return respuesta.data;
}

// Guarda la lista de frames. "archivos" son los PNG de las capas modificadas (y de su dibujo sin animar).
// Devuelve { frames } tal como quedaron guardados
export async function guardarFrames(proyecto_id, lista, archivos = []) {
    if (archivos.length === 0) {
        const respuesta = await api.put(`/proyectos/${proyecto_id}/frames`, { frames: lista });
        return respuesta.data;
    }
    const formData = new FormData();
    formData.append('lista', JSON.stringify(lista));
    archivos.forEach(({ campo, blob }) => formData.append(campo, blob, `${campo}.png`));
    // Subir muchas capas puede tardar más que las demás peticiones
    const respuesta = await api.put(`/proyectos/${proyecto_id}/frames`, formData, { timeout: 120000 });
    return respuesta.data;
}

// CAPAS

// Capas de un fotograma
export async function obtenerCapas(proyecto_id, frame_id) {
    const respuesta = await api.get(`/proyectos/${proyecto_id}/frames/${frame_id}/capas`);
    return respuesta.data.capas;
}

// EXPORTAR

// El GIF o el MP4 del proyecto, como Blob
export async function exportar(proyecto_id, formato) {
    if (formato !== 'gif' && formato !== 'mp4') {
        throw new Error('Formato de exportación inválido: usa "gif" o "mp4".');
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

