export type IncomingGearFormOptionFieldName =
  | 'Status'
  | 'Component Type'
  | 'Original Box'
  | 'Manual'
  | 'Remote'
  | 'Power Cable'
  | 'Shipping Method';

export interface IncomingGearFormValues {
  arrivalDate: string;
  pickUpNumber: string;
  acquiredFrom: string;
  cost: string;
  sku: string;
  status: string;
  make: string;
  model: string;
  componentType: string;
  serialNumber: string;
  voltage: string;
  inventoryNotes: string;
  imageFiles: File[];
  cosmeticConditionNotes: string;
  originalBox: string;
  manual: string;
  remote: string;
  powerCable: string;
  additionalItems: string;
  weight: string;
  shippingDims: string;
  shippingMethod: string;
}

export type IncomingGearFormFieldType = 'text' | 'date' | 'currency' | 'textarea' | 'select' | 'searchable-select' | 'file';

export interface IncomingGearFormFieldDefinition {
  name: keyof IncomingGearFormValues;
  airtableFieldName: string;
  label: string;
  type: IncomingGearFormFieldType;
  required?: boolean;
  placeholder?: string;
  description?: string;
  optionFieldName?: IncomingGearFormOptionFieldName;
  rows?: number;
}

export interface IncomingGearFormIntroBlock {
  type: 'body' | 'lead' | 'labelBody' | 'sectionHeading' | 'divider';
  text?: string;
  label?: string;
  body?: string;
}

export function createIncomingGearFormDefaults(): IncomingGearFormValues {
  return {
    arrivalDate: new Date().toISOString().slice(0, 10),
    pickUpNumber: '',
    acquiredFrom: '',
    cost: '',
    sku: '',
    status: 'Needs Initial Processing',
    make: '',
    model: '',
    componentType: '',
    serialNumber: '',
    voltage: '',
    inventoryNotes: '',
    imageFiles: [],
    cosmeticConditionNotes: '',
    originalBox: '',
    manual: '',
    remote: '',
    powerCable: '',
    additionalItems: '',
    weight: '',
    shippingDims: '',
    shippingMethod: '',
  };
}

export const incomingGearFormIntro: {
  eyebrow: string;
  title: string;
  blocks: IncomingGearFormIntroBlock[];
} = {
  eyebrow: 'SB Inventory',
  title: 'Incoming Gear Form',
  blocks: [
    {
      type: 'lead',
      text: 'New gear is entered into the StereoBuyers Inventory System one of two ways:',
    },
    {
      type: 'labelBody',
      label: 'SB Quote Request Form:',
      body: 'Filled and submitted by potential clients. If a deal is accepted, submitted details are routed into inventory with a "Waiting for Item" status and can be found in the "Incoming Gear" view.',
    },
    {
      type: 'labelBody',
      label: 'This form:',
      body: 'For items from deals put together outside of the quote request form (phone deals, return clients, etc)',
    },
    {
      type: 'body',
      text: 'Filling this form is the initial step in processing gear into the SB inventory system and subsequent sales channels (Shopify/RAV & eBay).',
    },
    {
      type: 'body',
      text: 'When filling, PLEASE BE MINDFUL of clean, consistent data entry.. spelling, capitalization, punctuation, accurate model number presentation, component types, etc. The majority of the information entered here is ultimately on display in the final sales listings. What you enter is what our customers will see. Check with Ed if you feel unclear about any of the entry standards.',
    },
    {
      type: 'sectionHeading',
      text: 'Generally speaking, this form will be filled out in one of two contexts:',
    },
    {
      type: 'labelBody',
      label: 'PRE-PROCESSING',
      body: 'of accepted gear that was not formally submitted through our StereoBuyers.com Quote Request form and/or has not yet physically arrived (Status: Waiting for Unit). At the time of this writing, Ed generally handles all Pre-Processing. Details obtained from the seller ("Acquired From" Field) regarding functionality, cosmetic condition, inclusions/exclusions are provided in the "Inventory Notes" field. These details are typically accurate, but sometimes need to be corrected or clarified upon receipt of the item (for example, a seller will state "Original Box" included, but upon arrival it is found to be in poor or unusable condition).',
    },
    {
      type: 'divider',
      text: 'OR',
    },
    {
      type: 'labelBody',
      label: 'ACTIVE-PROCESSING',
      body: 'of gear that has physically arrived and needs to be assigned a SKU and prepped for testing (Status: Ready to Test). Active-Processing is often just giving a SKU and confirming the details provided by Ed in Pre-Processing before staging it to be tested. Sometimes gear will physically arrive with no Pre-Processing performed. This form will be used to assign a SKU and get it entered in from scratch. Refer to associated Pick Up Receipt for price paid and related details.',
    },
  ],
};

export const incomingGearFormFields: IncomingGearFormFieldDefinition[] = [
  {
    name: 'arrivalDate',
    airtableFieldName: 'Arrival Date',
    label: 'Arrival Date',
    type: 'date',
    required: true,
  },
  {
    name: 'pickUpNumber',
    airtableFieldName: 'Pick Up #',
    label: 'Pick Up #',
    type: 'text',
  },
  {
    name: 'acquiredFrom',
    airtableFieldName: 'Acquired From',
    label: 'Acquired From',
    type: 'text',
    placeholder: 'Seller name or acquisition source',
  },
  {
    name: 'cost',
    airtableFieldName: 'Cost',
    label: 'Cost',
    type: 'currency',
    placeholder: '1500',
  },
  {
    name: 'sku',
    airtableFieldName: 'SKU',
    label: 'SKU',
    type: 'text',
    description: 'Leave blank to auto-generate an intake SKU.',
  },
  {
    name: 'status',
    airtableFieldName: 'Status',
    label: 'Status',
    type: 'select',
    optionFieldName: 'Status',
  },
  {
    name: 'make',
    airtableFieldName: 'Make',
    label: 'Make',
    type: 'text',
    required: true,
    placeholder: 'McIntosh',
  },
  {
    name: 'model',
    airtableFieldName: 'Model',
    label: 'Model',
    type: 'text',
    required: true,
    placeholder: 'MC275',
  },
  {
    name: 'componentType',
    airtableFieldName: 'Component Type',
    label: 'Component Type',
    type: 'searchable-select',
    required: true,
    optionFieldName: 'Component Type',
    description: 'Start typing to search, then choose a single component type.',
  },
  {
    name: 'serialNumber',
    airtableFieldName: 'Serial Number',
    label: 'Serial Number',
    type: 'text',
    placeholder: 'AGY1016',
  },
  {
    name: 'voltage',
    airtableFieldName: 'Voltage',
    label: 'Voltage',
    type: 'text',
    placeholder: '120V 60Hz',
  },
  {
    name: 'inventoryNotes',
    airtableFieldName: 'Inventory Notes',
    label: 'Inventory Notes',
    type: 'textarea',
    rows: 4,
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
    description: 'Upload one or more images.',
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
    placeholder: 'Adapters, spare tubes, feet, jumpers, packaging inserts...',
  },
  {
    name: 'weight',
    airtableFieldName: 'Weight',
    label: 'Weight',
    type: 'text',
    placeholder: '35 lbs',
  },
  {
    name: 'shippingDims',
    airtableFieldName: 'Shipping Dims',
    label: 'Shipping Dimensions',
    type: 'text',
    placeholder: '27x25x11',
  },
  {
    name: 'shippingMethod',
    airtableFieldName: 'Shipping Method',
    label: 'Shipping Method',
    type: 'select',
    optionFieldName: 'Shipping Method',
  },
];
