const http = require('https');

function getREST(path) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/bdinago/databases/(default)/documents${path}`;
    http.get(url, (res) => {
      console.log('Status Code:', res.statusCode);
      console.log('Headers:', res.headers);
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function listDocs() {
  const result = await getREST('');
  console.log('Body snippet:', result.slice(0, 1000));
}

listDocs().catch(console.error);
