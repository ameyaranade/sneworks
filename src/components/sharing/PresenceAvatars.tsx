import { useEffect, useState } from 'react';
import { subscribeToPresence } from '../../firebase/presence';
import type { PresenceEntry } from '../../types';
import './sharing.css';

/** Live presence map for a shared project (empty when RTDB isn't configured yet). */
export function usePresence(pid: string | undefined): Record<string, PresenceEntry> {
  const [presence, setPresence] = useState<Record<string, PresenceEntry>>({});
  useEffect(() => {
    if (!pid) {
      setPresence({});
      return;
    }
    return subscribeToPresence(pid, setPresence);
  }, [pid]);
  return presence;
}

interface PresenceAvatarsProps {
  presence: Record<string, PresenceEntry>;
  selfUid?: string;
}

/** Stacked avatars + active dot for members with a fresh presence heartbeat (spec §5.2). */
export default function PresenceAvatars({ presence, selfUid }: PresenceAvatarsProps) {
  const others = Object.entries(presence).filter(([uid]) => uid !== selfUid);
  if (others.length === 0) return null;

  return (
    <span
      className="sn-presence-avatars"
      title={`${others.length} other${others.length === 1 ? '' : 's'} active now`}
    >
      {others.slice(0, 3).map(([uid, entry]) => (
        <span key={uid} className="sn-presence-avatar">
          {entry.name.slice(0, 2).toUpperCase()}
        </span>
      ))}
      <span className="sn-presence-dot" aria-hidden="true" />
    </span>
  );
}

interface EditingIndicatorProps {
  presence: Record<string, PresenceEntry>;
  taskId: string;
  selfUid?: string;
}

/** Per-row "X is editing…" affordance (spec §5.2). */
export function EditingIndicator({ presence, taskId, selfUid }: EditingIndicatorProps) {
  const editor = Object.entries(presence).find(
    ([uid, entry]) => uid !== selfUid && entry.editingTaskId === taskId,
  );
  if (!editor) return null;
  const [, entry] = editor;

  return (
    <span className="sn-editing-indicator">
      <span className="sn-editing-avatar">{entry.name.slice(0, 2).toUpperCase()}</span>
      {entry.name} is editing…
    </span>
  );
}
