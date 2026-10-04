import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Copy, Inbox } from 'lucide-react';

import { initials } from '../lib/format';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, loading, icon, className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  const classes = ['btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', !children && 'btn-icon', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spinner" aria-hidden /> : icon}
      {children}
    </button>
  );
});

interface FieldProps {
  label?: string;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, htmlFor, children }: FieldProps) {
  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  invalid?: boolean;
  action?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ icon, invalid, action, className = '', ...rest }, ref) {
  const input = <input ref={ref} className={`input ${invalid ? 'invalid' : ''} ${className}`} aria-invalid={invalid || undefined} {...rest} />;
  if (!icon && !action) return input;
  return (
    <div className="input-group">
      {icon && <span className="input-icon">{icon}</span>}
      {input}
      {action && <span className="input-action">{action}</span>}
    </div>
  );
});

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`select ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function CardHeader({ title, subtitle, action, bordered }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; bordered?: boolean }) {
  return (
    <div className={`card-header ${bordered ? 'bordered' : ''}`}>
      <div>
        <h2 className="card-title">{title}</h2>
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type BadgeTone = 'success' | 'warning' | 'danger' | 'primary' | 'info' | 'neutral';

export function Badge({ tone = 'neutral', dot = true, children }: { tone?: BadgeTone; dot?: boolean; children: ReactNode }) {
  return <span className={`badge ${tone !== 'neutral' ? `badge-${tone}` : ''} ${dot ? '' : 'no-dot'}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone: BadgeTone = status === 'ACTIVE' || status === 'COMPLETED' ? 'success' : status === 'FROZEN' ? 'info' : status === 'CLOSED' ? 'neutral' : 'warning';
  return <Badge tone={tone}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

export function Alert({ tone = 'danger', children }: { tone?: 'danger' | 'info' | 'success' | 'warning'; children: ReactNode }) {
  return (
    <div className={`alert ${tone !== 'danger' ? `alert-${tone}` : ''}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <AlertCircle aria-hidden />
      <div>{children}</div>
    </div>
  );
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #a855f7)',
  'linear-gradient(135deg, #10b981, #0ea5e9)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #ec4899, #8b5cf6)',
  'linear-gradient(135deg, #0ea5e9, #6366f1)',
  'linear-gradient(135deg, #14b8a6, #84cc16)',
];

export function Avatar({ name, size }: { name?: string | null; size?: 'sm' | 'lg' }) {
  const seed = [...(name ?? '')].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (
    <span className={`avatar ${size ? `avatar-${size}` : ''}`} style={{ background: AVATAR_GRADIENTS[seed % AVATAR_GRADIENTS.length] }} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function Skeleton({ width, height = 16, radius }: { width?: number | string; height?: number | string; radius?: number }) {
  return <span className="skeleton" style={{ display: 'block', width: width ?? '100%', height, borderRadius: radius }} aria-hidden />;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon ?? <Inbox />}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  full,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  full?: boolean;
  label: string;
}) {
  return (
    <div className={`segmented ${full ? 'full' : ''}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, totalPages, total, onPage, noun = 'results' }: { page: number; totalPages: number; total: number; onPage: (page: number) => void; noun?: string }) {
  return (
    <div className="pagination">
      <span>
        {total.toLocaleString()} {noun} · Page {page} of {totalPages}
      </span>
      <div className="row" style={{ gap: 6 }}>
        <Button variant="secondary" size="sm" icon={<ChevronLeft />} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" />
        <Button variant="secondary" size="sm" icon={<ChevronRight />} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page" />
      </div>
    </div>
  );
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; nothing else to do.
    }
  };

  return (
    <Button variant="ghost" size="sm" icon={copied ? <Check /> : <Copy />} onClick={copy} aria-label={copied ? 'Copied' : label} title={copied ? 'Copied' : label} />
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="page-header">
      <div className="grow">
        {back}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  );
}

/** Lightweight dropdown menu that closes on outside click and Escape. */
export function Menu({ trigger, children }: { trigger: (props: { onClick: () => void; 'aria-expanded': boolean }) => ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      {trigger({ onClick: () => setOpen((value) => !value), 'aria-expanded': open })}
      {open && (
        <div className="menu-list" role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
