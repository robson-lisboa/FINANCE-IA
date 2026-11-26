export type MovementKind = "income" | "expense";
export function classifyStatementMovement(line: string, amountEndIndex: number): MovementKind;
export function isStatementSummaryLine(line: string): boolean;
export type BankAccountSummary = {
  openingBalance: number;
  credits: number;
  debits: number;
  closingBalance: number;
  expectedClosing: number;
  difference: number;
};
export function extractBankAccountSummary(text: string): BankAccountSummary | null;

export function normalizeStatementDescription(value: string): string;
export function isPotentialTransferMovement(value: string): boolean;

export type StatementRowKeyInput = { title: string; date: string; amount: number; type: "income" | "expense" };
export function buildStatementTransactionKey(row: StatementRowKeyInput): string;
export function filterNewStatementRows<T extends StatementRowKeyInput>(rows: T[], existingRows: StatementRowKeyInput[]): T[];
