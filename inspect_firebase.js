const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

async function main() {
  console.log('\n============================================================');
  console.log('  INSPECCION DE FIRESTORE - navigation-paths y Edificios');
  console.log('============================================================\n');

  // 1. navigation-paths
  console.log('>>> COLECCION: navigation-paths <<<');
  const navSnap = await getDocs(collection(db, 'navigation-paths'));
  if (navSnap.empty) {
    console.log('  [VACIA - no hay documentos]\n');
  } else {
    navSnap.docs.forEach(doc => {
      console.log(`\n  -- Documento ID: ${doc.id} --`);
      console.log(JSON.stringify(doc.data(), null, 4));
    });
  }

  // 2. rutas
  console.log('\n>>> COLECCION: rutas <<<');
  const rutasSnap = await getDocs(collection(db, 'rutas'));
  if (rutasSnap.empty) {
    console.log('  [VACIA - no hay documentos]\n');
  } else {
    rutasSnap.docs.forEach(doc => {
      console.log(`\n  -- Documento ID: ${doc.id} --`);
      console.log(JSON.stringify(doc.data(), null, 4));
    });
  }

  // 3. Edificios + Locaciones
  console.log('\n>>> COLECCION: Edificios <<<');
  const edSnap = await getDocs(collection(db, 'Edificios'));
  const edificios = edSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log('  Edificios encontrados:', edificios.map(e => e.id).join(', '));

  for (const edificio of edificios) {
    const pisoColecciones = ['Locaciones', 'Locaciones piso -1', 'Locaciones piso 2', 'Locaciones piso 3'];
    for (const colName of pisoColecciones) {
      const colRef = collection(db, `Edificios/${edificio.id}/${colName}`);
      try {
        const locSnap = await getDocs(colRef);
        if (!locSnap.empty) {
          console.log(`\n  [Edificio: ${edificio.id}] [${colName}] -> ${locSnap.size} documentos`);
          locSnap.docs.forEach(d => {
            console.log(`    id: ${d.id} ->`, JSON.stringify(d.data(), null, 6));
          });
        }
      } catch (e) {
        // coleccion no existe, ignorar
      }
    }
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
