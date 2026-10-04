import { badRequest } from './errors.js';

/**
 * Money is handled as integer cents in JavaScript and as NUMERIC(18,2) in
 * PostgreSQL, so balances never pick up floating-point rounding errors.
 */

export const MAX_TRANSACTION_CENTS = 1_000_000_00;

const AMOUNT_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

/** Validates user input such as "250", "250.5" or "250.50" and returns cents. */
export function parseAmount(raw: string | number): number {
  const value = String(raw).trim();
  if (!AMOUNT_PATTERN.test(value)) {
    throw badRequest('Enter a valid amount with at most 2 decimal places');
  }

  const cents = toCents(value);
  if (cents <= 0) {
    throw badRequest('Amount must be greater than zero');
  }
  if (cents > MAX_TRANSACTION_CENTS) {
    throw badRequest('Amount exceeds the per-transaction limit of 1,000,000.00');
  }
  return cents;
}

/** Converts a NUMERIC string from PostgreSQL ("1234.5", "-3.07") to cents. */
export function toCents(value: string): number {
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = value.replace('-', '').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
  return negative ? -cents : cents;
}

/** Formats cents as a NUMERIC-compatible string, e.g. 123456 -> "1234.56". */
export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
