const express = require('express');
const cors    = require('cors');
const admin   = require('firebase-admin');
const servicioCuenta = require('./ServiceAccountKey.json');

// ── INICIALIZACIÓN ───────────────────────────────────────────
admin.initializeApp({
  credential:  admin.credential.cert(servicioCuenta),
  databaseURL: 'https://bdinago.firebaseio.com'
});

const db  = admin.firestore();
const app = express();
app.use(cors());
app.use(express.json());

// ── Colecciones de locaciones dentro de cada edificio ────────
const COLECCIONES_LOCACIONES = [
  'Locaciones',
  'Locaciones piso -1',
  'Locaciones piso 2',
  'Locaciones piso 3'
];

// ── Busca un campo sin importar mayúscula/minúscula ──────────
function getFieldCI(obj, fieldName) {
  if (!obj) return undefined;
  const regex = new RegExp(`^${fieldName}$`, 'i');
  const key = Object.keys(obj).find(k => regex.test(k));
  return key !== undefined ? obj[key] : undefined;
}

// ── Normaliza coordenadas 3D sin importar el nombre del campo ─
function extraerCoordenadas(doc) {
  const coord = getFieldCI(doc, 'Coordenadas 3D') || getFieldCI(doc, 'Coordenadas');
  if (!coord || typeof coord !== 'object') return null;
  const x = getFieldCI(coord, 'x');
  const y = getFieldCI(coord, 'y');
  const z = getFieldCI(coord, 'z');
  if (x == null || y == null || z == null) return null;
  return { x, y, z };
}

// ════════════════════════════════════════════════════════════
//  EDIFICIOS
// ════════════════════════════════════════════════════════════

app.get('/edificios', async (req, res) => {
  try {
    const snapshot = await db.collection('Edificios').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (error) {
    res.status(500).send({ error: 'Error al obtener edificios: ' + error.message });
  }
});

app.get('/edificios/:id', async (req, res) => {
  try {
    const doc = await db.collection('Edificios').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).send({ error: 'Edificio no encontrado' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).send({ error: 'Error al obtener edificio: ' + error.message });
  }
});

// NUEVO — busca un edificio por su nombre, no por ID.
// Ejemplo: /edificios/nombre/Edificio A
app.get('/edificios/nombre/:nombre', async (req, res) => {
  try {
    const snapshot = await db.collection('Edificios').get();
    const nombreBuscado = req.params.nombre.trim().toLowerCase();
    const encontrado = snapshot.docs.find(doc => {
      const nombre = getFieldCI(doc.data(), 'nombre');
      return (nombre ?? '').toString().trim().toLowerCase() === nombreBuscado;
    });
    if (!encontrado) {
      return res.status(404).send({ error: 'Edificio no encontrado' });
    }
    res.json({ id: encontrado.id, ...encontrado.data() });
  } catch (error) {
    res.status(500).send({ error: 'Error al buscar edificio por nombre: ' + error.message });
  }
});

// ════════════════════════════════════════════════════════════
//  LOCACIONES (repartidas en 4 colecciones dentro de cada edificio)
// ════════════════════════════════════════════════════════════

async function obtenerLocacionesDeEdificio(edificioId) {
  const resultados = [];
  for (const nombreColeccion of COLECCIONES_LOCACIONES) {
    const snapshot = await db
      .collection('Edificios')
      .doc(edificioId)
      .collection(nombreColeccion)
      .get();
    snapshot.docs.forEach(doc => {
      resultados.push({ id: doc.id, _coleccion: nombreColeccion, ...doc.data() });
    });
  }
  return resultados;
}

app.get('/edificios/:id/locaciones', async (req, res) => {
  try {
    const data = await obtenerLocacionesDeEdificio(req.params.id);
    res.json(data);
  } catch (error) {
    res.status(500).send({ error: 'Error al obtener locaciones: ' + error.message });
  }
});

app.get('/edificios/:id/locaciones/piso/:piso', async (req, res) => {
  try {
    const todas = await obtenerLocacionesDeEdificio(req.params.id);
    const pisoBuscado = req.params.piso.trim().toLowerCase();
    const data = todas.filter(loc => {
      const piso = getFieldCI(loc, 'piso');
      return (piso ?? '').toString().trim().toLowerCase() === pisoBuscado;
    });
    res.json(data);
  } catch (error) {
    res.status(500).send({ error: 'Error al filtrar por piso: ' + error.message });
  }
});

app.get('/edificios/:id/locaciones/tipo/:tipo', async (req, res) => {
  try {
    const todas = await obtenerLocacionesDeEdificio(req.params.id);
    const tipoBuscado = req.params.tipo.trim().toLowerCase();
    const data = todas.filter(loc => {
      const tipo = getFieldCI(loc, 'tipo');
      return (tipo ?? '').toString().trim().toLowerCase() === tipoBuscado;
    });
    res.json(data);
  } catch (error) {
    res.status(500).send({ error: 'Error al filtrar por tipo: ' + error.message });
  }
});

app.get('/edificios/:id/locaciones/nombre/:nombre', async (req, res) => {
  try {
    const todas = await obtenerLocacionesDeEdificio(req.params.id);
    const nombreBuscado = req.params.nombre.trim().toLowerCase();
    const encontrada = todas.find(loc => {
      const nombre = getFieldCI(loc, 'nombre');
      return (nombre ?? '').toString().trim().toLowerCase() === nombreBuscado;
    });
    if (!encontrada) {
      return res.status(404).send({ error: 'Locación no encontrada' });
    }
    res.json({ ...encontrada, coordenadas: extraerCoordenadas(encontrada) });
  } catch (error) {
    res.status(500).send({ error: 'Error al buscar locación: ' + error.message });
  }
});

// ════════════════════════════════════════════════════════════
//  BÚSQUEDA GLOBAL (sin necesidad de conocer el ID del edificio)
// ════════════════════════════════════════════════════════════

// NUEVO — busca una locación por nombre en TODOS los edificios,
// sin necesidad de saber a cuál pertenece.
// Ejemplo: /locaciones/Sala A101
app.get('/locaciones/:nombre', async (req, res) => {
  try {
    const edificiosSnapshot = await db.collection('Edificios').get();
    const nombreBuscado = req.params.nombre.trim().toLowerCase();

    for (const edificioDoc of edificiosSnapshot.docs) {
      const locaciones = await obtenerLocacionesDeEdificio(edificioDoc.id);
      const encontrada = locaciones.find(loc => {
        const nombre = getFieldCI(loc, 'nombre');
        return (nombre ?? '').toString().trim().toLowerCase() === nombreBuscado;
      });

      if (encontrada) {
        return res.json({
          ...encontrada,
          coordenadas: extraerCoordenadas(encontrada),
          edificioId: edificioDoc.id,
          edificioNombre: getFieldCI(edificioDoc.data(), 'nombre')
        });
      }
    }

    res.status(404).send({ error: 'Locación no encontrada en ningún edificio' });
  } catch (error) {
    res.status(500).send({ error: 'Error al buscar locación por nombre: ' + error.message });
  }
});

// ════════════════════════════════════════════════════════════
//  NAVIGATION PATHS
// ════════════════════════════════════════════════════════════

app.get('/navigation-paths', async (req, res) => {
  try {
    const snapshot = await db.collection('navigation-paths').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (error) {
    res.status(500).send({ error: 'Error al obtener navigation-paths: ' + error.message });
  }
});

app.get('/navigation-paths/piso/:piso', async (req, res) => {
  try {
    const snapshot = await db.collection('navigation-paths').get();
    const pisoBuscado = req.params.piso.trim().toLowerCase();
    const encontrado = snapshot.docs.find(doc => {
      const piso = getFieldCI(doc.data(), 'piso');
      return (piso ?? '').toString().trim().toLowerCase() === pisoBuscado;
    });
    if (!encontrado) {
      return res.status(404).send({ error: 'No hay navigation-path para ese piso' });
    }
    res.json({ id: encontrado.id, ...encontrado.data() });
  } catch (error) {
    res.status(500).send({ error: 'Error al obtener navigation-path: ' + error.message });
  }
});

// ════════════════════════════════════════════════════════════
//  RUTAS (colección antigua)
// ════════════════════════════════════════════════════════════

// NOTA: colección "rutas" reemplazada por "navigation-paths" (Accesos/Giros/Conexiones).
// Se deja esta función por si se necesita más adelante, pero actualmente no se usa en la app.
app.get('/rutas', async (req, res) => {
  try {
    const snapshot = await db.collection('rutas').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (error) {
    res.status(500).send({ error: 'Error al obtener rutas: ' + error.message });
  }
});

// ════════════════════════════════════════════════════════════
//  SERVIDOR
// ════════════════════════════════════════════════════════════
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}, Funciono`);
});