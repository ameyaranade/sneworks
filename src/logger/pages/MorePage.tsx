import { useState, useMemo } from 'react';
import { Plus, Trash2, Search, X, Repeat } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../shared/components/Toast';
import { useGroupsStore } from '../stores/useGroupsStore';
import { useRoutinesStore } from '../stores/useRoutinesStore';
import { useTypesStore } from '../stores/useTypesStore';
import { useEntriesStore } from '../stores/useEntriesStore';
import GroupCard from '../components/rows/GroupCard';
import GroupCreateSheet from '../components/sheets/GroupCreateSheet';
import RoutineCreateSheet from '../components/sheets/RoutineCreateSheet';
import * as LucideIcons from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { Entry } from '../types';
import { relativeDateLabel } from '../utils';
import './more-page.css';

// ─── Icon resolver ────────────────────────────────────────────────────────────
function TypeIcon({ glyph, size = 14 }: { glyph: string; size?: number }) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<LucideProps>>)[glyph];
  return Icon ? <Icon size={size} strokeWidth={2} /> : <span>{glyph.slice(0, 2)}</span>;
}

// ─── RRULE display helper ─────────────────────────────────────────────────────
function friendlyRecurrence(rrule: string): string {
  if (rrule.includes('BYDAY=MO,TU,WE,TH,FR')) return 'Weekdays';
  if (rrule.startsWith('FREQ=DAILY')) return 'Daily';
  if (rrule.startsWith('FREQ=WEEKLY')) return 'Weekly';
  if (rrule.startsWith('FREQ=MONTHLY')) return 'Monthly';
  return rrule;
}

// ─── Search result row ────────────────────────────────────────────────────────
function SearchResultRow({ entry, typeName }: { entry: Entry; typeName: string }) {
  const ts = entry.occurredAt ?? entry.dueAt ?? entry.createdAt;
  const date = ts ? relativeDateLabel(ts.toDate()) : '';
  return (
    <div className="lg-search-result">
      <div className="lg-search-result-title">{entry.title}</div>
      <div className="lg-search-result-meta">
        <span className="lg-search-result-type">{typeName}</span>
        {date && <span className="lg-search-result-date">{date}</span>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MorePage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const groups = useGroupsStore((s) => s.groups);
  const routines = useRoutinesStore((s) => s.routines);
  const deleteRoutine = useRoutinesStore((s) => s.deleteRoutine);
  const types = useTypesStore((s) => s.types);
  const typesMap = useTypesStore((s) => s.typesMap);
  const deleteType = useTypesStore((s) => s.deleteType);
  const entries = useEntriesStore((s) => s.entries);

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateRoutine, setShowCreateRoutine] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTypesExpanded, setShowTypesExpanded] = useState(false);

  // Client-side search across all entries
  const searchResults = useMemo<Entry[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return entries
      .filter((e) => {
        const title = e.title.toLowerCase();
        const type = typesMap.get(e.typeId)?.name.toLowerCase() ?? '';
        return title.includes(q) || type.includes(q);
      })
      .slice(0, 30); // cap at 30 results
  }, [searchQuery, entries, typesMap]);

  const handleDeleteRoutine = async (routineId: string, name: string) => {
    if (!user) return;
    try {
      await deleteRoutine(user.uid, routineId);
      showToast(`${name} deleted`, 'success');
    } catch {
      showToast('Failed to delete routine.', 'error');
    }
  };

  const handleDeleteType = async (typeId: string, typeName: string) => {
    if (!user) return;
    const usedCount = entries.filter((e) => e.typeId === typeId).length;
    if (usedCount > 0) {
      showToast(`Cannot delete: ${usedCount} entries use this type.`, 'error');
      return;
    }
    try {
      await deleteType(user.uid, typeId);
      showToast(`${typeName} deleted`, 'success');
    } catch {
      showToast('Failed to delete type.', 'error');
    }
  };

  return (
    <div className="lg-more-page">
      <div className="lg-more-header">
        <h1 className="lg-more-title">More</h1>
      </div>

      <div className="lg-more-content">

        {/* ── Search ── */}
        <section className="lg-more-section">
          <div className="lg-search-bar">
            <Search size={15} className="lg-search-icon" />
            <input
              type="text"
              className="lg-search-input"
              placeholder="Search entries…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="lg-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {searchQuery && (
            <div className="lg-search-results">
              {searchResults.length === 0 ? (
                <div className="lg-search-empty">No entries match "{searchQuery}"</div>
              ) : (
                searchResults.map((entry) => (
                  <SearchResultRow
                    key={entry.id}
                    entry={entry}
                    typeName={typesMap.get(entry.typeId)?.name ?? entry.typeId}
                  />
                ))
              )}
            </div>
          )}
        </section>

        {/* ── Groups / Lists / Projects ── */}
        <section className="lg-more-section">
          <div className="lg-more-section-header">
            <span className="lg-more-section-title">Lists & Projects</span>
            <button
              type="button"
              className="lg-more-add-btn"
              onClick={() => setShowCreateGroup(true)}
              aria-label="New group"
            >
              <Plus size={16} strokeWidth={2.5} />
              New
            </button>
          </div>

          {groups.length === 0 ? (
            <button
              type="button"
              className="lg-more-empty-card"
              onClick={() => setShowCreateGroup(true)}
            >
              <span className="lg-more-empty-icon">+</span>
              <span className="lg-more-empty-text">Create your first list or project</span>
            </button>
          ) : (
            <div className="lg-more-group-list">
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          )}
        </section>

        {/* ── Routines ── */}
        <section className="lg-more-section">
          <div className="lg-more-section-header">
            <span className="lg-more-section-title">Routines</span>
            <button
              type="button"
              className="lg-more-add-btn"
              onClick={() => setShowCreateRoutine(true)}
              aria-label="New routine"
            >
              <Plus size={16} strokeWidth={2.5} />
              New
            </button>
          </div>

          {routines.length === 0 ? (
            <button
              type="button"
              className="lg-more-empty-card"
              onClick={() => setShowCreateRoutine(true)}
            >
              <span className="lg-more-empty-icon"><Repeat size={18} /></span>
              <span className="lg-more-empty-text">Set up a recurring routine</span>
            </button>
          ) : (
            <div className="lg-routine-list">
              {routines.map((routine) => (
                <div key={routine.id} className="lg-routine-row">
                  <div className="lg-routine-info">
                    <span className="lg-routine-name">{routine.name}</span>
                    <span className="lg-routine-meta">
                      {friendlyRecurrence(routine.recurrence)}
                      {' · '}
                      {routine.templateChildren.length} item{routine.templateChildren.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="lg-routine-delete-btn"
                    onClick={() => handleDeleteRoutine(routine.id!, routine.name)}
                    aria-label={`Delete ${routine.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Activity Types ── */}
        <section className="lg-more-section">
          <div className="lg-more-section-header">
            <span className="lg-more-section-title">Activity Types</span>
            <button
              type="button"
              className="lg-more-add-btn"
              onClick={() => setShowTypesExpanded((v) => !v)}
            >
              {showTypesExpanded ? 'Hide' : `${types.length} types`}
            </button>
          </div>

          {showTypesExpanded && (
            <div className="lg-types-list">
              {types.map((type) => (
                <div key={type.id} className="lg-type-row">
                  <div className="lg-type-icon">
                    <TypeIcon glyph={type.glyph} size={14} />
                  </div>
                  <div className="lg-type-info">
                    <span className="lg-type-name">{type.name}</span>
                    <span className="lg-type-meta">
                      {type.fields.length} field{type.fields.length !== 1 ? 's' : ''}
                      {type.builtIn ? ' · built-in' : ''}
                    </span>
                  </div>
                  {!type.builtIn && (
                    <button
                      type="button"
                      className="lg-routine-delete-btn"
                      onClick={() => handleDeleteType(type.id!, type.name)}
                      aria-label={`Delete ${type.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {showCreateGroup && (
        <GroupCreateSheet onClose={() => setShowCreateGroup(false)} />
      )}
      {showCreateRoutine && (
        <RoutineCreateSheet onClose={() => setShowCreateRoutine(false)} />
      )}
    </div>
  );
}
