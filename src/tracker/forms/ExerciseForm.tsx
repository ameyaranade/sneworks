import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { addActivity, updateActivity } from '../firebase/trackerQueries';
import { MOOD_OPTIONS } from '../constants';
import MoodSvg from '../components/MoodSvg';
import { formatDate } from '../utils';
import type { Mood, ExerciseActivity } from '../types';
import './form-shared.css';

interface ExerciseFormProps {
  onSaved: () => void;
  initialValues?: ExerciseActivity;
  entryId?: string;
}

export default function ExerciseForm({ onSaved, initialValues, entryId }: ExerciseFormProps) {
  const { user } = useAuth();
  const [didWorkout, setDidWorkout] = useState<boolean | null>(initialValues?.workout.completed ?? null);
  const [duration, setDuration] = useState(initialValues?.workout.durationMinutes ? String(initialValues.workout.durationMinutes) : '');
  const [workoutType, setWorkoutType] = useState(initialValues?.workout.workoutType ?? '');
  const [weight, setWeight] = useState(initialValues?.health?.weightKg ? String(initialValues.health.weightKg) : '');
  const [mood, setMood] = useState<Mood | null>(initialValues?.health?.mood ?? null);
  const [date, setDate] = useState(initialValues?.date ?? formatDate(new Date()));
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const canSave = didWorkout !== null || weight || mood !== null;

  const handleSubmit = async () => {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      const payload = {
        workout: {
          completed: didWorkout ?? false,
          ...(duration ? { durationMinutes: Number(duration) } : {}),
          ...(workoutType ? { workoutType } : {}),
        },
        ...(weight || mood !== null
          ? {
              health: {
                ...(weight ? { weightKg: Number(weight) } : {}),
                ...(mood !== null ? { mood } : {}),
              },
            }
          : {}),
        date,
        notes,
      };
      if (entryId) {
        await updateActivity(user.uid, entryId, payload);
      } else {
        await addActivity(user.uid, { type: 'exercise', ...payload });
      }
      onSaved();
    } catch (e) {
      console.error('Save exercise entry failed:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="entry-form">
      <div className="form-group">
        <label className="form-label">Did you work out?</label>
        <div className="workout-toggle">
          <button
            className={`workout-toggle-btn ${didWorkout === true ? 'active yes' : ''}`}
            onClick={() => setDidWorkout(true)}
          >
            Yes
          </button>
          <button
            className={`workout-toggle-btn ${didWorkout === false ? 'active no' : ''}`}
            onClick={() => setDidWorkout(false)}
          >
            No
          </button>
        </div>
      </div>

      {didWorkout && (
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Duration (min)</label>
            <input
              type="number"
              className="form-input"
              placeholder="30"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <input
              type="text"
              className="form-input"
              placeholder="Running, Gym..."
              value={workoutType}
              onChange={(e) => setWorkoutType(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Weight (kg)</label>
          <input
            type="number"
            className="form-input"
            placeholder="70"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            inputMode="decimal"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input
            type="date"
            className="form-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">How are you feeling?</label>
        <div className="mood-selector">
          {MOOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`mood-btn ${mood === opt.value ? 'active' : ''}`}
              onClick={() => setMood(mood === opt.value ? null : opt.value)}
            >
              <MoodSvg mood={opt.value} label={opt.label} size={20} className="mood-svg" />
              <span className="mood-label">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Notes</label>
        <input
          type="text"
          className="form-input"
          placeholder="Optional"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button
        className="form-submit"
        onClick={handleSubmit}
        disabled={saving || !canSave}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
