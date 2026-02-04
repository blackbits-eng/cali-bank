
export type TransactionType = 'CREDIT' | 'DEBIT';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  concept: string;
  timestamp: number;
}

export interface Loan {
  amount: number;
  timestamp: number;
  targetGoal: number; // 1000, 2000, or 3000
  isActive: boolean;
}

export interface Student {
  id: string;
  name: string;
  balance: number;
  transactions: Transaction[];
  qrCode: string;
  avatar: string;
  lastAttendance?: number;
  activeLoan?: Loan;
}

export enum UserMode {
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  NONE = 'NONE'
}
