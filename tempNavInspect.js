const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const firebaseConfig = {
  apiKey: 'AIzaSyDlEgFdhD76kXdF7FJC48Ih7n-Gk9N3TIk',
  authDomain: 'bdinago.firebaseapp.com',
  projectId: 'bdinago',
  storageBucket: 'bdinago.firebasestorage.app',
  messagingSenderId: '588945240085',
  appId: '1:588945240085:web:bc0e22c909b1a753971e1c',
  measurementId: 'G-F0C2Y6SKFE'
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
(async () => {
  const navSnap = await getDocs(collection(db, 'navigation-paths'));
  console.log('navigation-paths count:', navSnap.size);
  navSnap.docs.forEach(doc => {
    console.log('doc', doc.id, JSON.stringify(doc.data(), null, 2));
  });
})().catch(err => { console.error(err); process.exit(1); });
