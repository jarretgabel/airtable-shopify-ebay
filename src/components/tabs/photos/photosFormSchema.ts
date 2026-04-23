export type PhotosFormOptionFieldName =
  | 'Status'
  | 'Component Type'
  | 'Audiogon Rating'
  | 'Original Box'
  | 'Manual'
  | 'Remote'
  | 'Power Cable';

export interface PhotosFormValues {
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
  cosmeticConditionNotes: string;
  imageFiles: File[];
  photoDate: string;
  status: string;
}

export type PhotosFormFieldType = 'text' | 'date' | 'textarea' | 'select' | 'searchable-select' | 'file';

export interface PhotosFormFieldDefinition {
  name: keyof PhotosFormValues;
  airtableFieldName: string;
  label: string;
  type: PhotosFormFieldType;
  required?: boolean;
  placeholder?: string;
  description?: string;
  optionFieldName?: PhotosFormOptionFieldName;
  rows?: number;
}

export function createPhotosFormDefaults(): PhotosFormValues {
  return {
    sku: '',
    make: '',
    model: '',
    componentType: '',
    originalBox: '',
    manual: '',
    remote: '',
    powerCable: '',
    additionalItems: '',
    audiogonRating: '',
    cosmeticConditionNotes: '',
    imageFiles: [],
    photoDate: new Date().toISOString().slice(0, 10),
    status: "Photo'd",
  };
}

export const photosFormFields: PhotosFormFieldDefinition[] = [
  {
    name: 'sku',
    airtableFieldName: 'SKU',
    label: 'SKU',
    type: 'text',
    required: true,
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
    description: 'Start typing to search, then choose a single component type.',
  },
  {
    name: 'originalBox',
    airtableFieldName: 'Original Box',
    label: 'Original Box',
    type: 'select',
    optionFieldName: 'Original Box',
  },
  {
    name: 'manual',
    airtableFieldName: 'Manual',
    label: 'Manual',
    type: 'select',
    optionFieldName: 'Manual',
  },
  {
    name: 'remote',
    airtableFieldName: 'Remote',
    label: 'Remote',
    type: 'select',
    optionFieldName: 'Remote',
  },
  {
    name: 'powerCable',
    airtableFieldName: 'Power Cable',
    label: 'Power Cable',
    type: 'select',
    optionFieldName: 'Power Cable',
  },
  {
    name: 'additionalItems',
    airtableFieldName: 'Additional Items',
    label: 'Additional Items',
    type: 'textarea',
    rows: 3,
  },
  {
    name: 'audiogonRating',
    airtableFieldName: 'Audiogon Rating',
    label: 'Audiogon Rating',
    type: 'select',
    optionFieldName: 'Audiogon Rating',
  },
  {
    name: 'cosmeticConditionNotes',
    airtableFieldName: 'Cosmetic Condition Notes',
    label: 'Cosmetic Notes',
    type: 'textarea',
    rows: 4,
  },
  {
    name: 'imageFiles',
    airtableFieldName: 'Images (Eduardo)',
    label: 'Images',
    type: 'file',
    description: 'Upload the primary listing photos.',
  },
  {
    name: 'photoDate',
    airtableFieldName: "Photo'd",
    label: 'Photo Date',
    type: 'date',
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
];