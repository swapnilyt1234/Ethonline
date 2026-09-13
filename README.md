# Passport: Decentralized Reputation & Under-Collateralized Lending

Passport is a fully decentralized pipeline that computes a user's on-chain lending reputation, publishes it to ENS, and leverages it to offer under-collateralized loans on Arc Testnet. 

This project was built for the ETHOnline hackathon, targeting three specific sponsor tracks: **The Graph, ENS, and Arc**.

---

## 🏗️ Architecture & Sponsor Tracks

### 1. The Graph (On-Chain Indexing & Score Calculation)
We deployed a subgraph to The Graph Studio that indexes the `PassportLendingPool` events. It automatically computes a dynamic **Passport Score** (0-100) based on the user's ratio of total repaid to total requested loans, explicitly penalizing defaults.
- **Subgraph API:** `https://api.studio.thegraph.com/query/1760204/eth-online/0.1.0`

### 2. ENS Identity Layer (Sepolia)
We utilize ENSv2 on Sepolia to attach the computed reputation score to a user's human-readable identity (e.g., `score-[address].getpassport.eth`). A keeper script bridges the gap between the Subgraph and ENS.
- **Parent Name:** `getpassport.eth`
- **Subregistry Address:** `0x8fd80a39346d3c66e3a1ed6b8df206ed6de853e8`

> [!WARNING]
> **ENSv2 Limitation Disclosure (Scenario B):** 
> Due to an architectural limitation in the ENSv2 beta, the standard `PublicResolverV2` (`0xe7b9a25607e02da8145e4eb1836ca539e53f11f7`) reverts during `setAddr` and `setText` for off-tree subnames. 
> 
> **Exact Revert Cause:** `PublicResolverV2.isAuthorized` internally calls `owner(node)` on the global `ENSRegistry`. Because our `UserRegistry` tracks ownership of subnames *off-tree*, the global `ENSRegistry` returns `address(0)` for the subname, causing `PublicResolverV2` to instantly revert.
> 
> **Hackathon Workaround:** We deployed a test-double **MockResolver** at `0xd9d71897e418f22035a7bebf58a4c7ea201ddaa0` to store our text records directly. Our Oracle and Frontend read from this test double. 
> 
> **Production Fix:** To fix this in production, one must deploy a custom resolver that overrides `isAuthorized` to query our `UserRegistry` for ownership, or utilize an L2 CCIP-read gateway.

### 3. Arc Testnet (DeFi Lending)
The core lending protocol is deployed on Arc Testnet. The `PassportLendingPool` applies dynamic LTV (Loan-to-Value) terms based on the user's ENS score bridged from Sepolia.
- Users with `score >= 70` unlock **150% LTV** (Under-collateralized borrowing).
- Users with `score < 70` receive standard **80% LTV**.
- **Lending Pool Address:** `0x0B92843e606C0D42132c23c688B7238CEa6FDeb7`
- **MockWETH (Collateral):** `0xCe0FF6442916970ff33C927b115bD14808A2DDb8`
- **MockUSDC (Borrow Asset):** `0xC29cBa19A1e97D86969e178fDaAb6C48184DCf77`

---

## 🤖 AI Agent Demo (Agent-Readable Score)
To demonstrate the composability of our architecture, we built an autonomous AI agent (`agent.js`). The agent:
1. Queries **The Graph** to fetch the user's on-chain lending history.
2. Verifies the score against the user's **ENS Identity** on Sepolia.
3. Automatically executes a leveraged, under-collateralized borrow strategy on **Arc Testnet** if the score is healthy (`>= 70`).

## 💻 Frontend Dashboard
A premium Vite/React frontend allowing users to connect their wallet, view their live ENS Passport Score (with explicit disclosure tooltips), and deposit/borrow on the Arc Testnet pool.

### How to run locally:
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:5173`.

### Demo

![Frontend Demo Recording](/C:/Users/swapn/.gemini/antigravity-ide/brain/493056fa-91a5-46ee-ac94-eebe7e709a3d/frontend_dashboard_demo_1789229730516.webp)

![Landing Page Screenshot](/C:/Users/swapn/.gemini/antigravity-ide/brain/493056fa-91a5-46ee-ac94-eebe7e709a3d/dashboard_landing_1789229860174.png)

