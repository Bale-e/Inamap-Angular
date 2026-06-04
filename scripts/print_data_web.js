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

const buildingId = 'm0riTcScQk6A4SlXTy1E'; // Edificio A

async function printAllLocations() {
  console.log('--- ALL LOCATIONS FOR EDIFICIO A ---');
  const locSnap = await getDocs(collection(db, `Edificios/${buildingId}/Locaciones`));
  const locs = locSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Sort by floor then name
  locs.sort((a, b) => {
    const fA = String(a.Piso || a['Piso '] || '');
    const fB = String(b.Piso || b['Piso '] || '');
    if (fA !== fB) return fA.localeCompare(fB);
    const nA = String(a.Nombre || a.nombre || '');
    const nB = String(b.Nombre || b.nombre || '');
    return nA.localeCompare(nB);
  });

  locs.forEach(loc => {
    const floor = loc.Piso || loc['Piso '] || 'N/A';
    const coords = loc.Coordenadas || loc['Coordenadas 3D'] || loc.coordenadas;
    console.log(`Floor: ${floor} | Name: ${loc.Nombre || loc.nombre || loc.Nombre } | Coordinates:`, coords);
  });
  
  process.exit(0);
}

printAllLocations().catch(err => {
  console.error(err);
  process.exit(1);
});
