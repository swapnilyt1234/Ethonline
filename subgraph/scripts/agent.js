require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPublicClient, createWalletClient, http, parseAbi, namehash } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { sepolia } = require('viem/chains');

// The Graph endpoint for Phase 2
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1760204/eth-online/0.1.0';

// Arc Testnet Config
const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: { decimals: 6, name: 'USDC', symbol: 'USDC' },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
};

// Contract Addresses (Verified from deployment logs)
const POOL_ADDRESS = '0x0B92843e606C0D42132c23c688B7238CEa6FDeb7';
const MOCK_WETH = '0xCe0FF6442916970ff33C927b115bD14808A2DDb8';
const ENS_RESOLVER = '0xd9d71897e418f22035a7bebf58a4c7ea201ddaa0';
const PARENT_NAME = 'getpassport.eth';

const abiResolver = parseAbi(['function text(bytes32 node, string key) view returns (string)']);
const abiPool = parseAbi([
  'function depositCollateral(uint256 amount)',
  'function borrow(uint256 amount)'
]);
const abiErc20 = parseAbi([
  'function approve(address spender, uint256 amount)',
  'function allowance(address owner, address spender) view returns (uint256)'
]);

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error("Missing PRIVATE_KEY in env");
  const account = privateKeyToAccount(process.env.PRIVATE_KEY);
  const borrowerAddress = account.address;

  console.log(`🤖 AI Agent started for borrower: ${borrowerAddress}`);

  // 1. Read from The Graph (Track 1)
  console.log(`\n🔍 [Track 1] Querying Subgraph for on-chain loan history...`);
  const query = `{ borrowers(where: { id: "${borrowerAddress.toLowerCase()}" }) { score totalRequested totalRepaid } }`;
  const res = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  
  if (!data.data.borrowers || data.data.borrowers.length === 0) {
    console.log("No loan history found. Agent terminating.");
    return;
  }
  const subgraphScore = data.data.borrowers[0].score;
  console.log(`✅ Subgraph Result: Score = ${subgraphScore}, Repaid = ${data.data.borrowers[0].totalRepaid}`);

  // 2. Verify against ENS Identity (Track 2)
  console.log(`\n🔍 [Track 2] Verifying score against ENS Identity on Sepolia...`);
  const sepoliaClient = createPublicClient({ chain: sepolia, transport: http() });
  const label = 'score-' + borrowerAddress.toLowerCase().replace('0x', '');
  const node = namehash(`${label}.${PARENT_NAME}`);
  
  const ensScoreStr = await sepoliaClient.readContract({
    address: ENS_RESOLVER,
    abi: abiResolver,
    functionName: 'text',
    args: [node, 'passport.score']
  });
  const ensScore = parseInt(ensScoreStr, 10);
  console.log(`✅ ENS Result: passport.score = ${ensScore}`);

  if (subgraphScore !== ensScore) {
    console.warn("⚠️ Discrepancy between Subgraph and ENS. Waiting for Keeper to sync...");
    return;
  }

  // 3. Make risk-adjusted decision (Track 3: Arc Testnet)
  console.log(`\n🧠 Making risk-adjusted financial decision...`);
  if (ensScore >= 70) {
    console.log(`📈 Score is healthy (${ensScore} >= 70). Decision: Leverage up with under-collateralized loan (150% LTV).`);
  } else {
    console.log(`📉 Score is poor (${ensScore} < 70). Decision: Skip borrowing due to strict 80% LTV requirements.`);
    return;
  }

  // 4. Execute on Arc Testnet
  console.log(`\n⚙️ [Track 3] Executing strategy on Arc Testnet Lending Pool...`);
  const arcClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const arcWallet = createWalletClient({ account, chain: arcTestnet, transport: http() });

  const depositAmount = 100000000000000n; // 0.0001 WETH
  
  // Check allowance
  const allowance = await arcClient.readContract({
    address: MOCK_WETH,
    abi: abiErc20,
    functionName: 'allowance',
    args: [borrowerAddress, POOL_ADDRESS]
  });

  if (allowance < depositAmount) {
    console.log("  - Approving MockWETH for Lending Pool...");
    const { request: approveReq } = await arcClient.simulateContract({
      address: MOCK_WETH,
      abi: abiErc20,
      functionName: 'approve',
      args: [POOL_ADDRESS, depositAmount * 100n],
      account
    });
    const approveTx = await arcWallet.writeContract(approveReq);
    await arcClient.waitForTransactionReceipt({ hash: approveTx });
    console.log(`  - Approval confirmed: ${approveTx}`);
  }

  // Deposit Collateral
  console.log(`  - Depositing 0.0001 MockWETH...`);
  const { request: depReq } = await arcClient.simulateContract({
    address: POOL_ADDRESS,
    abi: abiPool,
    functionName: 'depositCollateral',
    args: [depositAmount],
    account
  });
  const depTx = await arcWallet.writeContract(depReq);
  await arcClient.waitForTransactionReceipt({ hash: depTx });
  console.log(`  - Deposit Tx Hash: ${depTx}`);

  // Borrow (1.5x Leverage for score >= 70)
  const borrowAmount = (depositAmount * 150n) / 100n; 
  console.log(`  - Requesting under-collateralized borrow: 0.00015 MockUSDC (150% of collateral)...`);
  const { request: borrowReq } = await arcClient.simulateContract({
    address: POOL_ADDRESS,
    abi: abiPool,
    functionName: 'borrow',
    args: [borrowAmount],
    account
  });
  const borrowTx = await arcWallet.writeContract(borrowReq);
  await arcClient.waitForTransactionReceipt({ hash: borrowTx });
  console.log(`  - Borrow Tx Hash: ${borrowTx}`);

  console.log(`\n🎉 Agent execution completed successfully across The Graph, ENS, and Arc Testnet!`);
}

main().catch(console.error);
