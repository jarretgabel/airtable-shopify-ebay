export type ProcessingFormOptionFieldName =
  | 'Status'
  | 'Component Type'
  | 'Shipping Method';

export interface ProcessingFormValues {
  sku: string;
  arrivalDate: string;
  acquiredFrom: string;
  make: string;
  model: string;
  componentType: string;
  status: string;
  inventoryNotes: string;
  imageFiles: File[];
}

export type ProcessingFormFieldType =
  | 'text'
  | 'date'
  | 'textarea'
  | 'select'
  | 'searchable-select'
  | 'file';

export interface ProcessingFormFieldDefinition {
  name: keyof ProcessingFormValues;
  airtableFieldName: string;
  label: string;
  type: ProcessingFormFieldType;
  required?: boolean;
  placeholder?: string;
  description?: string;
  optionFieldName?: ProcessingFormOptionFieldName;
  rows?: number;
}

export function createProcessingFormDefaults(): ProcessingFormValues {
  return {
    sku: '',
    arrivalDate: '',
    acquiredFrom: '',
    make: '',
    model: '',
    componentType: '',
    status: '',
    inventoryNotes: '',
    imageFiles: [],
  };
}

export const processingFormFields: ProcessingFormFieldDefinition[] = [
  {
    name: 'sku',
    airtableFieldName: 'SKU',
    label: 'SKU',
    type: 'text',
    required: true,
  },
  {
    name: 'arrivalDate',
    airtableFieldName: 'Arrival Date',
    label: 'Arrival Date',
    type: 'date',
  },
  {
    name: 'acquiredFrom',
    airtableFieldName: 'Acquired From',
    label: 'Acquired From',
    type: 'text',
  },
  {
    name: 'make',
    airtableFieldName: 'Make',
    label: 'Make',
    type: 'text',
    required: true,
  },
  {
    name: 'model',
    airtableFieldName: 'Model',
    label: 'Model',
    type: 'text',
    required: true,
  },
  {
    name: 'componentType',
    airtableFieldName: 'Component Type',
    label: 'Component Type',
    type: 'searchable-select',
    optionFieldName: 'Component Type',
    required: true,
  },
  {
    name: 'status',
    airtableFieldName: 'Status',
    label: 'Status',
    type: 'select',
    optionFieldName: 'Status',
    required: true,
  },
  {
    name: 'inventoryNotes',
    airtableFieldName: 'Inventory Notes',
    label: 'Inventory Notes',
    type: 'textarea',
    rows: 4,
  },
  {
    name: 'imageFiles',
    airtableFieldName: 'Images (Eduardo)',
    label: 'Images',
    type: 'file',
    description: 'Upload one or more images.',
  },
];