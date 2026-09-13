const fetch = require('node-fetch');
async function run() {
  const query = '{ borrowers(where: { id: "0xd9126aae4415afb07694f118018ea1ed7b2abcee" }) { id score totalRequested totalRepaid } }';
  const res = await fetch('https://api.studio.thegraph.com/query/1760204/eth-online/0.1.0', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
