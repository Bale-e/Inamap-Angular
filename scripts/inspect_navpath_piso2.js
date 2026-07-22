/**
 * Inspecciona el documento NavPathEdificioA-Piso2 completo para ver
 * la estructura exacta de Accesos y Giros.
 *
 * Ejecutar con: node scripts/inspect_navpath_piso2.js
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey:            'AIzaSyDlEgFdhD76kXdF7FJC48Ih7n-Gk9N3TIk',
  authDomain:        'bdinago.firebaseapp.com',
  projectId:         'bdinago',
  storageBucket:     'bdinago.firebasestorage.app',
  messagingSenderId: '588945240085',
  appId:             '1:588945240085:web:bc0e22c909b1a753971e1c',
  measurementId:     'G-F0C2Y6SKFE'
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

async function main() {
  // Leer el documento NavPathEdificioA-Piso2 directamente
  const docRef = doc(db, 'navigation-paths', 'NavPathEdificioA-Piso2');
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    console.log('❌ Documento NavPathEdificioA-Piso2 no existe');
    process.exit(1);
  }

  const d = snap.data();
  console.log('\n════════════════════════════════════════════════');
  console.log(' NavPathEdificioA-Piso2 — Documento completo');
  console.log('════════════════════════════════════════════════');
  console.log(JSON.stringify(d, null, 2));

  // Analizar Accesos
  const accesos = d['Accesos'] ?? d['accesos'];
  console.log('\n── Análisis de Accesos ──');
  if (!accesos) {
    console.log('❌ Campo "Accesos" no encontrado');
  } else {
    const items = Array.isArray(accesos) ? accesos : Object.values(accesos);
    console.log(`Tipo: ${Array.isArray(accesos) ? 'Array' : 'Object (mapa)'}`);
    console.log(`Cantidad: ${items.length}`);
    items.forEach((item, i) => {
      console.log(`  [${i}] Keys: [${Object.keys(item).join(', ')}]`);
      console.log(`       Valor: ${JSON.stringify(item)}`);
      // Verificar mayúsculas/minúsculas de x, y, z
      const hasLowerX = 'x' in item;
      const hasUpperX = 'X' in item;
      console.log(`       x minúscula: ${hasLowerX}, X mayúscula: ${hasUpperX}`);
    });
  }

  // Analizar Giros
  const giros = d['Giros'] ?? d['turns'] ?? d['Turns'];
  console.log('\n── Análisis de Giros ──');
  if (!giros) {
    console.log('❌ Campo "Giros" no encontrado');
  } else {
    const items = Array.isArray(giros) ? giros : Object.values(giros);
    console.log(`Tipo: ${Array.isArray(giros) ? 'Array' : 'Object (mapa)'}`);
    console.log(`Cantidad: ${items.length}`);
    items.forEach((item, i) => {
      console.log(`  [${i}] Keys: [${Object.keys(item).join(', ')}]`);
      console.log(`       Valor: ${JSON.stringify(item)}`);
    });
  }

  console.log('\n════════════════════════════════════════════════\n');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
