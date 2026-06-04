export type ManualIntakeFormOptionFieldName =
  | 'Component Type'
  | 'Original Box'
  | 'Manual'
  | 'Remote'
  | 'Power Cable'
  | 'Shipping Method'
  | 'Seller Location'
  | 'How Did You Hear'
  | 'Original Owner'
  | 'Smoke Exposure';

export interface ManualIntakeFormValues {
  pickUpNumber: string;
  sellerFirstName: string;
  sellerLastName: string;
  cost: string;
  customerCosmeticNotes: string;
  customerFunctionalNotes: string;
  customerInclusionNotes: string;
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
  sellerEmail: string;
  sellerPhone: string;
  sellerZipCode: string;
  sellerLocation: string;
  howDidYouHear: string;
  originalOwner: string;
  smokeExposure: string;
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
  halfWidth?: boolean;
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
    sellerFirstName: '',
    sellerLastName: '',
    cost: '',
    customerCosmeticNotes: '',
    customerFunctionalNotes: '',
    customerInclusionNotes: '',
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
    sellerEmail: '',
    sellerPhone: '',
    sellerZipCode: '',
    sellerLocation: '',
    howDidYouHear: '',
    originalOwner: '',
    smokeExposure: '',
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
    airtableFieldName: 'Pick Up ID',
    label: 'Pick Up ID',
    type: 'text',
  },
  {
    name: 'sellerFirstName',
    airtableFieldName: 'Acquired From',
    label: 'Seller First Name',
    type: 'text',
    placeholder: 'Adam',
    halfWidth: true,
  },
  {
    name: 'sellerLastName',
    airtableFieldName: 'Acquired From',
    label: 'Seller Last Name',
    type: 'text',
    placeholder: 'Wexler',
    halfWidth: true,
  },
  {
    name: 'sellerEmail',
    airtableFieldName: 'Seller Email',
    label: 'Seller Email',
    type: 'text',
    placeholder: 'seller@example.com',
    halfWidth: true,
  },
  {
    name: 'sellerPhone',
    airtableFieldName: 'Seller Phone',
    label: 'Seller Phone',
    type: 'text',
    placeholder: '(212) 555-1234',
    halfWidth: true,
  },
  {
    name: 'sellerZipCode',
    airtableFieldName: 'Seller Zip Code',
    label: 'Seller Zip Code',
    type: 'text',
    placeholder: '10001',
    halfWidth: true,
  },
  {
    name: 'sellerLocation',
    airtableFieldName: 'Seller Location',
    label: 'Seller Location',
    type: 'select',
    optionFieldName: 'Seller Location',
    halfWidth: true,
  },
  {
    name: 'howDidYouHear',
    airtableFieldName: 'How Did You Hear',
    label: 'How Did You Hear',
    type: 'select',
    optionFieldName: 'How Did You Hear',
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
  {
    name: 'originalOwner',
    airtableFieldName: 'Original Owner',
    label: 'Original Owner',
    type: 'select',
    optionFieldName: 'Original Owner',
    description: 'Is the seller the original owner of this item?',
  },
  {
    name: 'smokeExposure',
    airtableFieldName: 'Smoke Exposure',
    label: 'Smoke Exposure',
    type: 'select',
    optionFieldName: 'Smoke Exposure',
  },
];