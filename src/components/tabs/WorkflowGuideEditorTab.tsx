import { useEffect, useMemo, useState } from 'react';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { PageTitleHeader } from '@/components/app/PageTitleHeader';
import { SectionPillNav } from '@/components/app/SectionPillNav';
import { ErrorSurface, LoadingSurface } from '@/components/app/StateSurfaces';
import { PAGE_DEFINITIONS } from '@/auth/pages';
import {
  getUserGuideEditableFields,
  loadWorkflowGuideContent,
  updateWorkflowGuideRecord,
  type UserGuideEditableRecord,
} from '@/services/userGuideContent';
import type { UserRole } from '@/stores/auth/authTypes';

export interface WorkflowGuideEditorTabProps {
  currentUserRole: UserRole;
  className?: string;
}

const CONTENT_TYPE_LABELS = {
  'role-guide': 'Role Guides By Audience',
  'workflow-rule': 'Workflow Rules And Handoffs',
  'workflow-stage': 'Workflow Lane Stages',
  'page-guide': 'Page Guides',
  'record-guide': 'Record Page Guides',
  'role-start-point': 'Role Start Cards',
} as const;

type ContentGroupKey = keyof typeof CONTENT_TYPE_LABELS;

function describeSelectedRecord(record: UserGuideEditableRecord): string {
  switch (record.contentType) {
    case 'role-guide':
      return 'This updates the role-specific copy shown to one audience inside the User Guide.';
    case 'workflow-rule':
      return 'This updates one rule in the section that explains how items qualify to move forward.';
    case 'workflow-stage':
      return 'This updates one stage card in the workflow lane chart.';
    case 'page-guide':
      return 'This updates one page reference card in the guide so users know which page owns a job.';
    case 'record-guide':
      return 'This updates one record or detail-page reference card in the guide.';
    case 'role-start-point':
      return 'This updates one starting-point card that tells a role where to begin.';
    default:
      return 'This updates one User Guide content block.';
  }
}

function AdminFieldEditor({
  label,
  multiline,
  value,
  onChange,
}: {
  label: string;
  multiline: boolean;
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const className = 'mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</span>
      {multiline ? (
        <textarea className={`${className} min-h-28 resize-y`} value={value} onChange={(event) => onChange(event.currentTarget.value)} />
      ) : (
        <input className={className} type="text" value={value} onChange={(event) => onChange(event.currentTarget.value)} />
      )}
    </label>
  );
}

export function WorkflowGuideEditorTab({ className }: WorkflowGuideEditorTabProps) {
  const [editableRecords, setEditableRecords] = useState<UserGuideEditableRecord[]>([]);
  const [guideSource, setGuideSource] = useState<'airtable' | 'default'>('default');
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedGroupKey, setSelectedGroupKey] = useState<ContentGroupKey | ''>('');
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const loadGuide = async () => {
      setLoading(true);
      const result = await loadWorkflowGuideContent();
      if (cancelled) {
        return;
      }
      setEditableRecords(result.editableRecords);
      setGuideSource(result.source);
      setLoading(false);
    };

    void loadGuide();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const groupedRecords = useMemo(() => {
    const groups = new Map<ContentGroupKey, UserGuideEditableRecord[]>();

    for (const record of editableRecords) {
      const groupKey = record.contentType as ContentGroupKey;
      const existing = groups.get(groupKey);
      if (existing) {
        existing.push(record);
      } else {
        groups.set(groupKey, [record]);
      }
    }

    return Array.from(groups.entries()).map(([key, records]) => ({
      key,
      label: CONTENT_TYPE_LABELS[key],
      records,
    }));
  }, [editableRecords]);

  useEffect(() => {
    if (groupedRecords.length === 0) {
      setSelectedGroupKey('');
      setSelectedRecordId('');
      return;
    }

    if (!groupedRecords.some((group) => group.key === selectedGroupKey)) {
      setSelectedGroupKey(groupedRecords[0].key);
    }
  }, [groupedRecords, selectedGroupKey]);

  const visibleRecords = groupedRecords.find((group) => group.key === selectedGroupKey)?.records ?? [];

  useEffect(() => {
    if (visibleRecords.length === 0) {
      setSelectedRecordId('');
      return;
    }

    if (!visibleRecords.some((record) => record.id === selectedRecordId)) {
      setSelectedRecordId(visibleRecords[0].id);
    }
  }, [visibleRecords, selectedRecordId]);

  const selectedRecord = visibleRecords.find((record) => record.id === selectedRecordId) ?? visibleRecords[0] ?? null;
  const adminFields = selectedRecord ? getUserGuideEditableFields(selectedRecord.contentType) : [];

  useEffect(() => {
    if (!selectedRecord) {
      setDraftValues({});
      return;
    }

    setDraftValues(selectedRecord.fieldValues);
  }, [selectedRecord]);

  const handleSave = async () => {
    if (!selectedRecord) {
      return;
    }

    if ('Name' in draftValues && draftValues.Name.trim().length === 0) {
      setSaveError('Card Title is required before saving this guide record.');
      setSaveMessage(null);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      await updateWorkflowGuideRecord(selectedRecord.id, draftValues);
      setSaveMessage(`Saved ${selectedRecord.name}.`);
      setReloadKey((currentValue) => currentValue + 1);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save the selected guide row.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppPageLayout className={className}>
      <PageTitleHeader
        eyebrow="Admin Guide Copy"
        title="User Guide Admin"
        actions={(
          <BackToolbarButton
            label="Back to User Guide"
            onClick={() => {
              window.location.assign(PAGE_DEFINITIONS['workflow-guide'].path);
            }}
          />
        )}
      />

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_18px_40px_rgba(2,6,23,0.18)]">
        <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Who Can Edit</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--ink)]">Only admins, owners, and developers can edit User Guide copy here</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          The reader-facing User Guide stays separate from this page. Choose the exact guide surface on the left, edit its fields on the right, then save to update the live copy seen across the app.
        </p>
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-4 text-sm text-[var(--muted)]">
          <p className="m-0">Edit access: <span className="font-semibold text-[var(--ink)]">Admin, Owner, Developer</span></p>
          {loading ? <p className="m-0 mt-2">Refreshing guide content from Airtable...</p> : null}
          {guideSource === 'default' ? <p className="m-0 mt-2 text-amber-200">Airtable guide rows are unavailable, so this page is showing fallback content and saves are blocked until the configured source comes back.</p> : null}
        </div>
      </section>

      {editableRecords.length === 0 ? (
        loading ? <LoadingSurface message="Loading editable guide rows from Airtable..." /> : <ErrorSurface title="Guide editing unavailable" message="The User Guide Airtable rows could not be loaded for editing." />
      ) : (
        <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.18)]">
            <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Content Section</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Pick a section, then choose the specific guide block to edit.</p>
            <SectionPillNav
              ariaLabel="User guide admin sections"
              items={groupedRecords.map((group) => ({ key: group.key, label: group.label }))}
              activeKey={selectedGroupKey || groupedRecords[0]?.key || 'role-guide'}
              onSelect={(key) => {
                setSelectedGroupKey(key);
                setSaveError(null);
                setSaveMessage(null);
              }}
              className="mt-4"
            />
            <div className="mt-4 space-y-2">
              {visibleRecords.map((record) => {
                const isActive = record.id === selectedRecord?.id;

                return (
                  <button
                    key={record.id}
                    type="button"
                    className={[
                      'w-full rounded-2xl border px-3 py-3 text-left transition',
                      isActive
                        ? 'border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--ink)]'
                        : 'border-[var(--line)] bg-[var(--bg)]/70 text-[var(--muted)] hover:border-[var(--accent)]/35 hover:text-[var(--ink)]',
                    ].join(' ')}
                    onClick={() => {
                      setSelectedRecordId(record.id);
                      setSaveError(null);
                      setSaveMessage(null);
                    }}
                  >
                    <p className="m-0 text-sm font-semibold">{record.name}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_18px_40px_rgba(2,6,23,0.18)]">
            {saveError ? <div className="mb-4 rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{saveError}</div> : null}
            {saveMessage ? <div className="mb-4 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{saveMessage}</div> : null}

            {selectedRecord ? (
              <div className="space-y-5">
                <div>
                  <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Selected Guide</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[var(--ink)]">{selectedRecord.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {describeSelectedRecord(selectedRecord)} The fields below are limited to the copy for this exact surface.
                  </p>
                </div>

                <div className="space-y-4">
                  {adminFields.map((field) => (
                    <AdminFieldEditor
                      key={field.name}
                      label={field.label}
                      multiline={field.multiline}
                      value={draftValues[field.name] ?? ''}
                      onChange={(nextValue) => {
                        setDraftValues((currentValue) => ({ ...currentValue, [field.name]: nextValue }));
                        setSaveError(null);
                        setSaveMessage(null);
                      }}
                    />
                  ))}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={saving || guideSource !== 'airtable'}
                    onClick={() => {
                      void handleSave();
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Guide Copy'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )}
    </AppPageLayout>
  );
}