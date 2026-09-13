require('dotenv').config();
const { createPublicClient, createWalletClient, http, parseAbi, namehash, labelhash } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { sepolia } = require('viem/chains');

// ENSv2 Sepolia Verified Addresses
const MOCK_USDC = '0x768f42455a2d082e23ceef7d51e5787c82d67a39';
const ETH_REGISTRAR = '0xa88553f454b77203b0d036a05c894d555eaaa2cc';
const VERIFIABLE_FACTORY = '0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef';
const USER_REGISTRY_IMPL = '0x624a25d67b59d587752ebec8dded8827dae52050';
const ETH_REGISTRY = '0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2';

// Config
const PARENT_NAME = 'getpassport.eth';
const LABEL = PARENT_NAME.replace('.eth', '');
const DURATION = 31536000n; // 1 year

const MOCK_USDC_ABI = parseAbi([
  'function mint(address to, uint256 amount)',
  'function approve(address spender, uint256 amount)',
  'function balanceOf(address account) view returns (uint256)'
]);

const ETH_REGISTRAR_ABI = parseAbi([
  'function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)',
  'function commit(bytes32 commitment)',
  'function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer) returns (uint256)',
  'function MIN_COMMITMENT_AGE() view returns (uint64)'
]);

const VERIFIABLE_FACTORY_ABI = parseAbi([
  'function deployProxy(address implementation, uint256 salt, bytes data) returns (address proxy)'
]);

const ETH_REGISTRY_ABI = parseAbi([
  'function setSubregistry(uint256 anyId, address registry)'
]);

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error('Error: PRIVATE_KEY is not set in .env');
    process.exit(1);
  }

  const account = privateKeyToAccount(process.env.PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: sepolia, transport: http() });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http() });

  console.log(`Starting ENS Setup for ${PARENT_NAME} as ${account.address}...`);

  // 1. Mint MockUSDC
  console.log('Minting MockUSDC...');
  const mintHash = await walletClient.writeContract({
    address: MOCK_USDC,
    abi: MOCK_USDC_ABI,
    functionName: 'mint',
    args: [account.address, 1000_000_000n] // 1000 USDC
  });
  console.log('Mint Tx:', mintHash);
  await publicClient.waitForTransactionReceipt({ hash: mintHash, timeout: 300_000 });

  // 2. Approve MockUSDC to ETHRegistrar
  console.log('Approving MockUSDC to ETHRegistrar...');
  const approveHash = await walletClient.writeContract({
    address: MOCK_USDC,
    abi: MOCK_USDC_ABI,
    functionName: 'approve',
    args: [ETH_REGISTRAR, 1000_000_000n]
  });
  console.log('Approve Tx:', approveHash);
  await publicClient.waitForTransactionReceipt({ hash: approveHash, timeout: 300_000 });

  // 3. Commit
  const secret = '0x' + Buffer.from(Math.random().toString()).toString('hex').padEnd(64, '0').substring(0, 64);
  const referrer = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const subregistry = '0x0000000000000000000000000000000000000000';
  const resolver = '0x0000000000000000000000000000000000000000';

  console.log('Making commitment...');
  const commitment = await publicClient.readContract({
    address: ETH_REGISTRAR,
    abi: ETH_REGISTRAR_ABI,
    functionName: 'makeCommitment',
    args: [LABEL, account.address, secret, subregistry, resolver, DURATION, referrer]
  });

  console.log('Committing:', commitment);
  const commitHash = await walletClient.writeContract({
    address: ETH_REGISTRAR,
    abi: ETH_REGISTRAR_ABI,
    functionName: 'commit',
    args: [commitment]
  });
  console.log('Commit Tx:', commitHash);
  
  // Wait for confirmation
  const commitReceipt = await publicClient.waitForTransactionReceipt({ hash: commitHash, timeout: 300_000 });
  console.log('Commit confirmed in block', commitReceipt.blockNumber);

  // Poll for MIN_COMMITMENT_AGE
  const minAge = await publicClient.readContract({
    address: ETH_REGISTRAR,
    abi: ETH_REGISTRAR_ABI,
    functionName: 'MIN_COMMITMENT_AGE'
  });
  console.log(`Waiting for MIN_COMMITMENT_AGE (${minAge}s)...`);
  
  const commitBlock = await publicClient.getBlock({ blockNumber: commitReceipt.blockNumber });
  while (true) {
    const latestBlock = await publicClient.getBlock();
    const age = latestBlock.timestamp - commitBlock.timestamp;
    if (age >= minAge) {
      console.log(`Commitment is old enough! (age: ${age}s)`);
      break;
    }
    console.log(`Current age: ${age}s... polling.`);
    await new Promise(r => setTimeout(r, 5000));
  }

  // 4. Reveal (Register)
  console.log('Registering (Revealing)...');
  try {
    const { request } = await publicClient.simulateContract({
      address: ETH_REGISTRAR,
      abi: ETH_REGISTRAR_ABI,
      functionName: 'register',
      args: [LABEL, account.address, secret, subregistry, resolver, DURATION, MOCK_USDC, referrer],
      account
    });
    const registerHash = await walletClient.writeContract(request);
    console.log('Register Tx:', registerHash);
    await publicClient.waitForTransactionReceipt({ hash: registerHash, timeout: 300_000 });
    console.log(`Successfully registered ${PARENT_NAME}!`);
  } catch (err) {
    console.error('Registration failed! The reveal was submitted either too early or the name is already taken.');
    console.error(err);
    process.exit(1);
  }

  // 5. Deploy Subregistry via VerifiableFactory
  console.log('Deploying UserRegistry via VerifiableFactory...');
  // rootAccount, roleBitmap = 0xffffffffffffffffffffffffffffffff...
  const initializeData = require('viem').encodeFunctionData({
    abi: parseAbi(['function initialize(address rootAccount, uint256 roleBitmap)']),
    functionName: 'initialize',
    args: [account.address, 115792089237316195423570985008687907853269984665640564039457584007913129639935n]
  });
  const salt = BigInt('0x' + Buffer.from(Math.random().toString()).toString('hex').padEnd(64, '0').substring(0, 64));
  
  const { request: deployRequest } = await publicClient.simulateContract({
    address: VERIFIABLE_FACTORY,
    abi: VERIFIABLE_FACTORY_ABI,
    functionName: 'deployProxy',
    args: [USER_REGISTRY_IMPL, salt, initializeData],
    account
  });
  const deployHash = await walletClient.writeContract(deployRequest);
  console.log('Deploy Subregistry Tx:', deployHash);
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash, timeout: 300_000 });
  
  // Extract proxy address from events or predict it. 
  // It's easier to just look at the create event, but let's just simulate to get the returned address.
  const proxyAddress = await publicClient.readContract({
    address: VERIFIABLE_FACTORY,
    abi: VERIFIABLE_FACTORY_ABI,
    functionName: 'deployProxy',
    args: [USER_REGISTRY_IMPL, salt, initializeData],
    account
  });
  console.log(`Subregistry deployed at: ${proxyAddress}`);

  // 6. Link Subregistry to ETHRegistry
  console.log('Linking Subregistry to parent name...');
  const anyId = BigInt(labelhash(LABEL));
  const { request: linkRequest } = await publicClient.simulateContract({
    address: ETH_REGISTRY,
    abi: ETH_REGISTRY_ABI,
    functionName: 'setSubregistry',
    args: [anyId, proxyAddress],
    account
  });
  const linkHash = await walletClient.writeContract(linkRequest);
  console.log('Link Subregistry Tx:', linkHash);
  await publicClient.waitForTransactionReceipt({ hash: linkHash, timeout: 300_000 });

  console.log('Setup Complete!');
}

main().catch(console.error);
