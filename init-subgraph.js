const fs = require('fs');
const path = require('path');

const contractJsonPath = path.join(__dirname, 'contracts', 'out', 'PassportLendingPool.sol', 'PassportLendingPool.json');
const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));
const abi = contractJson.abi;

const subgraphDir = path.join(__dirname, 'subgraph');
if (!fs.existsSync(subgraphDir)) {
    fs.mkdirSync(subgraphDir);
    fs.mkdirSync(path.join(subgraphDir, 'src'));
    fs.mkdirSync(path.join(subgraphDir, 'abis'));
}

fs.writeFileSync(path.join(subgraphDir, 'abis', 'PassportLendingPool.json'), JSON.stringify(abi, null, 2));

const packageJson = {
  "name": "eth-online",
  "version": "0.1.0",
  "scripts": {
    "codegen": "graph codegen",
    "build": "graph build",
    "deploy": "graph deploy --studio eth-online",
    "auth": "graph auth --studio a1ca1915419f3ceb04fad307bba49bb8"
  },
  "dependencies": {
    "@graphprotocol/graph-cli": "0.38.2",
    "@graphprotocol/graph-ts": "0.38.2"
  }
};
fs.writeFileSync(path.join(subgraphDir, 'package.json'), JSON.stringify(packageJson, null, 2));

const subgraphYaml = `
specVersion: 1.0.0
indexerHints:
  prune: auto
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: PassportLendingPool
    network: mainnet
    source:
      address: "0x508dE72772F7fFC3Df52164Db3B149EED3718a20"
      abi: PassportLendingPool
      startBlock: 61720391
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Borrower
        - Loan
      abis:
        - name: PassportLendingPool
          file: ./abis/PassportLendingPool.json
      eventHandlers:
        - event: LoanRequested(indexed address,indexed uint256,uint256,uint256)
          handler: handleLoanRequested
        - event: LoanRepaid(indexed address,indexed uint256)
          handler: handleLoanRepaid
        - event: LoanDefaulted(indexed address,indexed uint256)
          handler: handleLoanDefaulted
      file: ./src/mapping.ts
`;
fs.writeFileSync(path.join(subgraphDir, 'subgraph.yaml'), subgraphYaml.trim());

const schemaGraphql = `
type Borrower @entity {
  id: Bytes!
  totalRequested: Int!
  totalRepaid: Int!
  totalDefaulted: Int!
  score: Int!
  loans: [Loan!]! @derivedFrom(field: "borrower")
}

type Loan @entity {
  id: ID!
  borrower: Borrower!
  loanId: BigInt!
  amount: BigInt!
  repayAmount: BigInt!
  status: String!
}
`;
fs.writeFileSync(path.join(subgraphDir, 'schema.graphql'), schemaGraphql.trim());

const mappingTs = \`
import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  LoanRequested,
  LoanRepaid,
  LoanDefaulted
} from "../generated/PassportLendingPool/PassportLendingPool"
import { Borrower, Loan } from "../generated/schema"

function getOrCreateBorrower(id: Bytes): Borrower {
  let borrower = Borrower.load(id)
  if (borrower == null) {
    borrower = new Borrower(id)
    borrower.totalRequested = 0
    borrower.totalRepaid = 0
    borrower.totalDefaulted = 0
    borrower.score = 0
  }
  return borrower
}

function updateScore(borrower: Borrower): void {
  if (borrower.totalRequested == 0) {
    borrower.score = 0
    return
  }
  
  let score = (borrower.totalRepaid * 100) / borrower.totalRequested
  score = score - (borrower.totalDefaulted * 50)
  
  if (score < 0) {
    borrower.score = 0
  } else {
    borrower.score = score as i32
  }
}

export function handleLoanRequested(event: LoanRequested): void {
  let borrower = getOrCreateBorrower(event.params.borrower)
  borrower.totalRequested += 1
  updateScore(borrower)
  borrower.save()

  let loan = new Loan(event.params.borrower.toHex() + "-" + event.params.loanId.toString())
  loan.borrower = borrower.id
  loan.loanId = event.params.loanId
  loan.amount = event.params.amount
  loan.repayAmount = event.params.repayAmount
  loan.status = "REQUESTED"
  loan.save()
}

export function handleLoanRepaid(event: LoanRepaid): void {
  let borrower = getOrCreateBorrower(event.params.borrower)
  borrower.totalRepaid += 1
  updateScore(borrower)
  borrower.save()

  let loan = Loan.load(event.params.borrower.toHex() + "-" + event.params.loanId.toString())
  if (loan != null) {
    loan.status = "REPAID"
    loan.save()
  }
}

export function handleLoanDefaulted(event: LoanDefaulted): void {
  let borrower = getOrCreateBorrower(event.params.borrower)
  borrower.totalDefaulted += 1
  updateScore(borrower)
  borrower.save()

  let loan = Loan.load(event.params.borrower.toHex() + "-" + event.params.loanId.toString())
  if (loan != null) {
    loan.status = "DEFAULTED"
    loan.save()
  }
}
\`
fs.writeFileSync(path.join(subgraphDir, 'src', 'mapping.ts'), mappingTs.trim());

console.log("Subgraph scaffolded successfully.");
