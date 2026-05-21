import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', paddingTop: 64 }}>
      <h1 style={{ fontSize: 72, margin: 0 }}>404</h1>
      <p style={{ fontSize: 18, color: '#666' }}>Page not found.</p>
      <Link to="/" style={{ color: '#0066cc' }}>Go home</Link>
    </div>
  );
}
