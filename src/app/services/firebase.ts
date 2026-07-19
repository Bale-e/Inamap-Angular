/**
 * Servicio de acceso a Firebase/Firestore.
 * Descripción: encapsula las consultas a colecciones como `Edificios`, `Locaciones` y `navigation-paths`.
 * Las comparaciones de nombres de campo (Piso/piso, Nombre/nombre, etc.) se hacen sin distinguir
 * mayúsculas/minúsculas mediante expresiones regulares, ya que los datos fueron cargados manualmente
 * en Firebase y no siempre respetan la misma capitalización.
 */
import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyDlEgFdhD76kXdF7FJC48Ih7n-Gk9N3TIk",
  authDomain:        "bdinago.firebaseapp.com",
  projectId:         "bdinago",
  storageBucket:     "bdinago.firebasestorage.app",
  messagingSenderId: "588945240085",
  appId:             "1:588945240085:web:bc0e22c909b1a753971e1c",
  measurementId:     "G-F0C2Y6SKFE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const knownCollections = ['Edificios', 'navigation-paths', 'rutas'];
const collectionResultsCache = new Map<string, any[]>();

async function prefetchCollections(): Promise<void> {
  try {
    for (const collectionId of knownCollections) {
      const snapshot = await getDocs(collection(db, collectionId));
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      collectionResultsCache.set(collectionId, results);
    }
  } catch (error) {
    // no logging to avoid console noise in production
  }
}

void prefetchCollections();

// ── Búsqueda de campos sin distinguir mayúsculas/minúsculas ──────────────
// Algunos documentos en Firebase quedaron con el campo como "Piso" y otros
// como "piso". Esta función busca el campo sin importar cómo esté escrito.
function getFieldCI(obj: any, fieldName: string): any {
  if (!obj) return undefined;
  const regex = new RegExp(`^${fieldName}$`, 'i');
  const key = Object.keys(obj).find(k => regex.test(k?.toString().trim()));
  return key !== undefined ? obj[key] : undefined;
}

@Injectable({
  providedIn: 'root'
})
export class Firebase {
  // Nombres reales de las 4 colecciones de locaciones dentro de cada edificio.
  // Se creó una colección separada por piso en vez de un único campo "Piso"
  // dentro de "Locaciones", así que hay que consultarlas todas y juntarlas.
  private readonly coleccionesLocaciones = [
    'Locaciones',
    'Locaciones piso -1',
    'Locaciones piso 2',
    'Locaciones piso 3'
  ];

  constructor() {
    // No logging de colecciones para evitar ruido en consola.
  }

  private async fetchCollectionResults(collectionPath: string) {
    const cachedResults = collectionResultsCache.get(collectionPath);
    if (cachedResults) {
      return cachedResults;
    }

    const snapshot = await getDocs(collection(db, collectionPath));
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    collectionResultsCache.set(collectionPath, results);
    return results;
  }

  async getEdificios() {
    return this.fetchCollectionResults('Edificios');
  }

  // Junta las locaciones de las 4 colecciones (Locaciones, piso -1, piso 2, piso 3)
  // en una sola lista.
  async getLocaciones(edificioId: string) {
    const allResults: any[] = [];

    for (const nombreColeccion of this.coleccionesLocaciones) {
      const results = await this.fetchCollectionResults(`Edificios/${edificioId}/${nombreColeccion}`);
      allResults.push(...results);
    }

    return allResults;
  }

  // Junta las locaciones de TODOS los edificios registrados en Firebase,
// no solo de Edificio A. Cada locación queda marcada con el edificio
// al que pertenece.
async getLocacionesDeTodosLosEdificios() {
  const edificios = await this.getEdificios();
  const allResults: any[] = [];

  for (const edificio of edificios as any[]) {
    const nombreEdificio = getFieldCI(edificio, 'nombre') ?? 'Edificio sin nombre';
    const locaciones = await this.getLocaciones(edificio.id);

    locaciones.forEach((loc: any) => {
      allResults.push({
        ...loc,
        _edificioId: edificio.id,
        _edificioNombre: nombreEdificio
      });
    });
  }

  return allResults;
}

  async getLocacionesPorPiso(edificioId: string, piso: string) {
    const todas = await this.getLocaciones(edificioId);
    const pisoNormalizado = piso.trim().toLowerCase();

    const results = todas.filter((loc: any) => {
      const pisoValor = getFieldCI(loc, 'piso');
      return (pisoValor ?? '').toString().trim().toLowerCase() === pisoNormalizado;
    });

    return results;
  }

  async getLocacionPorNombre(edificioId: string, piso: string, nombre: string) {
    const locaciones = await this.getLocacionesPorPiso(edificioId, piso);
    const normalized = nombre.trim().toLowerCase();

    return locaciones.find((loc: any) => {
      const nameValue = (getFieldCI(loc, 'nombre') ?? getFieldCI(loc, 'name') ?? '').toString().trim().toLowerCase();
      return nameValue === normalized;
    });
  }

  async getNavigationPaths() {
    return this.fetchCollectionResults('navigation-paths');
  }

  private normalizeFloorKey(piso: string): string {
    const normalized = piso.toString().trim().toLowerCase().replace(/\s+/g, '');
    if (/^\d+$/.test(normalized)) {
      return `piso${normalized}`;
    }
    return normalized;
  }

  async getNavigationPath(piso: string) {
    const todas = await this.getNavigationPaths();
    const pisoNormalizado = this.normalizeFloorKey(piso);

    return todas.find((doc: any) => {
      const pisoValor = getFieldCI(doc, 'Piso') ?? getFieldCI(doc, 'Piso ');
      const normalizedPiso = this.normalizeFloorKey((pisoValor ?? '').toString());
      return normalizedPiso === pisoNormalizado;
    }) ?? null;
  }

  async getRutas() {
    return this.fetchCollectionResults('rutas');
  }
}