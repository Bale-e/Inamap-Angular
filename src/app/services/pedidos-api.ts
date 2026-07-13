const BASE_URL = 'http://localhost:3000'

// ── EDIFICIOS ──────────────────────────────────────────────
export async function getEdificios() {
    const res = await fetch(`${BASE_URL}/edificios`)
    if (!res.ok) throw new Error('Error al obtener edificios desde la API')
    return res.json()
}

export async function getEdificio(id: string) {
    const res = await fetch(`${BASE_URL}/edificios/${id}`)
    if (!res.ok) throw new Error('Error al buscar edificio desde la API')
    return res.json()
}

export async function getEdificioPorNombre(nombre: string) {
    const res = await fetch(`${BASE_URL}/edificios/nombre/${encodeURIComponent(nombre)}`)
    if (!res.ok) throw new Error('Error al buscar edificio por nombre desde la API')
    return res.json()
}

// ── LOCACIONES ─────────────────────────────────────────────
export async function getLocaciones(edificioId: string) {
    const res = await fetch(`${BASE_URL}/edificios/${edificioId}/locaciones`)
    if (!res.ok) throw new Error('Error al obtener locaciones desde la API')
    return res.json()
}

export async function getLocacionesPorPiso(edificioId: string, piso: string) {
    const res = await fetch(`${BASE_URL}/edificios/${edificioId}/locaciones/piso/${encodeURIComponent(piso)}`)
    if (!res.ok) throw new Error('Error al obtener locaciones por piso desde la API')
    return res.json()
}

export async function getLocacionesPorTipo(edificioId: string, tipo: string) {
    const res = await fetch(`${BASE_URL}/edificios/${edificioId}/locaciones/tipo/${encodeURIComponent(tipo)}`)
    if (!res.ok) throw new Error('Error al obtener locaciones por tipo desde la API')
    return res.json()
}

export async function getLocacionPorNombre(edificioId: string, nombre: string) {
    const res = await fetch(`${BASE_URL}/edificios/${edificioId}/locaciones/nombre/${encodeURIComponent(nombre)}`)
    if (!res.ok) throw new Error('Error al buscar locación desde la API')
    return res.json()
}

// Busca una locación por nombre SIN saber a qué edificio pertenece.
export async function getLocacionPorNombreGlobal(nombre: string) {
    const res = await fetch(`${BASE_URL}/locaciones/${encodeURIComponent(nombre)}`)
    if (!res.ok) throw new Error('Error al buscar locación por nombre desde la API')
    return res.json()
}

// ── NAVIGATION PATHS ───────────────────────────────────────
export async function getNavigationPaths() {
    const res = await fetch(`${BASE_URL}/navigation-paths`)
    if (!res.ok) throw new Error('Error al obtener navigation-paths desde la API')
    return res.json()
}

export async function getNavigationPathPorPiso(piso: string) {
    const res = await fetch(`${BASE_URL}/navigation-paths/piso/${encodeURIComponent(piso)}`)
    if (!res.ok) throw new Error('Error al obtener navigation-path desde la API')
    return res.json()
}

// ── RUTAS ──────────────────────────────────────────────────
// NOTA: colección "rutas" reemplazada por "navigation-paths" (Accesos/Giros/Conexiones).
// Se deja esta función por si se necesita más adelante, pero actualmente no se usa en la app.
export async function getRutas() {
    const res = await fetch(`${BASE_URL}/rutas`)
    if (!res.ok) throw new Error('Error al obtener rutas desde la API')
    return res.json()
}