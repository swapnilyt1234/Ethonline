# Passport - Project Handoff & Summary

This document summarizes the entire state of the "Passport" hackathon project as of the end of Phase 4. It is designed to allow a new developer (or AI session) to seamlessly pick up where we left off.

## 🚀 Accomplished Phases

### Phase 0: Environment & Fact-Finding
- **Network Identified:** Arc Testnet (Chain ID `5042002`). Native gas token is USDC (6 decimals). 
- **RPC:** `https://rpc.testnet.arc.network`
- **Explorer:** `https://testnet.arcscan.app`

### Phase 1: V1 Lending Pool (Arc Testnet)
- **Goal:** Establish a baseline loan contract.
- **Outcome:** We wrote and deployed the first `PassportLendingPool.sol` (address `0x508dE72772F7fFC3Df52164Db3B149EED3718a20`) that allowed requesting and repaying native USDC loans.

### Phase 2: The Graph Integration
- **Goal:** Index on-chain behavior to calculate an off-chain reputation score.
- **Outcome:** We deployed a subgraph to The Graph Studio. It listens to the V1 pool's events and computes a dynamic score for each borrower based on the formula: `(totalRepaid * 100) / totalRequested`. Penalties are applied for defaults.

### Phase 3: ENS Identity Layer (Sepolia)
- **Goal:** Push the calculated reputation score to an on-chain identity record via ENSv2.
- **Outcome:** 
  - Deployed `UserRegistry` (an off-tree subregistry) for our parent name `getpassport.eth`.
  - Built `keeper.js` which polls the Subgraph and syncs the score to ENS.
  - **Important Architectural Disclosure:** Because `PublicResolverV2` hardcodes an ownership check against the global `ENSRegistry` (which reverts for off-tree subnames), we deployed a test-double `MockResolver` (`0xd9d71897e418f22035a7bebf58a4c7ea201ddaa0`) to store text records for the hackathon. A production fix would require a custom resolver or a CCIP-read gateway.

### Phase 4: Under-Collateralized Lending Pool V2 (Arc Testnet)
- **Goal:** Use the ENS reputation score to offer better lending terms.
- **Outcome:** 
  - Deployed `MockWETH` (Collateral) and `MockUSDC` (Borrow asset) to Arc Testnet.
  - Deployed the V2 `PassportLendingPool.sol` (`0x0B92843e606C0D42132c23c688B7238CEa6FDeb7`) to Arc Testnet. 
  - Implemented logic where `score > 70` unlocks a 150% LTV (under-collateralized loan), while standard users get 80% LTV.
  - Built `oracle.js`, a push-oracle script that bridges the gap by reading the ENS `passport.score` text record from Sepolia and writing it directly to the V2 pool on Arc Testnet via an `updateScore()` transaction.

---

## 🚧 What is Yet to be Done (Next Phases)

When you resume with a new account, you can start tackling the following areas:

1. **Frontend / UI Integration:**
   - We currently have a fully functional smart contract and backend pipeline, but no user-facing UI.
   - **Task:** Build a Next.js / Vite web app using `wagmi` / `viem`. 
   - **Features Needed:** A dashboard for users to view their Passport Score (pulled from ENS), deposit collateral, and take out under-collateralized loans on Arc Testnet.

2. **Yield Integration (Phase 4 Extension):**
   - The Phase 4 title was "Under-Collateralized Lending Pool with Yield". While we implemented the LTV logic successfully, we haven't yet plugged the pool's idle collateral into a yield-generating protocol (like Aave or an ERC4626 vault). 
   - **Task:** Upgrade the V2 Lending Pool to automatically stake deposited `MockWETH` into a yield vault to generate interest for liquidity providers.

3. **Production ENS CCIP-Read Setup:**
   - If you wish to replace the `MockResolver` test-double with a fully production-ready ENSv2 architecture before submission.
   - **Task:** Implement an off-chain CCIP-read gateway (ENSIP-10) and configure the `UserRegistry` to route queries correctly, bypassing the `PublicResolverV2` limitation entirely.

---

## 🔑 Key Addresses & Variables to Remember

- **Agent Wallet used for testing:** `0xD9126aAe4415afb07694f118018eA1eD7b2ABCEe`
- **Private Key (stored in `.env`):** `0x3a8e7e280722cb790e5f6c07a02f8687cdc3421841b7753e3cfce20d015c4011`
- **V2 Lending Pool (Arc):** `0x0B92843e606C0D42132c23c688B7238CEa6FDeb7`
- **MockWETH (Arc):** `0xCe0FF6442916970ff33C927b115bD14808A2DDb8`
- **MockUSDC (Arc):** `0xC29cBa19A1e97D86969e178fDaAb6C48184DCf77`
- **MockResolver (Sepolia):** `0xd9d71897e418f22035a7bebf58a4c7ea201ddaa0`
- **Subgraph API:** `https://api.studio.thegraph.com/query/1760204/eth-online/0.1.0`
