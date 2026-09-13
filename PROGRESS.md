# Passport - Hackathon Progress Log

## Phase 0 — Environment & Fact-Finding
**Goal:** Establish ground truth before writing anything.
**Outcome:** Arc Testnet (5042002) confirmed. RPC and Explorer verified.

## Phase 1 — PassportLendingPool Contract (Arc testnet)
**Goal:** A minimal lending pool contract.
**Outcome:** Deployed V1 Pool. Executed manual loans and repayments to trigger Subgraph indexing.

## Phase 2 — Subgraph (The Graph)
**Goal:** Index pool events and compute score.
**Outcome:** Deployed to Subgraph Studio. Computes `(totalRepaid * 100) / totalRequested`.

## Phase 3 - ENS Subname Identity Layer
**Goal:** On-chain identity on Sepolia.
**Outcome:** Deployed `UserRegistry` for `getpassport.eth`.
**ENSv2 Limitation Disclosure (Scenario B):**
Due to an architectural limitation in the ENSv2 beta, standard PublicResolverV2 (0xe7b9a25607e02da8145e4eb1836ca539e53f11f7) reverts during setAddr and setText for off-tree subnames. 
**Exact Revert Cause:** PublicResolverV2.isAuthorized internally calls owner(node) on the global ENSRegistry. Because our UserRegistry tracks ownership of subnames off-tree, the global ENSRegistry returns address(0) for the subname, causing PublicResolverV2 to instantly revert.
**Workaround:** We deployed a test-double MockResolver at 0xd9d71897e418f22035a7bebf58a4c7ea201ddaa0 to store our text records directly. Our frontend reads from this test double. 
**Production Fix:** To fix this in production, one must deploy a custom resolver that overrides isAuthorized to query our UserRegistry for ownership, or utilize an L2 CCIP-read gateway.

## Phase 4 - Under-Collateralized Lending Pool V2
**Goal:** Dynamic LTV based on ENS score.
**Outcome:** Deployed MockWETH, MockUSDC, and V2 Pool to Arc Testnet. 150% LTV unlocked for scores >= 70. Built a Push Oracle script to bridge score from Sepolia to Arc.

## Phase 5 - Frontend Dashboard
**Goal:** User-facing application.
**Outcome:** Built a Vite/React application with viem/wagmi and Vanilla CSS (Dark mode, glassmorphism). Implemented dashboard showing ENS score (with disclosure tooltip) and Borrowing Panel.

## Phase 6 - Agent Demo
**Goal:** Autonomous AI Agent.
**Outcome:** `agent.js` successfully queries The Graph and ENS, then executes a leveraged, under-collateralized borrowing strategy on Arc Testnet for users with healthy scores.

## Phase 7 - Submission Packaging
**Goal:** Finalize repo for ETHOnline.
**Outcome:** `README.md` formatted for judges with verified contract addresses and explicit workaround disclosures. WebP browser recording created.
