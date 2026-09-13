require('dotenv').config();
const { createPublicClient, createWalletClient, http, parseAbi, namehash } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { sepolia } = require('viem/chains');

const RESOLVER_ADDRESS = '0xd9d71897e418f22035a7bebf58a4c7ea201ddaa0';
const POOL_ADDRESS = '0x0B92843e606C0D42132c23c688B7238CEa6FDeb7';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const BORROWER = '0xD9126aAe4415afb07694f118018eA1eD7b2ABCEe';
const PARENT_NAME = 'getpassport.eth';

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: { decimals: 6, name: 'USDC', symbol: 'USDC' },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
};

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  
  // 1. Read score from Sepolia ENS MockResolver
  const sepoliaClient = createPublicClient({ chain: sepolia, transport: http() });
  
  const label = 'score-' + BORROWER.toLowerCase().replace('0x', '');
  const fullName = `${label}.${PARENT_NAME}`;
  const node = namehash(fullName);
  
  console.log(`Querying score for ${fullName} from Sepolia ENS...`);
  
  const abiResolver = parseAbi(['function text(bytes32 node, string key) view returns (string)']);
  
  const scoreStr = await sepoliaClient.readContract({
    address: RESOLVER_ADDRESS,
    abi: abiResolver,
    functionName: 'text',
    args: [node, 'passport.score']
  });
  
  const score = parseInt(scoreStr, 10);
  console.log(`Score found: ${score}`);
  
  // 2. Write score to Arc Testnet Lending Pool
  const arcClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const arcWallet = createWalletClient({ account, chain: arcTestnet, transport: http() });
  
  const abiPool = parseAbi(['function updateScore(address user, uint256 score)']);
  
  console.log(`Updating score for ${BORROWER} on Arc Testnet Pool...`);
  const { request } = await arcClient.simulateContract({
    address: POOL_ADDRESS,
    abi: abiPool,
    functionName: 'updateScore',
    args: [BORROWER, BigInt(score)],
    account
  });
  
  const tx = await arcWallet.writeContract(request);
  console.log(`updateScore Tx Hash: ${tx}`);
  await arcClient.waitForTransactionReceipt({ hash: tx });
  console.log(`Done! Oracle push successful.`);
}

main().catch(console.error);
