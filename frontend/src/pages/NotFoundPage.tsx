import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="not-found">
      <div className="stack" style={{ alignItems: 'center' }}>
        <h1 className="gradient-text">404</h1>
        <h2>This page doesn’t exist</h2>
        <p className="muted">The link may be broken, or the page may have moved.</p>
        <Link to="/" className="btn btn-primary">
          Back to home
        </Link>
      </div>
    </div>
  );
}
