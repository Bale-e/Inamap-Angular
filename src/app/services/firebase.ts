/**
 * Servicio de acceso a Firebase/Firestore.
 * Descripción: encapsula las consultas a colecciones como `Edificios`, `Locaciones` y `navigation_paths`.
 */
import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

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
console.log('Firebase inicializado:', app.name);
const db  = getFirestore(app);

const knownCollections = ['Edificios', 'navigation-paths', 'rutas'];
let hasLoggedCollections = false;
const loggedCollectionIds = new Set<string>();
const collectionResultsCache = new Map<string, any[]>();

function logCollectionOnce(collectionId: string, results: any[]) {
  if (loggedCollectionIds.has(collectionId)) {
    return;
  }

  loggedCollectionIds.add(collectionId);
  console.log('Colección disponible:', collectionId, `(${results.length} documentos)`);

  if (results.length > 0) {
    console.log('Documentos:', results);
  }
}

async function logAvailableCollections() {
  if (hasLoggedCollections) {
    return;
  }

  hasLoggedCollections = true;

  try {
    for (const collectionId of knownCollections) {
      const snapshot = await getDocs(collection(db, collectionId));
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      collectionResultsCache.set(collectionId, results);
      logCollectionOnce(collectionId, results);
    }
  } catch (error) {
    console.error('No se pudieron obtener las colecciones de Firestore:', error);
  }
}

void logAvailableCollections();

@Injectable({
  providedIn: 'root'
})
export class Firebase {
  constructor() {
    void logAvailableCollections();
  }

  private async fetchCollectionResults(collectionPath: string) {
    const cachedResults = collectionResultsCache.get(collectionPath);
    if (cachedResults) {
      return cachedResults;
    }

    const snapshot = await getDocs(collection(db, collectionPath));
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    collectionResultsCache.set(collectionPath, results);
    logCollectionOnce(collectionPath, results);
    return results;
  }

  async getEdificios() {
    return this.fetchCollectionResults('Edificios');
  }

  async getLocaciones(edificioId: string) {
    return this.fetchCollectionResults(`Edificios/${edificioId}/Locaciones`);
  }

  async getLocacionesPorPiso(edificioId: string, piso: string) {
    const q = query(
      collection(db, `Edificios/${edificioId}/Locaciones`),
      where('Piso', '==', piso)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getLocacionPorNombre(edificioId: string, piso: string, nombre: string) {
    const locaciones = await this.getLocacionesPorPiso(edificioId, piso);
    const normalized = nombre.trim().toLowerCase();
    return locaciones.find((loc: any) => {
      const nameValue = (loc.Nombre || loc.nombre || loc.name || '').toString().trim().toLowerCase();
      return nameValue === normalized;
    });
  }

  async getNavigationPaths() {
    return this.fetchCollectionResults('navigation-paths');
  }

async getNavigationPath(piso: string) {
  const q = query(collection(db, 'navigation-paths'), where('Piso', '==', piso));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}
  
  async getRutas() {
    return this.fetchCollectionResults('rutas');
  }
}