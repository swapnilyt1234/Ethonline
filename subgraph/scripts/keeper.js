require('dotenv').config();
const { createPublicClient, createWalletClient, http, parseAbi, namehash, labelhash } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { sepolia } = require('viem/chains');

const PUBLIC_RESOLVER = '0xd9d71897e418f22035a7bebf58a4c7ea201ddaa0';
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1760204/eth-online/0.1.0';

const USER_REGISTRY = '0x8fd80a39346d3c66e3a1ed6b8df206ed6de853e8';
const PARENT_NAME = 'getpassport.eth';

const USER_REGISTRY_ABI = parseAbi([
  'function register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expiry) returns (uint256)',
]);

const PUBLIC_RESOLVER_ABI = parseAbi([
  'function setText(bytes32 node, string key, string value)'
]);

async function main() {
  const account = privateKeyToAccount(process.env.PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: sepolia, transport: http() });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http() });

  console.log(`Starting Keeper Sync...`);
  
  const query = `
    {
      borrowers(first: 100) {
        id
        score
      }
    }
  `;
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const data = await response.json();
  const users = data.data.borrowers;

  console.log(`Found ${users.length} users to sync.`);

  for (const user of users) {
    const address = user.id;
    const score = user.score.toString();
    const label = 'score-' + address.toLowerCase().replace('0x', '');
    const fullName = `${label}.${PARENT_NAME}`;
    const node = namehash(fullName);
    
    console.log(`\nProcessing ${fullName} (Score: ${score})...`);

    // Just try to register, if it fails assume it's already registered
    try {
      const { request: regRequest } = await publicClient.simulateContract({
        address: USER_REGISTRY,
        abi: USER_REGISTRY_ABI,
        functionName: 'register',
        args: [label, account.address, USER_REGISTRY, PUBLIC_RESOLVER, 0n, Math.floor(Date.now() / 1000) + 31536000],
        account
      });
      const regHash = await walletClient.writeContract(regRequest);
      console.log('  - Register Tx:', regHash);
      await publicClient.waitForTransactionReceipt({ hash: regHash });
    } catch(e) {
      console.log('  - Skipping registration (already registered)');
    }

    // Set Text Record
    console.log(`  - Setting text record passport.score = ${score}`);
    try {
      const { request } = await publicClient.simulateContract({
        address: PUBLIC_RESOLVER,
        abi: PUBLIC_RESOLVER_ABI,
        functionName: 'setText',
        args: [node, 'passport.score', score],
        account
      });
      const tx = await walletClient.writeContract(request);
      console.log(`  - setText Tx: ${tx}`);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`  - Sync Complete for ${fullName}`);
    } catch (err) {
      console.error(`  - Failed to set text record: ${err.shortMessage || err.message}`);
    }
  }
}

main().catch(console.error);
