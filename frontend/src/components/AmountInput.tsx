import { currencySymbol } from '../lib/format';
import type { Currency } from '../lib/types';

/** Keeps only digits and one dot with at most two decimals, e.g. "1,250.509" -> "1250.50". */
export function sanitizeAmount(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  const fraction = rest.join('').slice(0, 2);
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '').slice(0, 9);
  return cleaned.includes('.') ? `${normalizedWhole || '0'}.${fraction}` : normalizedWhole;
}

export const isPositiveAmount = (value: string) => Number.parseFloat(value) > 0;

interface AmountInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  currency: Currency;
  autoFocus?: boolean;
  invalid?: boolean;
}

export function AmountInput({ id, value, onChange, currency, autoFocus, invalid }: AmountInputProps) {
  return (
    <div className="amount-input" style={invalid ? { borderColor: 'var(--danger)' } : undefined}>
      <span className="symbol" aria-hidden>
        {currencySymbol(currency)}
      </span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(sanitizeAmount(event.target.value))}
        aria-label={`Amount in ${currency}`}
      />
      <span className="code">{currency}</span>
    </div>
  );
}

export function QuickAmounts({ onPick, currency }: { onPick: (value: string) => void; currency: Currency }) {
  const amounts = currency === 'AMD' ? ['5000', '10000', '50000', '100000'] : ['20', '50', '100', '500'];
  return (
    <div className="chips">
      {amounts.map((amount) => (
        <button key={amount} type="button" className="chip" onClick={() => onPick(amount)}>
          {currencySymbol(currency)}
          {Number(amount).toLocaleString()}
        </button>
      ))}
    </div>
  );
}
