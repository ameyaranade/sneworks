import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { TemplateItem, HealthLog } from '../../types';
import { INTENSITY_COLORS } from '../../constants/health';
import ActivityIcon from './ActivityIcon';
import IntensityDot from './IntensityDot';

interface WorkoutCardProps {
  item: TemplateItem;
  templateIdx: number;
  routineId: string;
  todayLog?: HealthLog;
  onLog: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="sn-wc-stat">
      <span className="sn-wc-stat-label">{label}</span>
      <span className="sn-wc-stat-value">{value}</span>
    </div>
  );
}

export default function WorkoutCard({ item, todayLog, onLog }: WorkoutCardProps) {
  const [expanded, setExpanded] = useState(false);
  const wt = item.workoutType ?? 'Other';
  const intensity = item.targetIntensity;
  const ic = intensity ? INTENSITY_COLORS[intensity] : null;
  const logged = !!todayLog;

  const targetMeta = [
    item.targetDurationMin ? `${item.targetDurationMin} min` : null,
    intensity ?? null,
    item.targetDistanceValue
      ? `${item.targetDistanceValue} ${item.targetDistanceUnit ?? 'km'}`
      : null,
    item.targetSets && item.targetReps
      ? `${item.targetSets}×${item.targetReps}`
      : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className={`sn-wc${logged ? ' sn-wc--logged' : ''}`}>
      <div className="sn-wc-header">
        <span className={`sn-wc-icon${logged ? ' sn-wc-icon--logged' : ''}`}>
          <ActivityIcon type={wt} size={18} />
        </span>
        <div className="sn-wc-info" onClick={() => setExpanded((e) => !e)}>
          <span className="sn-wc-name">{item.title || wt}</span>
          {targetMeta && (
            <span className="sn-wc-meta">
              {intensity && <IntensityDot intensity={intensity} size={6} />}
              {' '}{targetMeta}
            </span>
          )}
        </div>
        {logged && <span className="sn-wc-done-badge">Done</span>}
        <button
          type="button"
          className={`sn-wc-log-btn${logged ? ' sn-wc-log-btn--logged' : ''}`}
          onClick={onLog}
        >
          {logged ? 'Edit' : 'Log →'}
        </button>
        <button
          type="button"
          className="sn-wc-expand-btn"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="sn-wc-body">
          <div className="sn-wc-section-label">TARGET</div>
          <div className="sn-wc-stats-row">
            {item.targetDurationMin && <Stat label="Duration" value={`${item.targetDurationMin} min`} />}
            {intensity && (
              <div className="sn-wc-stat">
                <span className="sn-wc-stat-label">Intensity</span>
                <span className="sn-wc-stat-value" style={ic ? { color: ic.text } : {}}>
                  {intensity}
                </span>
              </div>
            )}
            {item.targetDistanceValue && (
              <Stat label="Distance" value={`${item.targetDistanceValue} ${item.targetDistanceUnit ?? 'km'}`} />
            )}
            {item.targetSets && item.targetReps && (
              <Stat label="Sets × Reps" value={`${item.targetSets} × ${item.targetReps}`} />
            )}
          </div>

          {todayLog && (
            <>
              <div className="sn-wc-section-label" style={{ marginTop: 10 }}>LOGGED</div>
              <div className="sn-wc-stats-row">
                {todayLog.durationMin && <Stat label="Duration" value={`${todayLog.durationMin} min`} />}
                {todayLog.intensity && (
                  <div className="sn-wc-stat">
                    <span className="sn-wc-stat-label">Intensity</span>
                    <span className="sn-wc-stat-value" style={{ color: INTENSITY_COLORS[todayLog.intensity].text }}>
                      {todayLog.intensity}
                    </span>
                  </div>
                )}
                {todayLog.caloriesBurned && <Stat label="Calories" value={`${todayLog.caloriesBurned} kcal`} />}
                {todayLog.distanceValue && (
                  <Stat label="Distance" value={`${todayLog.distanceValue} ${todayLog.distanceUnit ?? 'km'}`} />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
