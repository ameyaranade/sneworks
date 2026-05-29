/**
 * MigrationRunner.tsx
 *
 * Temporary React component to run the Firestore collection migration
 * for the currently logged-in user. Add this as a route in App.tsx (e.g. /migrate),
 * run it once, then remove it.
 *
 * Usage in App.tsx (temporary):
 *   const MigrationRunner = lazy(() => import('./scripts/MigrationRunner'));
 *   <Route path="/migrate" element={<ProtectedRoute><MigrationRunner /></ProtectedRoute>} />
 */

import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthContext';
import {
  migrateCollections,
  checkMigrationNeeded,
  type MigrationResult,
} from './migrateFirebaseCollections';

export default function MigrationRunner() {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkMigrationNeeded(db, user.uid).then(({ needed, counts: c }) => {
      setMigrationNeeded(needed);
      setCounts(c);
      setChecking(false);
    });
  }, [user]);

  function appendLog(msg: string) {
    setLogs((prev) => [...prev, msg]);
  }

  async function runMigration() {
    if (!user || !confirmed) return;
    setRunning(true);
    setLogs([]);
    const res = await migrateCollections(db, user.uid, appendLog, true);
    setResult(res);
    setRunning(false);
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: 600,
    margin: '2rem auto',
    padding: '1.5rem',
    fontFamily: 'system-ui, sans-serif',
    background: '#1a1a1a',
    color: '#e0e0e0',
    borderRadius: 12,
  };

  const headingStyle: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginBottom: 12 };
  const labelStyle: React.CSSProperties = { fontSize: 13, color: '#888' };
  const countStyle: React.CSSProperties = { fontWeight: 600, color: '#fff' };
  const logBoxStyle: React.CSSProperties = {
    background: '#111',
    border: '1px solid #333',
    borderRadius: 8,
    padding: '0.75rem 1rem',
    fontFamily: 'monospace',
    fontSize: 12,
    maxHeight: 240,
    overflowY: 'auto',
    marginTop: 12,
    lineHeight: 1.6,
  };
  const btnStyle = (disabled: boolean, danger = false): React.CSSProperties => ({
    display: 'inline-block',
    marginTop: 16,
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    background: disabled ? '#444' : danger ? '#c0392b' : '#2980b9',
    color: disabled ? '#888' : '#fff',
    fontWeight: 600,
    fontSize: 14,
    cursor: disabled ? 'not-allowed' : 'pointer',
  });

  if (!user) return <div style={containerStyle}>Not logged in.</div>;

  if (checking) return <div style={containerStyle}>Checking Firestore...</div>;

  return (
    <div style={containerStyle}>
      <div style={headingStyle}>Firestore Collection Migration</div>

      {!migrationNeeded ? (
        <div style={{ color: '#27ae60', fontWeight: 600 }}>
          No migration needed — old sandbox_ collections are empty.
        </div>
      ) : (
        <>
          <p style={{ fontSize: 14, color: '#aaa', marginBottom: 12 }}>
            This tool copies data from the old <code>sandbox_*</code> Firestore collections to
            the new renamed collections, then deletes the originals.
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingBottom: 6, color: '#888', fontWeight: 400 }}>Collection</th>
                <th style={{ textAlign: 'right', paddingBottom: 6, color: '#888', fontWeight: 400 }}>Docs</th>
              </tr>
            </thead>
            <tbody>
              {['sandbox_todos', 'sandbox_logs', 'sandbox_groups'].map((col) => (
                <tr key={col} style={{ borderTop: '1px solid #333' }}>
                  <td style={{ padding: '6px 0', ...labelStyle }}>{col} → {col.replace('sandbox_', '')}</td>
                  <td style={{ textAlign: 'right', ...countStyle }}>{counts[col] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {result ? (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: result.success ? '#1a3a1a' : '#3a1a1a',
                color: result.success ? '#2ecc71' : '#e74c3c',
                fontWeight: 600,
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              {result.success
                ? 'Migration completed successfully!'
                : `Migration failed: ${result.error}`}
            </div>
          ) : (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I understand this will delete the old sandbox_ collections after copying.
              </label>

              <button
                style={btnStyle(!confirmed || running, true)}
                disabled={!confirmed || running}
                onClick={runMigration}
              >
                {running ? 'Running...' : 'Run Migration'}
              </button>
            </>
          )}

          {logs.length > 0 && (
            <div style={logBoxStyle}>
              {logs.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
