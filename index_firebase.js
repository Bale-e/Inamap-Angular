const express = require('express');
const admin   = require('firebase-admin');
const servicioCuenta = require('./ServiceAccountKey.json');

// ── INICIALIZACIÓN ───────────────────────────────────────────
admin.initializeApp({
  credential:  admin.credential.cert(servicioCuenta),
  databaseURL: 'https://bdinago.firebaseio.com'
});

const db  = admin.firestore();
const app = express();
app.use(express.json());


// ════════════════════════════════════════════════════════════
//  EDIFICIOS
// ════════════════════════════════════════════════════════════

// GET /edificios — trae todos los edificios
app.get('/edificios', async (req, res) => {
  try {
    const snapshot = await db.collection('Edificios').get();
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(data);
  } catch (error) {
    res.status(500).send({ error: 'Error al obtener edificios: ' + error.message });
  }
});

// GET /edificios/:id — trae un edificio por su ID
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


// ════════════════════════════════════════════════════════════
//  LOCACIONES  (subcolección dentro de cada Edificio)
// ════════════════════════════════════════════════════════════

// GET /edificios/:id/locaciones — todas las locaciones de un edificio
app.get('/edificios/:id/locaciones', async (req, res) => {
  try {
    const snapshot = await db
      .collection('Edificios')
      .doc(req.params.id)
      .collection('Locaciones')
      .get();

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(data);
  } catch (error) {
    res.status(500).send({ error: 'Error al obtener locaciones: ' + error.message });
  }
});

// GET /edificios/:id/locaciones/piso/:piso — filtra por piso
// Ejemplo: /edificios/abc123/locaciones/piso/2
app.get('/edificios/:id/locaciones/piso/:piso', async (req, res) => {
  try {
    const snapshot = await db
      .collection('Edificios')
      .doc(req.params.id)
      .collection('Locaciones')
      .where('Piso', '==', req.params.piso)
      .get();

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(data);
  } catch (error) {
    res.status(500).send({ error: 'Error al filtrar por piso: ' + error.message });
  }
});

// GET /edificios/:id/locaciones/tipo/:tipo — filtra por tipo
// Ejemplo: /edificios/abc123/locaciones/tipo/Sala de Clases
app.get('/edificios/:id/locaciones/tipo/:tipo', async (req, res) => {
  try {
    const snapshot = await db
      .collection('Edificios')
      .doc(req.params.id)
      .collection('Locaciones')
      .where('Tipo', '==', req.params.tipo)
      .get();

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(data);
  } catch (error) {
    res.status(500).send({ error: 'Error al filtrar por tipo: ' + error.message });
  }
});

// GET /edificios/:id/locaciones/:locId — una locación específica por ID
app.get('/edificios/:id/locaciones/:locId', async (req, res) => {
  try {
    const doc = await db
      .collection('Edificios')
      .doc(req.params.id)
      .collection('Locaciones')
      .doc(req.params.locId)
      .get();

    if (!doc.exists) {
      return res.status(404).send({ error: 'Locación no encontrada' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).send({ error: 'Error al obtener locación: ' + error.message });
  }
});


// ════════════════════════════════════════════════════════════
//  NAVIGATION PATHS
// ════════════════════════════════════════════════════════════

// GET /navigation-paths — todos los nodos de navegación
app.get('/navigation-paths', async (req, res) => {
  try {
    const snapshot = await db.collection('navigation_paths').get();
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(data);
  } catch (error) {
    res.status(500).send({ error: 'Error al obtener navigation paths: ' + error.message });
  }
});

// GET /navigation-paths/piso/:piso — filtra nodos por piso
app.get('/navigation-paths/piso/:piso', async (req, res) => {
  try {
    const snapshot = await db
      .collection('navigation_paths')
      .where('piso', '==', req.params.piso)
      .get();

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(data);
  } catch (error) {
    res.status(500).send({ error: 'Error al filtrar paths por piso: ' + error.message });
  }
});


// ════════════════════════════════════════════════════════════
//  RUTAS
// ════════════════════════════════════════════════════════════

// GET /rutas — todas las rutas
app.get('/rutas', async (req, res) => {
  try {
    const snapshot = await db.collection('rutas').get();
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(data);
  } catch (error) {
    res.status(500).send({ error: 'Error al obtener rutas: ' + error.message });
  }
});

// GET /rutas/desde/:origen — busca rutas por nombre de origen
// Ejemplo: /rutas/desde/Sala A101
app.get('/rutas/desde/:origen', async (req, res) => {
  try {
    const snapshot = await db
      .collection('rutas')
      .where('origen_ref', '==', req.params.origen)
      .get();

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(data);
  } catch (error) {
    res.status(500).send({ error: 'Error al buscar ruta: ' + error.message });
  }
});


// ════════════════════════════════════════════════════════════
//  SERVIDOR
// ════════════════════════════════════════════════════════════
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}, Funciono`);
});