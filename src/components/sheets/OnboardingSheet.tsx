import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTodosStore } from '../../stores/useTodosStore';
import './onboarding-sheet.css';

interface OnboardingSheetProps {
  uid: string;
  onDone: () => void;
}

export default function OnboardingSheet({ uid, onDone }: OnboardingSheetProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [taskTitle, setTaskTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const addTodo = useTodosStore((s) => s.addTodo);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 2) {
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [step]);

  const handleCreateTask = async () => {
    const title = taskTitle.trim();
    if (!title || saving) return;
    setSaving(true);
    try {
      await addTodo(uid, {
        todoType: 'generic-task',
        title,
        status: 'pending',
        sortOrder: Date.now(),
      });
    } finally {
      setSaving(false);
      onDone();
    }
  };

  const portalTarget = document.getElementById('sn-portal') ?? document.body;

  return createPortal(
    <div className="sn-onboard-overlay" role="dialog" aria-modal="true" aria-label="Welcome to Planner">
      <div className="sn-onboard-sheet">
        <div className="sn-sheet-handle" aria-hidden="true" />

        {step === 1 ? (
          <div className="sn-onboard-step">
            <div className="sn-onboard-glyph" aria-hidden="true">◆</div>
            <h1 className="sn-onboard-title">Planner</h1>
            <p className="sn-onboard-tagline">
              Your daily planner — tasks, routines, and notes in one place.
            </p>
            <ul className="sn-onboard-features">
              <li>Track tasks, shopping lists, and projects</li>
              <li>Build daily habits with routines</li>
              <li>Log workouts, expenses, and notes</li>
            </ul>
            <button className="sn-onboard-btn-primary" onClick={() => setStep(2)}>
              Get started
            </button>
          </div>
        ) : (
          <div className="sn-onboard-step">
            <p className="sn-onboard-step-label">First task</p>
            <h2 className="sn-onboard-title">What's on your mind?</h2>
            <p className="sn-onboard-tagline">
              Add one thing you want to get done — it'll show up in your Today view.
            </p>
            <input
              ref={inputRef}
              className="sn-onboard-input"
              type="text"
              placeholder="e.g. Plan my week"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTask();
              }}
              maxLength={200}
            />
            <button
              className="sn-onboard-btn-primary"
              onClick={handleCreateTask}
              disabled={!taskTitle.trim() || saving}
            >
              {saving ? 'Saving…' : 'Add task'}
            </button>
            <button className="sn-onboard-btn-skip" onClick={onDone}>
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>,
    portalTarget,
  );
}
