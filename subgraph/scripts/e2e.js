require('dotenv').config({ path: require('path').resolve(__dirname, '../subgraph/.env') });
const { createPublicClient, createWalletClient, http, parseAbi } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { sepolia } = require('viem/chains');

const V1_POOL = '0x508dE72772F7fFC3Df52164Db3B149EED3718a20';
const arcTestnet = {
  id: 5042002, name: 'Arc Testnet',
  nativeCurrency: { decimals: 6, name: 'USDC', symbol: 'USDC' },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
};

const abiV1 = parseAbi([
  'function requestLoan(uint256 amount)',
  'function repayLoan(uint256 loanId)'
]);

async function main() {
  const account = privateKeyToAccount(process.env.PRIVATE_KEY);
  const arcClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const arcWallet = createWalletClient({ account, chain: arcTestnet, transport: http() });

  console.log("Requesting Loan on V1 to drop score...");
  const { request: req1 } = await arcClient.simulateContract({
    address: V1_POOL, abi: abiV1, functionName: 'requestLoan', args: [1000n], account
  });
  const tx1 = await arcWallet.writeContract(req1);
  await arcClient.waitForTransactionReceipt({ hash: tx1 });
  console.log("Request Tx:", tx1);

  // Note: We need to wait for The Graph to index it.
  console.log("Waiting 15s for Subgraph to index...");
  await new Promise(r => setTimeout(r, 15000));
}
main().catch(console.error);
