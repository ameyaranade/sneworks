import './now-line.css';

export default function NowLine() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div className="lg-now-line" aria-label={`Now: ${timeStr}`}>
      <span className="lg-now-label">{timeStr}</span>
      <div className="lg-now-bar" />
    </div>
  );
}
