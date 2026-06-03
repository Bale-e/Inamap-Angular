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
const db  = getFirestore(app);

@Injectable({
  providedIn: 'root'
})
export class Firebase {

  async getEdificios() {
    const snapshot = await getDocs(collection(db, 'Edificios'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getLocaciones(edificioId: string) {
    const snapshot = await getDocs(
      collection(db, `Edificios/${edificioId}/Locaciones`)
    );
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getLocacionesPorPiso(edificioId: string, piso: string) {
    const q = query(
      collection(db, `Edificios/${edificioId}/Locaciones`),
      where('Piso', '==', piso)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getNavigationPaths() {
    const snapshot = await getDocs(collection(db, 'navigation_paths'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getRutas() {
    const snapshot = await getDocs(collection(db, 'rutas'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}