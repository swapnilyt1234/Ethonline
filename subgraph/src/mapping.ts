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
