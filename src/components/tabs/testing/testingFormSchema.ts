export type TestingFormOptionFieldName =
  | 'Status'
  | 'Component Type'
  | 'Original Box'
  | 'Manual'
  | 'Remote'
  | 'Power Cable'
  | 'Shipping Method';

export interface TestingFormValues {
  sku: string;
  arrivalDate: string;
  acquiredFrom: string;
  make: string;
  model: string;
  componentType: string;
  cost: string;
  inventoryNotes: string;
  serialNumber: string;
  voltage: string;
  audiogonRating: string;
  cosmeticConditionNotes: string;
  originalBox: string;
  manual: string;
  remote: string;
  powerCable: string;
  additionalItems: string;
  shippingWeight: string;
  shippingDims: string;
  shippingMethod: string;
  imageFiles: File[];
  testingNotes: string;
  testingTimeMinutes: string;
  serviceNotes: string;
  serviceTimeMinutes: string;
  testingDate: string;
  status: string;
}

export type TestingFormFieldType = 'text' | 'date' | 'currency' | 'textarea' | 'select' | 'searchable-select' | 'number' | 'file';

export interface TestingFormFieldDefinition {
  name: keyof TestingFormValues;
  airtableFieldName: string;
  label: string;
  type: TestingFormFieldType;
  required?: boolean;
  placeholder?: string;
  description?: string;
  optionFieldName?: TestingFormOptionFieldName;
  rows?: number;
}

export function createTestingFormDefaults(): TestingFormValues {
  return {
    sku: '',
    arrivalDate: '',
    acquiredFrom: '',
    make: '',
    model: '',
    componentType: '',
    cost: '',
    inventoryNotes: '',
    serialNumber: '',
    voltage: '',
    audiogonRating: '',
    cosmeticConditionNotes: '',
    originalBox: '',
    manual: '',
    remote: '',
    powerCable: '',
    additionalItems: '',
    shippingWeight: '',
    shippingDims: '',
    shippingMethod: '',
    imageFiles: [],
    testingNotes: '',
    testingTimeMinutes: '',
    serviceNotes: '',
    serviceTimeMinutes: '',
    testingDate: '',
    status: '',
  };
}

export const testingFormFields: TestingFormFieldDefinition[] = [
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
    description: 'Start typing to search, then choose a single component type.',
  },
  {
    name: 'cost',
    airtableFieldName: 'Cost',
    label: 'Cost',
    type: 'currency',
  },
  {
    name: 'inventoryNotes',
    airtableFieldName: 'Inventory Notes',
    label: 'Inventory Notes',
    type: 'textarea',
    rows: 4,
  },
  {
    name: 'serialNumber',
    airtableFieldName: 'Serial Number',
    label: 'Serial Number',
    type: 'text',
  },
  {
    name: 'voltage',
    airtableFieldName: 'Voltage',
    label: 'Voltage',
    type: 'text',
  },
  {
    name: 'audiogonRating',
    airtableFieldName: 'Audiogon Rating',
    label: 'Audiogon Rating',
    type: 'text',
  },
  {
    name: 'cosmeticConditionNotes',
    airtableFieldName: 'Cosmetic Condition Notes',
    label: 'Cosmetic Notes',
    type: 'textarea',
    rows: 4,
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
    name: 'shippingWeight',
    airtableFieldName: 'Shipping Weight',
    label: 'Shipping Weight',
    type: 'text',
  },
  {
    name: 'shippingDims',
    airtableFieldName: 'Shipping Dims',
    label: 'Shipping Dimensions',
    type: 'text',
  },
  {
    name: 'shippingMethod',
    airtableFieldName: 'Shipping Method',
    label: 'Shipping Method',
    type: 'select',
    optionFieldName: 'Shipping Method',
  },
  {
    name: 'imageFiles',
    airtableFieldName: 'Images (Eduardo)',
    label: 'Images',
    type: 'file',
    description: 'Upload one or more images.',
  },
  {
    name: 'testingNotes',
    airtableFieldName: 'Testing Notes',
    label: 'Testing Notes',
    type: 'textarea',
    rows: 5,
  },
  {
    name: 'testingTimeMinutes',
    airtableFieldName: 'Testing Time',
    label: 'Testing Time',
    type: 'number',
    description: 'Enter total testing time in minutes.',
  },
  {
    name: 'serviceNotes',
    airtableFieldName: 'Service Notes',
    label: 'Service Notes',
    type: 'textarea',
    rows: 4,
  },
  {
    name: 'serviceTimeMinutes',
    airtableFieldName: 'Service Time',
    label: 'Service Time',
    type: 'number',
    description: 'Enter total service time in minutes.',
  },
  {
    name: 'testingDate',
    airtableFieldName: 'Tested',
    label: 'Testing Date',
    type: 'date',
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
