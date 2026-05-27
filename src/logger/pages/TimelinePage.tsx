import { useMemo } from 'react';
import { useEntriesStore } from '../stores/useEntriesStore';
import type { Entry } from '../types';
import { startOfDay, addDays } from '../utils';
import DayHeader from '../components/rows/DayHeader';
import EntryList from '../components/composites/EntryList';
import NowLine from '../components/composites/NowLine';
import './timeline-page.css';

interface DayGroup {
  date: Date;
  entries: Entry[];
}

function groupByDay(entries: Entry[]): DayGroup[] {
  const map = new Map<string, DayGroup>();

  for (const e of entries) {
    const ts = e.occurredAt ?? e.dueAt ?? e.createdAt;
    if (!ts) continue;
    const date = startOfDay(ts.toDate());
    const key = date.toISOString().slice(0, 10);
    if (!map.has(key)) {
      map.set(key, { date, entries: [] });
    }
    map.get(key)!.entries.push(e);
  }

  return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}

export default function TimelinePage() {
  const allEntries = useEntriesStore((s) => s.entries);
  const loaded = useEntriesStore((s) => s.loaded);

  const dayGroups = useMemo(() => groupByDay(allEntries), [allEntries]);

  // Show the last 30 days + upcoming 7 days
  const now = new Date();
  const cutoff = addDays(now, -30);

  const visibleGroups = useMemo(
    () => dayGroups.filter((g) => g.date >= startOfDay(cutoff)),
    [dayGroups, cutoff],
  );

  return (
    <div className="lg-timeline-page">
      <div className="lg-timeline-header">
        <h1 className="lg-timeline-title">Timeline</h1>
      </div>

      <div className="lg-timeline-content">
        {!loaded ? (
          <p className="lg-timeline-loading">Loading…</p>
        ) : visibleGroups.length === 0 ? (
          <div className="lg-timeline-empty">
            <p>No entries yet. Tap + to log something.</p>
          </div>
        ) : (
          visibleGroups.map((group, idx) => {
            const showNowLine =
              idx > 0 &&
              visibleGroups[idx - 1].date > now &&
              group.date <= startOfDay(now);

            return (
              <div key={group.date.toISOString().slice(0, 10)} className="lg-timeline-day">
                {showNowLine && <NowLine />}
                <DayHeader date={group.date} entryCount={group.entries.length} />
                <EntryList entries={group.entries} showTime />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
