import './page-skeleton.css';

export default function PageSkeleton() {
  return (
    <div className="sn-pg-skeleton">
      {/* section 1: rows (todo-row height) */}
      <div className="sn-pg-sk-label sn-pg-sk-shimmer" style={{ width: 80 }} />
      <div className="sn-pg-sk-row sn-pg-sk-shimmer" />
      <div className="sn-pg-sk-row sn-pg-sk-shimmer" style={{ animationDelay: '0.15s' }} />
      <div className="sn-pg-sk-row sn-pg-sk-shimmer" style={{ animationDelay: '0.3s' }} />

      {/* section 2: taller cards (health routines / projects) */}
      <div className="sn-pg-sk-label sn-pg-sk-shimmer" style={{ width: 100, marginTop: 14 }} />
      <div className="sn-pg-sk-card sn-pg-sk-shimmer" style={{ animationDelay: '0.1s' }} />
      <div className="sn-pg-sk-card sn-pg-sk-shimmer" style={{ animationDelay: '0.25s' }} />

      {/* section 3: single row */}
      <div className="sn-pg-sk-label sn-pg-sk-shimmer" style={{ width: 64, marginTop: 14 }} />
      <div className="sn-pg-sk-row sn-pg-sk-shimmer" style={{ animationDelay: '0.2s' }} />
    </div>
  );
}
