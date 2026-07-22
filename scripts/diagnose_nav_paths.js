/**
 * Script de diagnóstico para verificar:
 * 1. Que la locación "Sala A206" existe en Firebase y tiene coordenadas correctas
 * 2. Que hay un navigation-path para "Piso 2" del "Edificio A"
 * 3. Que los nodos Accesos y Giros tienen datos válidos
 *
 * Ejecutar con: node scripts/diagnose_nav_paths.js
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

// ── Helpers ────────────────────────────────────────────────────────────────────
function getCI(obj, field) {
  if (!obj) return undefined;
  const re = new RegExp(`^${field}$`, 'i');
  const key = Object.keys(obj).find(k => re.test(k.trim()));
  return key !== undefined ? obj[key] : undefined;
}

function normalizeFloorKey(piso) {
  const n = piso.toString().trim().toLowerCase().replace(/\s+/g, '');
  return /^\d+$/.test(n) ? `piso${n}` : n;
}

// ── 1. Inspeccionar navigation-paths ──────────────────────────────────────────
async function inspectNavPaths() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  [1] Colección: navigation-paths');
  console.log('══════════════════════════════════════════════');

  const snap = await getDocs(collection(db, 'navigation-paths'));
  if (snap.empty) {
    console.log('  ⚠️  Colección VACÍA — getNavigationPath() siempre retorna null');
    return;
  }

  snap.docs.forEach(doc => {
    const d = doc.data();
    const piso = getCI(d, 'Piso') ?? getCI(d, 'piso') ?? '(sin campo Piso)';
    const edificio = getCI(d, 'Edificio') ?? getCI(d, 'edificio') ?? '(sin campo Edificio)';
    const pisoKey = normalizeFloorKey(piso.toString());

    console.log(`\n  📄 Doc ID: ${doc.id}`);
    console.log(`     Piso raw:     "${piso}"  →  normalizado: "${pisoKey}"`);
    console.log(`     Edificio raw: "${edificio}"`);

    // Accesos
    const accesos = getCI(d, 'Accesos');
    if (accesos) {
      const items = Array.isArray(accesos) ? accesos : Object.values(accesos);
      console.log(`     Accesos: ${items.length} nodo(s)`);
      items.slice(0, 3).forEach((item, i) => {
        const x = getCI(item, 'x'); const y = getCI(item, 'y'); const z = getCI(item, 'z');
        console.log(`       [${i}] x=${x}, y=${y}, z=${z}`);
      });
      if (items.length > 3) console.log(`       ... y ${items.length - 3} más`);
    } else {
      console.log('     Accesos: (campo no encontrado)');
    }

    // Giros
    const giros = getCI(d, 'Giros') ?? getCI(d, 'turns') ?? getCI(d, 'Turns');
    if (giros) {
      const items = Array.isArray(giros) ? giros : Object.values(giros);
      console.log(`     Giros:   ${items.length} nodo(s)`);
    } else {
      console.log('     Giros:   (campo no encontrado)');
    }

    // Simulación de la búsqueda que hace getNavigationPath('Piso 2', 'A')
    const targetPiso = normalizeFloorKey('Piso 2');
    const targetEd   = 'a';
    const edLow      = edificio.toString().trim().toLowerCase();
    const pisoMatch  = pisoKey === targetPiso;
    const edMatch    = edLow === targetEd ||
                       edLow.includes(`edificio${targetEd}`) ||
                       edLow.includes(`edificio ${targetEd}`) ||
                       edLow === `edificio${targetEd}` ||
                       edLow === `edificio ${targetEd}`;

    console.log(`     Simulación getNavigationPath("Piso 2", "A"):`);
    console.log(`       pisoMatch=${pisoMatch}  (buscado="${targetPiso}", encontrado="${pisoKey}")`);
    console.log(`       edMatch  =${edMatch}   (buscado="${targetEd}", encontrado="${edLow}")`);
    if (pisoMatch && edMatch) {
      console.log('       ✅ ESTE documento sería el NavPath retornado para Sala A206');
    } else {
      console.log('       ❌ Este documento NO coincide con Piso 2 / Edificio A');
    }
  });
}

// ── 2. Inspeccionar locación Sala A206 ────────────────────────────────────────
async function inspectSalaA206() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  [2] Buscando "Sala A206" en todos los edificios');
  console.log('══════════════════════════════════════════════');

  const edSnap = await getDocs(collection(db, 'Edificios'));
  const subCols = ['Locaciones', 'Locaciones piso -1', 'Locaciones piso 1', 'Locaciones piso 2', 'Locaciones piso 3'];

  let found = false;
  for (const edDoc of edSnap.docs) {
    for (const sub of subCols) {
      try {
        const snap = await getDocs(collection(db, `Edificios/${edDoc.id}/${sub}`));
        snap.docs.forEach(doc => {
          const d = doc.data();
          const nombre = (getCI(d, 'Nombre') ?? getCI(d, 'nombre') ?? '').toString();
          if (/a206|sala\s*a206/i.test(nombre)) {
            found = true;
            console.log(`\n  📍 Encontrado en: Edificios/${edDoc.id}/${sub}/${doc.id}`);
            console.log(`     Nombre:  ${nombre}`);
            console.log(`     Cuerpo:  ${getCI(d, 'Cuerpo') ?? getCI(d, 'cuerpo') ?? '(no definido)'}`);
            console.log(`     Piso:    ${getCI(d, 'Piso')   ?? getCI(d, 'piso')   ?? '(no definido)'}`);
            console.log(`     Edificio:${getCI(d, 'Edificio') ?? getCI(d, 'edificio') ?? '(no definido)'}`);

            // Coordenadas — buscar todos los campos posibles
            const coordFields = ['Coordenadas3D', 'Coordenadas 3D', 'Coordenadas', 'coordenadas', 'coordinates', 'coords'];
            let coordSrc = null;
            for (const f of coordFields) {
              if (d[f]) { coordSrc = d[f]; console.log(`     Campo coord: "${f}"`); break; }
            }
            if (!coordSrc) coordSrc = d; // fallback: el doc mismo tiene x,y,z

            const x = getCI(coordSrc, 'x');
            const y = getCI(coordSrc, 'y');
            const z = getCI(coordSrc, 'z');
            console.log(`     Coordenadas: x=${x}, y=${y}, z=${z}`);

            if (x == null || y == null || z == null) {
              console.log('     ⚠️  extractVec3() retornará null → ruta no se puede calcular');
            } else {
              console.log('     ✅ extractVec3() puede leer las coordenadas correctamente');
            }
            console.log('\n     Documento completo (JSON):');
            console.log('    ', JSON.stringify(d, null, 2).replace(/\n/g, '\n     '));
          }
        });
      } catch (_) {}
    }
  }

  if (!found) {
    console.log('\n  ❌ No se encontró ningún documento con nombre "A206" o "Sala A206"');
    console.log('     → findLocationByName() retornará null y no se dibujará ninguna ruta');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  try {
    await inspectNavPaths();
    await inspectSalaA206();
    console.log('\n══════════════════════════════════════════════\n');
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

main();
