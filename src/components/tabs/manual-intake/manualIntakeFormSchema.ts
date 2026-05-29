export type ManualIntakeFormOptionFieldName =
  | 'Status'
  | 'Component Type'
  | 'Original Box'
  | 'Manual'
  | 'Remote'
  | 'Power Cable'
  | 'Shipping Method';

export interface ManualIntakeFormValues {
  pickUpNumber: string;
  acquiredFrom: string;
  cost: string;
  customerCosmeticNotes: string;
  customerFunctionalNotes: string;
  customerInclusionNotes: string;
  customerSubmittedPhotosNotes: string;
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

export type ManualIntakeFormFieldType = 'text' | 'date' | 'currency' | 'textarea' | 'select' | 'searchable-select' | 'file';

export interface ManualIntakeFormFieldDefinition {
  name: keyof ManualIntakeFormValues;
  airtableFieldName: string;
  label: string;
  type: ManualIntakeFormFieldType;
  required?: boolean;
  placeholder?: string;
  description?: string;
  optionFieldName?: ManualIntakeFormOptionFieldName;
  rows?: number;
}

export interface ManualIntakeFormIntroBlock {
  type: 'body' | 'lead' | 'labelBody' | 'sectionHeading' | 'divider';
  text?: string;
  label?: string;
  body?: string;
}

export function createManualIntakeFormDefaults(): ManualIntakeFormValues {
  return {
    pickUpNumber: '',
    acquiredFrom: '',
    cost: '',
    customerCosmeticNotes: '',
    customerFunctionalNotes: '',
    customerInclusionNotes: '',
    customerSubmittedPhotosNotes: '',
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

export const manualIntakeFormIntro: {
  eyebrow: string;
  title: string;
  blocks: ManualIntakeFormIntroBlock[];
} = {
  eyebrow: 'SB Inventory',
  title: 'Manual Intake Form',
  blocks: [
    {
      type: 'lead',
      text: 'New gear is entered into the StereoBuyers Inventory System one of two ways:',
    },
    {
      type: 'labelBody',
      label: 'SB Quote Request Form:',
      body: 'Filled and submitted by potential clients. If a deal is accepted, submitted details are routed into inventory with a "Waiting for Item" status and can be found in the "JotForm" and "Parking Lot" intake workflow views.',
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
      body: 'of gear that has physically arrived and needs to be confirmed and prepped for testing (Status: Ready to Test). Active-Processing is often confirming the details provided by Ed in Pre-Processing before staging it to be tested. Sometimes gear will physically arrive with no Pre-Processing performed. This form will be used to get it entered in from scratch. Refer to associated Pick Up Receipt for price paid and related details.',
    },
  ],
};

export const manualIntakeFormFields: ManualIntakeFormFieldDefinition[] = [
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
    name: 'customerCosmeticNotes',
    airtableFieldName: 'Customer Cosmetic Notes',
    label: 'Customer Cosmetic Notes',
    type: 'textarea',
    rows: 3,
    description: 'Seller-reported cosmetic details captured at intake time.',
  },
  {
    name: 'customerFunctionalNotes',
    airtableFieldName: 'Customer Functional Notes',
    label: 'Customer Functional Notes',
    type: 'textarea',
    rows: 3,
    description: 'Seller-reported functional behavior, issues, or testing claims.',
  },
  {
    name: 'customerInclusionNotes',
    airtableFieldName: 'Customer Inclusion Notes',
    label: 'Customer Inclusion Notes',
    type: 'textarea',
    rows: 3,
    description: 'Seller-reported inclusions and exclusions such as remotes, boxes, or accessories.',
  },
  {
    name: 'customerSubmittedPhotosNotes',
    airtableFieldName: 'Customer Submitted Photos Notes',
    label: 'Customer Submitted Photos Notes',
    type: 'textarea',
    rows: 3,
    description: 'Reference notes about photos provided by the seller during intake.',
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
    airtableFieldName: 'Testing Cosmetic Notes',
    label: 'Cosmetic Notes',
    type: 'textarea',
    rows: 4,
  },
  {
    name: 'imageFiles',
    airtableFieldName: 'Images',
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