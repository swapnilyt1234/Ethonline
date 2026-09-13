import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http, useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { namehash, parseAbi, parseEther } from 'viem'
import { useState } from 'react'

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { decimals: 6, name: 'USDC', symbol: 'USDC' },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
}

const config = createConfig({
  chains: [arcTestnet, sepolia],
  transports: {
    [arcTestnet.id]: http(),
    [sepolia.id]: http(),
  },
})

const queryClient = new QueryClient()

const RESOLVER_ADDRESS = '0xd9d71897e418f22035a7bebf58a4c7ea201ddaa0'
const POOL_ADDRESS = '0x0B92843e606C0D42132c23c688B7238CEa6FDeb7'
const WETH_ADDRESS = '0xCe0FF6442916970ff33C927b115bD14808A2DDb8'
const PARENT_NAME = 'getpassport.eth'

const abiResolver = parseAbi(['function text(bytes32 node, string key) view returns (string)'])
const abiPool = parseAbi([
  'function depositCollateral(uint256 amount)',
  'function borrow(uint256 amount)',
  'function collaterals(address user) view returns (uint256)',
  'function borrows(address user) view returns (uint256)'
])
const abiErc20 = parseAbi([
  'function approve(address spender, uint256 amount)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)'
])


function App() {
  const [showApp, setShowApp] = useState(false)

  if (!showApp) {
    return <LandingPage onLaunch={() => setShowApp(true)} />
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <Dashboard onBack={() => setShowApp(false)} />
      </QueryClientProvider>
    </WagmiProvider>
  )
}

function LandingPage({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="container">
      <header>
        <div className="logo">Passport DeFi</div>
        <button className="btn btn-primary" onClick={onLaunch}>Launch App</button>
      </header>

      <main className="hero">
        <div className="cyber-badge">ETHOnline 2026</div>
        <h1>On-Chain Trust</h1>
        <p>Unlock under-collateralized lending through verifiable reputation. We bridge your on-chain history from The Graph to your ENS identity to dynamically adjust lending risk.</p>
        <button className="btn btn-primary" style={{ padding: '1rem 3rem', fontSize: '1rem' }} onClick={onLaunch}>Enter App</button>
      </main>

      <section className="features">
        <div className="feature-card">
          <h3>The Graph</h3>
          <p>We index your on-chain lending history across protocols to calculate a live, verifiable credit score. This raw data is aggregated via a custom GraphQL Subgraph.</p>
        </div>
        <div className="feature-card">
          <h3>ENS Identity</h3>
          <p>Your score is linked to your ENS subname (e.g. score.getpassport.eth). We use Sepolia Text Records as a decentralized key-value store readable by any smart contract or AI agent.</p>
        </div>
        <div className="feature-card">
          <h3>Arc Testnet</h3>
          <p>Our lending pool automatically reads your score. High scores (>= 70) unlock 150% under-collateralized borrowing directly on the Arc execution layer.</p>
        </div>
      </section>

      <footer className="app-footer">
        <div className="footer-content">
          <p className="mono-text">Built for ETHOnline 2026</p>
          <p className="mono-text" style={{color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.5rem'}}>
            Powered by The Graph, ENS, and Arc Testnet
          </p>
        </div>
      </footer>
    </div>
  )
}

function Dashboard({ onBack }: { onBack: () => void }) {
  const { address, isConnected, chainId: activeChainId } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

  const [depositAmount, setDepositAmount] = useState('')
  const [borrowAmount, setBorrowAmount] = useState('')

  // 1. Fetch Score from ENS
  const label = address ? 'score-' + address.toLowerCase().replace('0x', '') : ''
  const fullName = `${label}.${PARENT_NAME}`
  const node = address ? namehash(fullName) : '0x0'
  
  const { data: scoreStr, isLoading: isLoadingScore } = useReadContract({
    address: RESOLVER_ADDRESS,
    abi: abiResolver,
    functionName: 'text',
    args: [node as any, 'passport.score'],
    chainId: sepolia.id,
    query: { enabled: !!address }
  })
  
  const score = scoreStr ? parseInt(scoreStr, 10) : 0
  
  // 2. Pool State
  const { data: collateral } = useReadContract({
    address: POOL_ADDRESS,
    abi: abiPool,
    functionName: 'collaterals',
    args: [address as any],
    chainId: arcTestnet.id,
    query: { enabled: !!address, refetchInterval: 5000 }
  })

  const { data: borrowed } = useReadContract({
    address: POOL_ADDRESS,
    abi: abiPool,
    functionName: 'borrows',
    args: [address as any],
    chainId: arcTestnet.id,
    query: { enabled: !!address, refetchInterval: 5000 }
  })
  
  // 3. WETH Allowance
  const { data: allowance } = useReadContract({
    address: WETH_ADDRESS,
    abi: abiErc20,
    functionName: 'allowance',
    args: [address as any, POOL_ADDRESS],
    chainId: arcTestnet.id,
    query: { enabled: !!address, refetchInterval: 5000 }
  })
  
  const { data: wethBal } = useReadContract({
    address: WETH_ADDRESS,
    abi: abiErc20,
    functionName: 'balanceOf',
    args: [address as any],
    chainId: arcTestnet.id,
    query: { enabled: !!address, refetchInterval: 5000 }
  })

  const { writeContract, data: txHash, error: txError } = useWriteContract()
  const { isLoading: isWaiting } = useWaitForTransactionReceipt({ hash: txHash })

  const handleDeposit = () => {
    if (!depositAmount) return
    const amount = parseEther(depositAmount)
    if (allowance !== undefined && allowance < amount) {
      writeContract({
        address: WETH_ADDRESS,
        abi: abiErc20,
        functionName: 'approve',
        args: [POOL_ADDRESS, amount],
      })
    } else {
      writeContract({
        address: POOL_ADDRESS,
        abi: abiPool,
        functionName: 'depositCollateral',
        args: [amount],
      })
    }
  }

  const handleBorrow = () => {
    if (!borrowAmount) return
    const amount = parseEther(borrowAmount)
    writeContract({
      address: POOL_ADDRESS,
      abi: abiPool,
      functionName: 'borrow',
      args: [amount],
    })
  }

  return (
    <div className="container">
      <header>
        <div className="logo" onClick={onBack} style={{ cursor: 'pointer' }}>Passport DeFi</div>
        {isConnected ? (
          <button className="btn" onClick={() => disconnect()}>Disconnect {address?.slice(0,6)}...{address?.slice(-4)}</button>
        ) : (
          <button className="btn btn-primary" onClick={() => connect({ connector: connectors[0] })}>Connect Wallet</button>
        )}
      </header>

      {txError && (
        <div className="cyber-card" style={{borderColor: 'var(--status-warning)', marginBottom: '1rem'}}>
          <h3 style={{color: 'var(--status-warning)'}}>Transaction Error:</h3>
          <p className="mono-text" style={{fontSize: '0.8rem', color: 'var(--text-secondary)', overflowWrap: 'break-word'}}>{txError.message}</p>
        </div>
      )}

      {isConnected && (
        <>
          <div className="cyber-card">
            <h2>ENS Identity Profile</h2>
            <div className="score-display">
              <span className={`score-value ${score < 70 ? 'low' : ''}`}>
                {isLoadingScore ? '...' : scoreStr || 'N/A'}
              </span>
              <span className="mono-text" style={{ color: 'var(--text-secondary)' }}>Passport Score</span>
              
              <div className="tooltip-container">
                <div className="tooltip-icon">?</div>
                <div className="tooltip-text">
                  Note: This score is read directly from our test-double MockResolver deployed on Sepolia, due to ENSv2 PublicResolver ownership checks blocking off-tree subregistries without a CCIP-read gateway.
                </div>
              </div>
            </div>
            <p className="mono-text" style={{marginTop: '1rem', color: score >= 70 ? 'var(--status-positive)' : 'var(--status-warning)'}}>
              {score >= 70 ? '> STATUS: 150% UNDER-COLLATERALIZED LTV APPROVED' : '> STATUS: STANDARD 80% LTV APPLIED'}
            </p>
          </div>

          <div className="grid-2">
            <div className="cyber-card">
              <h2>Deposit Collateral</h2>
              <div className="stat-row">
                <span className="stat-label">WETH Balance</span>
                <span className="stat-value">{wethBal !== undefined ? (Number(wethBal) / 1e18).toFixed(4) : '0'}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Currently Deposited</span>
                <span className="stat-value">{collateral !== undefined ? (Number(collateral) / 1e18).toFixed(4) : '0'}</span>
              </div>
              
              <div className="input-group" style={{marginTop: '2rem'}}>
                <label>Amount (MockWETH)</label>
                <input type="number" placeholder="0.0" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
              </div>
              {activeChainId !== arcTestnet.id ? (
                <button className="btn" style={{width: '100%', borderColor: 'var(--status-warning)', color: 'var(--status-warning)'}} onClick={() => switchChain({ chainId: arcTestnet.id })}>
                  Switch to Arc Testnet
                </button>
              ) : (
                <button className="btn btn-primary" style={{width: '100%'}} onClick={handleDeposit} disabled={isWaiting || !depositAmount}>
                  {allowance !== undefined && depositAmount && allowance < parseEther(depositAmount || '0') ? 'Approve WETH' : 'Deposit'}
                </button>
              )}
            </div>

            <div className="cyber-card">
              <h2>Borrow Assets</h2>
              <div className="stat-row">
                <span className="stat-label">Currently Borrowed</span>
                <span className="stat-value">{borrowed !== undefined ? (Number(borrowed) / 1e18).toFixed(4) : '0'} MockUSDC</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Max Capacity</span>
                <span className="stat-value">
                  {collateral !== undefined ? (score >= 70 ? (Number(collateral) * 1.5 / 1e18).toFixed(4) : (Number(collateral) * 0.8 / 1e18).toFixed(4)) : '0'}
                </span>
              </div>

              <div className="input-group" style={{marginTop: '2rem'}}>
                <label>Amount (MockUSDC)</label>
                <input type="number" placeholder="0.0" value={borrowAmount} onChange={e => setBorrowAmount(e.target.value)} />
              </div>
              {activeChainId !== arcTestnet.id ? (
                <button className="btn" style={{width: '100%', borderColor: 'var(--status-warning)', color: 'var(--status-warning)'}} onClick={() => switchChain({ chainId: arcTestnet.id })}>
                  Switch to Arc Testnet
                </button>
              ) : (
                <button className="btn" style={{width: '100%', borderColor: 'var(--status-positive)', color: 'var(--status-positive)'}} onClick={handleBorrow} disabled={isWaiting || !borrowAmount}>
                  Execute Borrow
                </button>
              )}
            </div>
          </div>
        </>
      )}
      {!isConnected && (
        <div className="cyber-card" style={{textAlign: 'center', marginTop: '4rem'}}>
          <div className="cyber-badge" style={{marginBottom: '2rem'}}>System Offline</div>
          <h2>Authentication Required</h2>
          <p className="mono-text" style={{color: 'var(--text-secondary)'}}>Connect Web3 Wallet to load ENS Identity and Arc parameters.</p>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <p className="mono-text">Built for ETHOnline 2026</p>
          <p className="mono-text" style={{color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.5rem'}}>
            Powered by The Graph, ENS, and Arc Testnet
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
