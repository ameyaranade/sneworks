import { useAuth } from '../../../auth/AuthContext';
import { useToast } from '../../../shared/components/Toast';
import { useEntriesStore } from '../../stores/useEntriesStore';
import { useLoggerUI } from '../../context/LoggerUIContext';
import type { Entry } from '../../types';
import EntryRow from '../rows/EntryRow';
import SwipeableRow from '../swipe/SwipeableRow';
import type { SwipeAction } from '../swipe/SwipeableRow';
import './entry-list.css';

interface EntryListProps {
  entries: Entry[];
  showTime?: boolean;
  emptyMessage?: string;
}

export default function EntryList({ entries, showTime = false, emptyMessage = 'Nothing here yet.' }: EntryListProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { openComposeForEdit, openDefer } = useLoggerUI();
  const completeEntry = useEntriesStore((s) => s.completeEntry);
  const skipEntry = useEntriesStore((s) => s.skipEntry);
  const markPending = useEntriesStore((s) => s.markPending);
  const deleteEntry = useEntriesStore((s) => s.deleteEntry);
  const restoreEntry = useEntriesStore((s) => s.restoreEntry);

  if (entries.length === 0) {
    return <p className="lg-entry-list-empty">{emptyMessage}</p>;
  }

  const handleDelete = async (entry: Entry) => {
    if (!user || !entry.id) return;
    const deleted = await deleteEntry(user.uid, entry.id);
    if (deleted) {
      showToast('Entry deleted', 'info', {
        action: {
          label: 'Undo',
          onClick: () => restoreEntry(user.uid, deleted),
        },
        duration: 5000,
      });
    }
  };

  const handleComplete = async (entry: Entry) => {
    if (!user || !entry.id) return;
    if (entry.status === 'done') {
      await markPending(user.uid, entry.id);
    } else {
      await completeEntry(user.uid, entry.id);
    }
  };

  const getSwipeActions = (entry: Entry) => {
    const leftActions: SwipeAction[] = []; // revealed on left-swipe (right side)
    const rightActions: SwipeAction[] = []; // revealed on right-swipe (left side)

    // Right side (left swipe): Edit + Delete [+ Skip/Unmark for todos]
    leftActions.push({
      label: 'Edit',
      className: 'lg-swipe-action--edit',
      onTrigger: () => openComposeForEdit(entry),
    });

    if (entry.kind === 'todo' && entry.status === 'done') {
      leftActions.push({
        label: 'Unmark',
        className: 'lg-swipe-action--unmark',
        onTrigger: () => handleComplete(entry),
      });
    } else if (entry.kind === 'todo' && entry.status === 'pending') {
      leftActions.push({
        label: 'Skip',
        className: 'lg-swipe-action--skip',
        onTrigger: () => user && entry.id && skipEntry(user.uid, entry.id),
      });
    }

    leftActions.push({
      label: 'Delete',
      className: 'lg-swipe-action--delete',
      onTrigger: () => handleDelete(entry),
    });

    // Left side (right swipe): Defer (todos only)
    if (entry.kind === 'todo' && entry.status === 'pending') {
      rightActions.push({
        label: 'Tmrw',
        className: 'lg-swipe-action--tomorrow',
        onTrigger: () => entry.id && openDefer(entry.id),
      });
    }

    return { leftActions, rightActions };
  };

  return (
    <div className="lg-entry-list">
      {entries.map((entry) => {
        const { leftActions, rightActions } = getSwipeActions(entry);
        return (
          <SwipeableRow key={entry.id} leftActions={leftActions} rightActions={rightActions}>
            <EntryRow
              entry={entry}
              showTime={showTime}
              onComplete={() => handleComplete(entry)}
              onTap={() => openComposeForEdit(entry)}
            />
          </SwipeableRow>
        );
      })}
    </div>
  );
}
