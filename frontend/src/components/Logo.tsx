import { Link } from 'react-router-dom';

export function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M8 5v13h8" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16.5" cy="7.5" r="2.2" fill="#a5f3fc" />
      </svg>
    </span>
  );
}

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="logo" aria-label="Ledgerly home">
      <LogoMark />
      <span className="logo-text">Ledgerly</span>
    </Link>
  );
}
