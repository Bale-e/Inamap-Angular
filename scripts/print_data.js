const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require('../ServiceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function printData() {
  console.log('--- GETTING BUILDINGS ---');
  const bSnap = await db.collection('Edificios').get();
  for (const doc of bSnap.docs) {
    console.log(`Building: ${doc.id} =>`, doc.data());
    
    console.log(`  --- Locaciones for ${doc.id} ---`);
    const locSnap = await db.collection('Edificios').doc(doc.id).collection('Locaciones').get();
    locSnap.docs.forEach(lDoc => {
      console.log(`    Location: ${lDoc.id} =>`, lDoc.data());
    });
  }

  console.log('--- GETTING NAVIGATION PATHS ---');
  const navSnap = await db.collection('navigation_paths').get();
  navSnap.docs.forEach(doc => {
    console.log(`NavPath: ${doc.id} =>`, JSON.stringify(doc.data(), null, 2));
  });
  
  process.exit(0);
}

printData().catch(err => {
  console.error(err);
  process.exit(1);
});
