require('dotenv').config();
const { createPublicClient, createWalletClient, http, parseAbi, namehash, labelhash } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { sepolia } = require('viem/chains');

const VERIFIABLE_FACTORY = '0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef';
const USER_REGISTRY_IMPL = '0x624a25d67b59d587752ebec8dded8827dae52050';
const ETH_REGISTRY = '0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2';

const PARENT_NAME = 'getpassport.eth';
const LABEL = PARENT_NAME.replace('.eth', '');

const VERIFIABLE_FACTORY_ABI = parseAbi([
  'function deployProxy(address implementation, uint256 salt, bytes data) returns (address proxy)'
]);

const ETH_REGISTRY_ABI = parseAbi([
  'function setSubregistry(uint256 anyId, address registry)'
]);

async function main() {
  const account = privateKeyToAccount(process.env.PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: sepolia, transport: http() });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http() });

  console.log('Deploying UserRegistry via VerifiableFactory...');
  // The correct role bitmap
  const ROLE_BITMAP = 7237005577332262213973186563048704625758322804144211859756124541958966218753n;

  const initializeData = require('viem').encodeFunctionData({
    abi: parseAbi(['function initialize(address rootAccount, uint256 roleBitmap)']),
    functionName: 'initialize',
    args: [account.address, ROLE_BITMAP]
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
  
  const proxyAddress = await publicClient.readContract({
    address: VERIFIABLE_FACTORY,
    abi: VERIFIABLE_FACTORY_ABI,
    functionName: 'deployProxy',
    args: [USER_REGISTRY_IMPL, salt, initializeData],
    account
  });
  console.log(`Subregistry deployed at: ${proxyAddress}`);

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
