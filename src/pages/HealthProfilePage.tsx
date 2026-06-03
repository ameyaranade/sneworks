import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getCachedUid } from '../auth/AuthContext';
import { useToast } from '../shared/components/Toast';
import { getSettings, updateHealthProfile } from '../firebase/settingsQueries';
import DetailPageHeader from '../components/primitives/DetailPageHeader';
import './health-profile-page.css';

export default function HealthProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const uid = user?.uid ?? getCachedUid();

  const [weightKg, setWeightKg] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    getSettings(uid).then((s) => {
      if (s.healthWeightKg) setWeightKg(String(s.healthWeightKg));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [uid]);

  const handleSave = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      await updateHealthProfile(uid, {
        healthWeightKg: weightKg ? Number(weightKg) : null,
      });
      showToast('Health profile saved', 'success');
      navigate('/health');
    } catch {
      showToast('Could not save. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sn-hprof-page">
      <DetailPageHeader onBack={() => navigate('/health')} title="Health Profile" />

      {!loading && (
        <div className="sn-hprof-form">

          <div className="sn-hprof-field">
            <label className="sn-hprof-label" htmlFor="hp-weight">Body weight</label>
            <div className="sn-hprof-input-wrap">
              <input
                id="hp-weight"
                type="number"
                className="sn-hprof-input"
                placeholder="70"
                min={20}
                max={300}
                step={0.5}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                autoFocus
              />
              <span className="sn-hprof-unit">kg</span>
            </div>
          </div>

          <p className="sn-hprof-hint">
            Used to estimate calories burned during workouts. Updated automatically
            whenever you log a workout with a different weight.
          </p>

          <div className="sn-hprof-actions">
            <button
              type="button"
              className="sn-sheet-cancel-btn"
              onClick={() => navigate('/health')}
            >
              Cancel
            </button>
            <button
              type="button"
              className="sn-sheet-save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
