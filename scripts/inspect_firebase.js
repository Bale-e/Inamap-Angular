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
  const edSnap = await getDocs(collection(db, 'Edificios'));
  for (const edDoc of edSnap.docs) {
    const edData = edDoc.data();
    const edNombre = edData.Nombre || edData.nombre || edDoc.id;
    const subCols = ['Locaciones', 'Locaciones piso -1', 'Locaciones piso 1', 'Locaciones piso 2', 'Locaciones piso 3'];
    for (const sub of subCols) {
      try {
        const snap = await getDocs(collection(db, `Edificios/${edDoc.id}/${sub}`));
        if (!snap.empty) {
          snap.docs.forEach(doc => {
            const d = doc.data();
            const nombre = d.Nombre || d.nombre;
            if (nombre && /A20[35]|A205|A203|Cuerpo/i.test(nombre)) {
              console.log(`[Edificio: ${edNombre}] [${sub}] ${doc.id} ->`, JSON.stringify(d));
            }
          });
        }
      } catch (e) {}
    }
  }
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
