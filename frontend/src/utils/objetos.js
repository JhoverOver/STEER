// Objetos de una capa: un "objeto" es un grupo de píxeles no transparentes que se tocan (también en diagonal).
// Son funciones puras: reciben los datos RGBA de la capa (ImageData.data) y devuelven un "grupo":
//   { rect: { x, y, ancho, alto }, mascara: Uint8Array(rect.ancho * rect.alto) }
// "rect" es la caja que envuelve a los objetos y "mascara" vale 1 en los píxeles que pertenecen a ellos
// (dentro de la caja puede haber píxeles de otros objetos que NO están en el grupo).

const VECINOS = [-1, 0, 1];

function esOpaco(datos, indice) {
    return datos[indice * 4 + 3] > 0;
}

// Recorre todo el objeto que contiene al píxel "inicio" y devuelve los índices de sus píxeles.
// "visitado" se comparte entre llamadas para no recorrer dos veces un mismo objeto; "cola" es memoria de trabajo.
function inundar(datos, ancho, alto, inicio, visitado, cola) {
    let primero = 0;
    let ultimo = 0;
    cola[ultimo++] = inicio;
    visitado[inicio] = 1;
    while (primero < ultimo) {
        const actual = cola[primero++];
        const x = actual % ancho;
        const y = (actual - x) / ancho;
        for (const dy of VECINOS) {
            const ny = y + dy;
            if (ny < 0 || ny >= alto) continue;
            for (const dx of VECINOS) {
                const nx = x + dx;
                if (nx < 0 || nx >= ancho || (dx === 0 && dy === 0)) continue;
                const vecino = ny * ancho + nx;
                if (visitado[vecino] || !esOpaco(datos, vecino)) continue;
                visitado[vecino] = 1;
                cola[ultimo++] = vecino;
            }
        }
    }
    return cola.slice(0, ultimo);
}

// Junta listas de índices en un grupo (caja + máscara). null si no hay píxeles.
function armarGrupo(listas, ancho) {
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;
    for (const lista of listas) {
        for (let i = 0; i < lista.length; i++) {
            const x = lista[i] % ancho;
            const y = (lista[i] - x) / ancho;
            if (x < x1) x1 = x;
            if (x > x2) x2 = x;
            if (y < y1) y1 = y;
            if (y > y2) y2 = y;
        }
    }
    if (x1 === Infinity) return null;
    const rect = { x: x1, y: y1, ancho: x2 - x1 + 1, alto: y2 - y1 + 1 };
    const mascara = new Uint8Array(rect.ancho * rect.alto);
    for (const lista of listas) {
        for (let i = 0; i < lista.length; i++) {
            const x = lista[i] % ancho;
            const y = (lista[i] - x) / ancho;
            mascara[(y - rect.y) * rect.ancho + (x - rect.x)] = 1;
        }
    }
    return { rect, mascara };
}

// El objeto que está bajo el punto (x, y). Si ahí no hay nada, busca el píxel más cercano dentro de "radio"
// (así se pueden agarrar líneas finas aunque se haga clic un poco al lado). null si no hay ningún objeto.
export function objetoEnPunto(datos, ancho, alto, x, y, radio = 0) {
    const px = Math.floor(x);
    const py = Math.floor(y);
    let elegido = -1;
    let mejor = Infinity;
    for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
            const nx = px + dx;
            const ny = py + dy;
            if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
            const distancia = dx * dx + dy * dy;
            if (distancia < mejor && esOpaco(datos, ny * ancho + nx)) {
                mejor = distancia;
                elegido = ny * ancho + nx;
            }
        }
    }
    if (elegido === -1) return null;
    const objeto = inundar(datos, ancho, alto, elegido, new Uint8Array(ancho * alto), new Int32Array(ancho * alto));
    return armarGrupo([objeto], ancho);
}

// Todos los objetos que tienen al menos un píxel dentro de "rect" (el marco que dibuja el usuario)
export function objetosEnRect(datos, ancho, alto, rect) {
    const visitado = new Uint8Array(ancho * alto);
    const cola = new Int32Array(ancho * alto);
    const x1 = Math.max(0, Math.floor(rect.x));
    const y1 = Math.max(0, Math.floor(rect.y));
    const x2 = Math.min(ancho, Math.ceil(rect.x + rect.ancho));
    const y2 = Math.min(alto, Math.ceil(rect.y + rect.alto));
    const objetos = [];
    for (let y = y1; y < y2; y++) {
        for (let x = x1; x < x2; x++) {
            const indice = y * ancho + x;
            if (!visitado[indice] && esOpaco(datos, indice)) {
                objetos.push(inundar(datos, ancho, alto, indice, visitado, cola));
            }
        }
    }
    return armarGrupo(objetos, ancho);
}

// Todo lo que hay en la capa (todos los píxeles no transparentes)
export function todosLosObjetos(datos, ancho, alto) {
    const todos = [];
    for (let i = 0; i < ancho * alto; i++) {
        if (esOpaco(datos, i)) todos.push(i);
    }
    return armarGrupo([Int32Array.from(todos)], ancho);
}

// Grupo con los píxeles no transparentes de una región ya recortada: "datos" son los RGBA de un canvas del tamaño
// de "rect" que está en (rect.x, rect.y). Sirve para seguir eligiendo lo que se acaba de escalar o girar.
// La caja se ajusta a los píxeles que quedaron; null si no quedó ninguno.
export function grupoDeRegion(datos, rect) {
    const lista = [];
    for (let i = 0; i < rect.ancho * rect.alto; i++) {
        if (esOpaco(datos, i)) lista.push(i);
    }
    const grupo = armarGrupo([Int32Array.from(lista)], rect.ancho);
    if (!grupo) return null;
    return { rect: { ...grupo.rect, x: grupo.rect.x + rect.x, y: grupo.rect.y + rect.y }, mascara: grupo.mascara };
}