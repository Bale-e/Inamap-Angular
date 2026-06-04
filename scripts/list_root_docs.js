const http = require('https');

function getREST(path) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/bdinago/databases/(default)/documents${path}`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function listDocs() {
  console.log('--- ROOT DOCUMENTS ---');
  const root = await getREST('');
  console.log(JSON.stringify(root, null, 2));
}

listDocs().catch(console.error);
