import type { ReactNode } from 'react';
import { IntakeSnapshotSection, type IntakeSnapshotCard, type IntakeSnapshotField } from '@/components/tabs/IntakeSnapshotSection';

export interface WorkflowFormSnapshotValues {
  cost?: string;
  sku: string;
  make: string;
  model: string;
  componentType: string;
  originalBox: string;
  manual: string;
  remote: string;
  powerCable: string;
  additionalItems: string;
  audiogonRating: string;
}

export interface WorkflowFormSnapshotSectionProps {
  values: WorkflowFormSnapshotValues;
  customerCosmeticNotes: string;
  inventoryNotes: string;
  omittedFieldKeys?: Array<keyof WorkflowFormSnapshotValues>;
  extraCards?: IntakeSnapshotCard[];
  className?: string;
  title?: string;
  children?: ReactNode;
}

const BASE_SNAPSHOT_FIELDS: Array<{
  label: string;
  key: keyof WorkflowFormSnapshotValues;
  description?: string;
}> = [
  { label: 'Cost', key: 'cost' },
  { label: 'SKU', key: 'sku' },
  { label: 'Make', key: 'make' },
  { label: 'Model', key: 'model' },
  { label: 'Component Type', key: 'componentType' },
  { label: 'Original Box', key: 'originalBox' },
  { label: 'Manual', key: 'manual' },
  { label: 'Remote', key: 'remote' },
  { label: 'Power Cable', key: 'powerCable' },
  { label: 'Additional Items', key: 'additionalItems' },
  { label: 'Audiogon Rating', key: 'audiogonRating' },
];

export function WorkflowFormSnapshotSection({
  values,
  customerCosmeticNotes,
  inventoryNotes,
  omittedFieldKeys = [],
  extraCards = [],
  className,
  title,
  children,
}: WorkflowFormSnapshotSectionProps) {
  const omittedFieldSet = new Set(omittedFieldKeys);
  const fields: IntakeSnapshotField[] = BASE_SNAPSHOT_FIELDS
    .filter((field) => !omittedFieldSet.has(field.key))
    .map((field) => ({
      label: field.label,
      value: values[field.key] ?? '',
      description: field.description,
    }));

  return (
    <IntakeSnapshotSection
      fields={fields}
      cards={[
        { title: 'Customer Cosmetic Notes', value: customerCosmeticNotes, emptyValue: 'None provided' },
        { title: 'Inventory Notes', value: inventoryNotes, emptyValue: 'No inventory notes available.' },
        ...extraCards,
      ]}
      className={className}
      title={title}
    >
      {children}
    </IntakeSnapshotSection>
  );
}