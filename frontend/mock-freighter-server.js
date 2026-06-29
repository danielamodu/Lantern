const http = require('http');
const { Keypair, TransactionBuilder } = require('@stellar/stellar-sdk');

async function start() {
  console.log("Generating keypair for mock Freighter...");
  const keypair = Keypair.random();
  const address = keypair.publicKey();
  console.log(`Mock Address: ${address}`);

  console.log("Funding mock account via Friendbot...");
  const fundRes = await fetch(`https://friendbot.stellar.org/?addr=${address}`);
  if (!fundRes.ok) {
    console.error("Failed to fund mock account");
    process.exit(1);
  }
  console.log("Mock account funded successfully.");

  const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === '/get-address') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ address }));
      return;
    }

    if (req.url === '/sign' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { transactionXdr } = JSON.parse(body);
          console.log(`Signing transaction XDR...`);
          const tx = TransactionBuilder.fromXDR(transactionXdr, 'Test SDF Network ; September 2015');
          tx.sign(keypair);
          const signedTransaction = tx.toXDR();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ signedTransaction }));
        } catch (err) {
          console.error("Signing failed:", err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(3001, () => {
    console.log("Mock Freighter signing server listening on port 3001");
  });
}

start().catch(console.error);
