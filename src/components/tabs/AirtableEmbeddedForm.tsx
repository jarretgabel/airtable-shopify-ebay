import { useEffect, useState } from 'react';
import { ErrorSurface, LoadingSurface } from '@/components/app/StateSurfaces';
import { ComponentTypeSearchField } from '@/components/tabs/component-type-search-field';
import { DatePickerField } from '@/components/tabs/date-picker-field';
import {
  createManualIntakeFormDefaults,
  createManualIntakeItemFormDefaults,
  createManualIntakeSharedFormDefaults,
  manualIntakeFormFields,
  manualIntakeItemFormFields,
  manualIntakeSharedFormFields,
  mergeManualIntakeFormValues,
  type ManualIntakeFormFieldDefinition,
  type ManualIntakeFormOptionFieldName,
  type ManualIntakeFormValues,
  type ManualIntakeItemFormValues,
  type ManualIntakeSharedFormValues,
} from '@/components/tabs/manual-intake/manualIntakeFormSchema';
import {
  loadManualIntakeFormOptionSets,
  loadManualIntakeFormValues,
  submitManualIntakeForm,
  type ManualIntakeFormLoadResult,
  type ManualIntakeRecordSource,
} from '@/services/manualIntakeForm';
import { buildJotFormSubmissionUrl } from '@/services/jotform';

type ManualIntakeOptionSets = Record<ManualIntakeFormOptionFieldName, string[]>;
type FieldValueMap = Record<string, string | File[]>;

const FIELD_CLASS = 'mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
const LABEL_CLASS = 'text-sm font-semibold text-[var(--ink)]';
const HELP_CLASS = 'mt-1 text-xs text-[var(--muted)]';
const DATE_BUTTON_CLASS = 'mt-2 inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus:ring-[var(--accent)]/20';

function validateSingleForm(values: ManualIntakeFormValues): string | null {
  if (!values.cost.trim()) return 'Cost is required.';
  if (!values.make.trim()) return 'Make is required.';
  if (!values.model.trim()) return 'Model is required.';
  if (!values.componentType.trim()) return 'Component Type is required.';
  return null;
}

function validateGroupedSharedForm(values: ManualIntakeSharedFormValues): string | null {
  if (!values.pickUpNumber.trim()) return 'Pick Up ID is required for grouped intake.';
  if (!values.cost.trim()) return 'Cost is required.';
  return null;
}

function validateGroupedItemForm(values: ManualIntakeItemFormValues, itemIndex: number): string | null {
  const missingFields: string[] = [];
  if (!values.make.trim()) missingFields.push('Make');
  if (!values.model.trim()) missingFields.push('Model');
  if (!values.componentType.trim()) missingFields.push('Component Type');

  if (missingFields.length === 0) {
    return null;
  }

  return `Item ${itemIndex + 1} is missing ${missingFields.join(', ')}.`;
}

function FieldShell({ definition, children }: { definition: ManualIntakeFormFieldDefinition; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={LABEL_CLASS}>
        {definition.label}
        {definition.required ? ' *' : ''}
      </span>
      {children}
      {definition.description ? <p className={HELP_CLASS}>{definition.description}</p> : null}
    </label>
  );
}

type FieldGroup = ManualIntakeFormFieldDefinition | [ManualIntakeFormFieldDefinition, ManualIntakeFormFieldDefinition];

function groupFields(fields: ManualIntakeFormFieldDefinition[]): FieldGroup[] {
  const groups: FieldGroup[] = [];
  let index = 0;

  while (index < fields.length) {
    const current = fields[index];
    const next = fields[index + 1];
    if (current.halfWidth && next?.halfWidth) {
      groups.push([current, next]);
      index += 2;
    } else {
      groups.push(current);
      index += 1;
    }
  }

  return groups;
}

function renderField(
  definition: ManualIntakeFormFieldDefinition,
  value: string | File[] | undefined,
  onValueChange: (nextValue: string | File[]) => void,
  optionSets: ManualIntakeOptionSets,
) {
  if (definition.type === 'textarea') {
    return (
      <textarea
        className={FIELD_CLASS}
        rows={definition.rows ?? 4}
        value={(value as string) ?? ''}
        placeholder={definition.placeholder}
        onChange={(event) => onValueChange(event.currentTarget.value)}
      />
    );
  }

  if (definition.type === 'date') {
    return (
      <DatePickerField
        containerClassName="flex gap-2"
        inputClassName={`${FIELD_CLASS} mt-2 flex-1`}
        buttonClassName={DATE_BUTTON_CLASS}
        value={(value as string) ?? ''}
        pickerLabel={definition.label}
        placeholder={definition.placeholder}
        onValueChange={(nextValue) => onValueChange(nextValue)}
      />
    );
  }

  if (definition.type === 'file') {
    const files = (value as File[]) ?? [];

    return (
      <>
        <input
          className={`${FIELD_CLASS} file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110`}
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => onValueChange(Array.from(event.currentTarget.files ?? []))}
        />
        <p className={HELP_CLASS}>{files.length > 0 ? `${files.length} image${files.length === 1 ? '' : 's'} selected.` : 'No images selected.'}</p>
      </>
    );
  }

  if (definition.type === 'select') {
    const options = definition.optionFieldName ? optionSets[definition.optionFieldName] : [];

    return (
      <select
        className={FIELD_CLASS}
        value={(value as string) ?? ''}
        onChange={(event) => onValueChange(event.currentTarget.value)}
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  if (definition.type === 'searchable-select') {
    const options = definition.optionFieldName ? optionSets[definition.optionFieldName] : [];
    const datalistId = `manual-intake-${definition.name}-options`;

    return (
      <ComponentTypeSearchField
        className={FIELD_CLASS}
        helpClassName={HELP_CLASS}
        listId={datalistId}
        options={options}
        value={(value as string) ?? ''}
        onValueChange={(nextValue) => onValueChange(nextValue)}
      />
    );
  }

  const inputType = definition.type === 'currency' ? 'number' : definition.type;

  return (
    <input
      className={FIELD_CLASS}
      type={inputType}
      step={definition.type === 'currency' ? '0.01' : undefined}
      value={(value as string) ?? ''}
      placeholder={definition.placeholder}
      onChange={(event) => onValueChange(event.currentTarget.value)}
    />
  );
}

interface AirtableEmbeddedFormProps {
  recordId?: string | null;
  onLoadResult?: (result: ManualIntakeFormLoadResult) => void;
}

export function AirtableEmbeddedForm({
  recordId,
  onLoadResult,
}: AirtableEmbeddedFormProps) {
  const [editFormValues, setEditFormValues] = useState<ManualIntakeFormValues>(() => createManualIntakeFormDefaults());
  const [initialEditFormValues, setInitialEditFormValues] = useState<ManualIntakeFormValues>(() => createManualIntakeFormDefaults());
  const [sharedValues, setSharedValues] = useState<ManualIntakeSharedFormValues>(() => createManualIntakeSharedFormDefaults());
  const [itemValues, setItemValues] = useState<ManualIntakeItemFormValues[]>(() => [createManualIntakeItemFormDefaults()]);
  const [recordSource, setRecordSource] = useState<ManualIntakeRecordSource>('used-gear-workflow');
  const [workflowSource, setWorkflowSource] = useState('');
  const [jotFormSubmissionId, setJotFormSubmissionId] = useState('');
  const [optionSets, setOptionSets] = useState<ManualIntakeOptionSets | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [groupedItemErrors, setGroupedItemErrors] = useState<string[]>([]);
  const [collapsedItemIndexes, setCollapsedItemIndexes] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      setLoadingOptions(true);
      setOptionsError(null);

      try {
        const [nextOptionSets, nextFormValues] = await Promise.all([
          loadManualIntakeFormOptionSets(),
          recordId
            ? loadManualIntakeFormValues(recordId)
            : Promise.resolve({
              source: 'used-gear-workflow' as ManualIntakeRecordSource,
              itemTitle: '',
              workflowSource: '',
              jotFormSubmissionId: '',
              values: createManualIntakeFormDefaults(),
            }),
        ]);

        if (!cancelled) {
          setOptionSets(nextOptionSets);
          setRecordSource(nextFormValues.source);
          setWorkflowSource(nextFormValues.workflowSource ?? '');
          setJotFormSubmissionId(nextFormValues.jotFormSubmissionId ?? '');
          setSubmitError(null);
          setSubmitSuccess(null);

          if (recordId) {
            setEditFormValues(nextFormValues.values);
            setInitialEditFormValues(nextFormValues.values);
          } else {
            setSharedValues(createManualIntakeSharedFormDefaults());
            setItemValues([createManualIntakeItemFormDefaults()]);
            setGroupedItemErrors([]);
            setCollapsedItemIndexes([]);
          }

          onLoadResult?.(nextFormValues);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unable to load form options.';
          setOptionsError(message);
        }
      } finally {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      }
    };

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [onLoadResult, recordId]);

  const clearSubmissionState = () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    setGroupedItemErrors([]);
  };

  const setEditFieldValue = (fieldName: keyof ManualIntakeFormValues, value: ManualIntakeFormValues[keyof ManualIntakeFormValues]) => {
    clearSubmissionState();
    setEditFormValues((current) => ({
      ...current,
      [fieldName]: value,
    }));
  };

  const setSharedFieldValue = (fieldName: keyof ManualIntakeSharedFormValues, value: ManualIntakeSharedFormValues[keyof ManualIntakeSharedFormValues]) => {
    clearSubmissionState();
    setSharedValues((current) => ({
      ...current,
      [fieldName]: value,
    }));
  };

  const setItemFieldValue = (itemIndex: number, fieldName: keyof ManualIntakeItemFormValues, value: ManualIntakeItemFormValues[keyof ManualIntakeItemFormValues]) => {
    clearSubmissionState();
    setItemValues((current) => current.map((item, currentIndex) => (
      currentIndex === itemIndex
        ? { ...item, [fieldName]: value }
        : item
    )));
  };

  const addItemCard = () => {
    clearSubmissionState();
    setItemValues((current) => [...current, createManualIntakeItemFormDefaults()]);
  };

  const toggleItemCollapsed = (itemIndex: number) => {
    setCollapsedItemIndexes((current) => (
      current.includes(itemIndex)
        ? current.filter((value) => value !== itemIndex)
        : [...current, itemIndex]
    ));
  };

  const duplicateItemCard = (itemIndex: number) => {
    clearSubmissionState();
    setItemValues((current) => {
      const sourceItem = current[itemIndex];
      if (!sourceItem) return current;

      const nextItem: ManualIntakeItemFormValues = {
        ...sourceItem,
        imageFiles: [],
      };

      return [
        ...current.slice(0, itemIndex + 1),
        nextItem,
        ...current.slice(itemIndex + 1),
      ];
    });
    setCollapsedItemIndexes((current) => current.map((value) => (value > itemIndex ? value + 1 : value)));
  };

  const removeItemCard = (itemIndex: number) => {
    clearSubmissionState();
    setItemValues((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((_, currentIndex) => currentIndex !== itemIndex);
    });
    setCollapsedItemIndexes((current) => current
      .filter((value) => value !== itemIndex)
      .map((value) => (value > itemIndex ? value - 1 : value)));
  };

  const resetGroupedFormValues = () => {
    setSharedValues(createManualIntakeSharedFormDefaults());
    setItemValues([createManualIntakeItemFormDefaults()]);
    setCollapsedItemIndexes([]);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearSubmissionState();

    if (recordId) {
      const validationError = validateSingleForm(editFormValues);
      if (validationError) {
        setSubmitError(validationError);
        return;
      }

      setSubmitting(true);
      try {
        const result = await submitManualIntakeForm(editFormValues, recordId, { recordSource });
        if (result.action === 'updated') {
          const nextValues = { ...editFormValues, imageFiles: [] };
          setEditFormValues(nextValues);
          setInitialEditFormValues(nextValues);
          setSubmitSuccess(`Manual Intake fields updated for record ${result.recordId}.`);
        }
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Unable to submit the Manual Intake form.');
      } finally {
        setSubmitting(false);
      }

      return;
    }

    const sharedValidationError = validateGroupedSharedForm(sharedValues);
    const itemValidationErrors = itemValues.map((item, itemIndex) => validateGroupedItemForm(item, itemIndex) ?? '');
    const hasItemErrors = itemValidationErrors.some((value) => Boolean(value));

    if (sharedValidationError || hasItemErrors) {
      setSubmitError(sharedValidationError ?? 'Fix the highlighted grouped intake items and try again.');
      setGroupedItemErrors(itemValidationErrors);
      if (hasItemErrors) {
        const errorIndexes = new Set(itemValidationErrors
          .map((value, index) => (value ? index : -1))
          .filter((index) => index >= 0));
        setCollapsedItemIndexes((current) => current.filter((index) => !errorIndexes.has(index)));
      }
      return;
    }

    setSubmitting(true);
    try {
      const createdRecordIds: string[] = [];

      for (const itemValue of itemValues) {
        const result = await submitManualIntakeForm(mergeManualIntakeFormValues(sharedValues, itemValue));
        createdRecordIds.push(result.recordId);
      }

      setSubmitSuccess(
        createdRecordIds.length === 1
          ? `Submission saved to Airtable. Record ID: ${createdRecordIds[0]}.`
          : `Grouped intake saved to Airtable. ${createdRecordIds.length} records created.`,
      );
      resetGroupedFormValues();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit the grouped Manual Intake form.');
    } finally {
      setSubmitting(false);
    }
  };

  const jotFormSubmissionUrl = buildJotFormSubmissionUrl(jotFormSubmissionId);
  const isEditMode = Boolean(recordId);
  const sharedFieldGroups = groupFields(manualIntakeSharedFormFields);
  const itemFieldGroups = groupFields(manualIntakeItemFormFields);
  const editFieldValues = editFormValues as unknown as FieldValueMap;
  const sharedFieldValues = sharedValues as unknown as FieldValueMap;

  if (loadingOptions) {
    return <LoadingSurface message="Loading Manual Intake form configuration from Airtable..." />;
  }

  if (optionsError || !optionSets) {
    return <ErrorSurface title="Unable to load Manual Intake" message={optionsError ?? 'The Airtable form configuration is unavailable.'} />;
  }

  return (
    <div className="flex w-full flex-col gap-5">
      {submitError ? (
        <div className="rounded-xl border border-[#f7c8c4] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {submitError}
        </div>
      ) : null}

      {submitSuccess ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {submitSuccess}
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        {isEditMode && recordSource === 'used-gear-workflow' && workflowSource ? (
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Workflow Source</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--ink)]">
                <span className="inline-flex rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                  {workflowSource}
                </span>
                {jotFormSubmissionId ? (
                  <span className="text-[var(--muted)]">Submission ID: <span className="font-medium text-[var(--ink)]">{jotFormSubmissionId}</span></span>
                ) : null}
              </div>
              {workflowSource === 'JotForm' && jotFormSubmissionUrl ? (
                <a
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  href={jotFormSubmissionUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in JotForm
                </a>
              ) : null}
            </div>
          </section>
        ) : null}

        {isEditMode ? (
          manualIntakeFormFields.map((group) => {
            if (Array.isArray(group)) {
              return (
                <div key={`${group[0].name}-${group[1].name}`} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {group.map((field) => (
                    <FieldShell key={field.name} definition={field}>
                      {renderField(field, editFieldValues[field.name], (nextValue) => {
                        setEditFieldValue(field.name as keyof ManualIntakeFormValues, nextValue as ManualIntakeFormValues[keyof ManualIntakeFormValues]);
                      }, optionSets)}
                    </FieldShell>
                  ))}
                </div>
              );
            }

            return (
              <div key={group.name}>
                <FieldShell definition={group}>
                  {renderField(group, editFieldValues[group.name], (nextValue) => {
                    setEditFieldValue(group.name as keyof ManualIntakeFormValues, nextValue as ManualIntakeFormValues[keyof ManualIntakeFormValues]);
                  }, optionSets)}
                </FieldShell>
              </div>
            );
          })
        ) : (
          <>
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
              <div className="space-y-5">
                {sharedFieldGroups.map((group) => {
                  if (Array.isArray(group)) {
                    return (
                      <div key={`${group[0].name}-${group[1].name}`} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {group.map((field) => (
                          <FieldShell key={field.name} definition={field}>
                            {renderField(field, sharedFieldValues[field.name], (nextValue) => {
                              setSharedFieldValue(field.name as keyof ManualIntakeSharedFormValues, nextValue as ManualIntakeSharedFormValues[keyof ManualIntakeSharedFormValues]);
                            }, optionSets)}
                          </FieldShell>
                        ))}
                      </div>
                    );
                  }

                  return (
                    <div key={group.name}>
                      <FieldShell definition={group}>
                        {renderField(group, sharedFieldValues[group.name], (nextValue) => {
                          setSharedFieldValue(group.name as keyof ManualIntakeSharedFormValues, nextValue as ManualIntakeSharedFormValues[keyof ManualIntakeSharedFormValues]);
                        }, optionSets)}
                      </FieldShell>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
              <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="mt-1 text-xl font-semibold text-[var(--ink)]">Intake Items</h2>
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  onClick={addItemCard}
                  disabled={submitting}
                >
                  Add Another Item
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {itemValues.map((itemValue, itemIndex) => (
                  <article key={`manual-intake-item-${itemIndex}`} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/40 p-4">
                    <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Item {itemIndex + 1}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          aria-expanded={!collapsedItemIndexes.includes(itemIndex)}
                          aria-controls={`grouped-item-body-${itemIndex}`}
                          onClick={() => toggleItemCollapsed(itemIndex)}
                          disabled={submitting}
                        >
                          {collapsedItemIndexes.includes(itemIndex) ? 'Expand' : 'Collapse'}
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          onClick={() => duplicateItemCard(itemIndex)}
                          disabled={submitting}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => removeItemCard(itemIndex)}
                          disabled={submitting || itemValues.length === 1}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {groupedItemErrors[itemIndex] ? (
                      <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                        {groupedItemErrors[itemIndex]}
                      </div>
                    ) : null}

                    {!collapsedItemIndexes.includes(itemIndex) ? (
                      <div id={`grouped-item-body-${itemIndex}`} className="mt-5 space-y-5">
                        {itemFieldGroups.map((group) => {
                          const itemFieldValues = itemValue as unknown as FieldValueMap;

                          if (Array.isArray(group)) {
                            return (
                              <div key={`${itemIndex}-${group[0].name}-${group[1].name}`} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                {group.map((field) => (
                                  <FieldShell key={field.name} definition={field}>
                                    {renderField(field, itemFieldValues[field.name], (nextValue) => {
                                      setItemFieldValue(itemIndex, field.name as keyof ManualIntakeItemFormValues, nextValue as ManualIntakeItemFormValues[keyof ManualIntakeItemFormValues]);
                                    }, optionSets)}
                                  </FieldShell>
                                ))}
                              </div>
                            );
                          }

                          return (
                            <div key={`${itemIndex}-${group.name}`}>
                              <FieldShell definition={group}>
                                {renderField(group, itemFieldValues[group.name], (nextValue) => {
                                  setItemFieldValue(itemIndex, group.name as keyof ManualIntakeItemFormValues, nextValue as ManualIntakeItemFormValues[keyof ManualIntakeItemFormValues]);
                                }, optionSets)}
                              </FieldShell>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  onClick={addItemCard}
                  disabled={submitting}
                >
                  Add Another Item
                </button>
              </div>
            </section>
          </>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={() => {
                clearSubmissionState();
                if (isEditMode) {
                  setEditFormValues(initialEditFormValues);
                } else {
                  resetGroupedFormValues();
                }
              }}
              disabled={submitting}
            >
              Reset
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Intake' : 'Create Intake')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
