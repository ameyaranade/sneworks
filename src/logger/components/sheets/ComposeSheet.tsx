import { useState, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../../auth/AuthContext';
import { useToast } from '../../../shared/components/Toast';
import { useEntriesStore } from '../../stores/useEntriesStore';
import { useTypesStore } from '../../stores/useTypesStore';
import { useGroupsStore } from '../../stores/useGroupsStore';
import type { Entry, TypeSchema } from '../../types';
import BottomSheet from '../primitives/BottomSheet';
import TypePicker from '../inputs/TypePicker';
import SchemaFieldInput from '../inputs/SchemaFieldInput';
import GroupPicker from '../inputs/GroupPicker';
import type { Group } from '../../types';
import { formatLogTitle } from '../../utils';
import './compose-sheet.css';

type Step = 'type' | 'form';

interface ComposeSheetProps {
  onClose: () => void;
  editEntry?: Entry;
  preselectedTypeId?: string;
  preselectedDate?: Date;
  preselectedGroupId?: string;
}

export default function ComposeSheet({
  onClose,
  editEntry,
  preselectedTypeId,
  preselectedDate,
  preselectedGroupId,
}: ComposeSheetProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const addEntry = useEntriesStore((s) => s.addEntry);
  const updateEntry = useEntriesStore((s) => s.updateEntry);
  const typesMap = useTypesStore((s) => s.typesMap);
  const groups = useGroupsStore((s) => s.groups);

  // Determine initial step
  const initialTypeId = editEntry?.typeId ?? preselectedTypeId;
  const initialType = initialTypeId ? typesMap.get(initialTypeId) : undefined;
  const [step, setStep] = useState<Step>(initialType ? 'form' : 'type');
  const [selectedType, setSelectedType] = useState<TypeSchema | undefined>(initialType);

  // Form state
  const [kind, setKind] = useState<'log' | 'todo'>(
    editEntry?.kind ?? selectedType?.defaultKind ?? 'log',
  );
  const [title, setTitle] = useState(editEntry?.title ?? '');
  const [fieldData, setFieldData] = useState<Record<string, unknown>>(
    editEntry?.data ?? {},
  );

  // Bug 3 fix: initialize group from editEntry.groupId or preselectedGroupId
  const resolveInitialGroup = (): Group | null => {
    const gid = editEntry?.groupId ?? preselectedGroupId;
    return gid ? (groups.find((g) => g.id === gid) ?? null) : null;
  };
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(resolveInitialGroup);
  const [saving, setSaving] = useState(false);

  const setField = useCallback((key: string, value: unknown) => {
    setFieldData((prev) => {
      if (value === undefined) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const handleTypeSelect = (type: TypeSchema) => {
    setSelectedType(type);
    setKind(type.defaultKind);
    setStep('form');
  };

  // Build a descriptive save label (Bug 1 fix: merge title into format data)
  const buildSaveLabel = () => {
    if (!selectedType) return 'Save';
    const preview = selectedType.logFormat
      ? formatLogTitle(selectedType.logFormat, { title, ...fieldData })
      : title || selectedType.name;
    if (!preview.trim()) return `Save ${selectedType.name}`;
    return `Save · ${preview.trim()}`;
  };

  const handleSave = async () => {
    if (!user || !selectedType) return;
    setSaving(true);
    try {
      const now = Timestamp.now();
      const ts = preselectedDate ? Timestamp.fromDate(preselectedDate) : now;

      const entryData: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'> = {
        kind,
        typeId: selectedType.id!,
        title: title || (selectedType.logFormat
          ? formatLogTitle(selectedType.logFormat, { title, ...fieldData })
          : selectedType.name),
        data: fieldData,
        ...(kind === 'log' ? { occurredAt: ts } : {}),
        ...(kind === 'todo' ? { dueAt: ts, status: 'pending' as const } : {}),
        // Bug 4 fix: when editing and group cleared, send undefined to trigger deleteField
        ...(selectedGroup
          ? { groupId: selectedGroup.id, groupPath: [selectedGroup.name] }
          : editEntry?.groupId
          ? { groupId: undefined, groupPath: undefined }
          : {}),
        sortOrder: Date.now(),
        source: 'manual',
      };

      if (editEntry?.id) {
        await updateEntry(user.uid, editEntry.id, entryData);
        showToast('Entry updated', 'success');
      } else {
        await addEntry(user.uid, entryData);
        showToast('Saved', 'success');
      }
      onClose();
    } catch {
      showToast('Failed to save. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} className="lg-compose-sheet">
      {step === 'type' && (
        <>
          <div className="lg-compose-step-title">What are you logging?</div>
          <TypePicker
            selectedTypeId={selectedType?.id}
            onSelect={handleTypeSelect}
          />
        </>
      )}

      {step === 'form' && selectedType && (
        <>
          {/* Header: back + type name + kind toggle */}
          <div className="lg-compose-header">
            <button
              type="button"
              className="lg-compose-back"
              onClick={() => setStep('type')}
              aria-label="Back to type picker"
            >
              ←
            </button>
            <span className="lg-compose-type-name">{selectedType.name}</span>
            <div className="lg-compose-kind-toggle">
              <button
                type="button"
                className={`lg-kind-btn${kind === 'log' ? ' lg-kind-btn--active' : ''}`}
                onClick={() => setKind('log')}
              >
                Log
              </button>
              <button
                type="button"
                className={`lg-kind-btn${kind === 'todo' ? ' lg-kind-btn--active' : ''}`}
                onClick={() => setKind('todo')}
              >
                Todo
              </button>
            </div>
          </div>

          {/* Title input */}
          <div className="lg-compose-title-row">
            <input
              type="text"
              className="lg-compose-title-input"
              value={title}
              placeholder={
                selectedType.logFormat
                  ? formatLogTitle(selectedType.logFormat, fieldData) || `Add a title…`
                  : `Add a title…`
              }
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Schema fields */}
          <div className="lg-compose-fields">
            {selectedType.fields.map((field) => (
              <SchemaFieldInput
                key={field.key}
                field={field}
                value={fieldData[field.key]}
                onChange={setField}
              />
            ))}
          </div>

          {/* Group assignment */}
          <GroupPicker
            selectedGroupId={selectedGroup?.id}
            onSelect={setSelectedGroup}
          />

          {/* Action bar */}
          <div className="lg-compose-action-bar">
            <button
              type="button"
              className="lg-compose-save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : buildSaveLabel()}
            </button>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
