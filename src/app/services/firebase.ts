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

@Injectable({
  providedIn: 'root'
})
export class Firebase {

  async getEdificios() {
    const snapshot = await getDocs(collection(db, 'Edificios'));
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('Firebase getEdificios:', { count: results.length, results });
    return results;
  }

  async getLocaciones(edificioId: string) {
    const snapshot = await getDocs(
      collection(db, `Edificios/${edificioId}/Locaciones`)
    );
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Firebase getLocaciones ${edificioId}:`, { count: results.length, results });
    return results;
  }

  async getLocacionesPorPiso(edificioId: string, piso: string) {
    const q = query(
      collection(db, `Edificios/${edificioId}/Locaciones`),
      where('Piso', '==', piso)
    );
    const snapshot = await getDocs(q);
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Firebase getLocacionesPorPiso ${edificioId} / ${piso}:`, { count: results.length, results });
    return results;
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
    const snapshot = await getDocs(collection(db, 'navigation_paths'));
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('getNavigationPaths:', results);
    return results;
  }

  async getRutas() {
    const snapshot = await getDocs(collection(db, 'rutas'));
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('getRutas:', results);
    return results;
  }
}