import type { JotFormAnswer, JotFormSubmission } from './client.js';
import {
  buildUsedGearIntakeBaseFields,
  buildUsedGearWorkflowFields,
} from '../../shared/contracts/usedGearIntakeFields.js';
import { buildUsedGearItemTitle } from '../../shared/contracts/usedGearItemTitle.js';

export interface NormalizedJotFormWorkflowItem {
  submissionId: string;       // per-slot unique ID used for Airtable upsert idempotency
  submissionGroupId: string;  // always submission.id — groups all slots from the same submission
  airtableFields: Record<string, unknown>;
  imageUrls: string[];
}

// The StereoBuyers JotForm has 10 pre-built item slots.
// Each slot is a separate page with the same fields but different question `name` values.
// The user steps through slots by answering "Add more equipment to sell?" = Yes.
// Slots without data appear in the API response but have no `answer` field.
//
// Slot display order (slot 1 = first item the user fills):
//   Slot 1  → order range 40-49  (brand243, model244, …)
//   Slot 2  → order range 50-59  (brand234, model235, …)
//   Slot 3  → order range 60-69  (brand225, model226, …)
//   Slot 4  → order range 70-79  (brand216, model217, …)
//   Slot 5  → order range 80-89  (brand207, model208, …)
//   Slot 6  → order range 90-99  (brand198, model199, …)
//   Slot 7  → order range 100-109 (brand189, model190, …)
//   Slot 8  → order range 110-119 (brand180, model181, …)
//   Slot 9  → order range 120-129 (brand, model, …)
//   Slot 10 → order range 130-139 (typeA13, typeA15, …) — oldest questions
interface ItemSlotDescriptor {
  slotIndex: number;
  brand: string;
  model: string;
  cosmeticCondition: string;
  anyIssues: string;
  pictures: string;
  originalOwner: string;
  originalPackaging: string;
  exposureTo: string;
}

const ITEM_SLOTS: readonly ItemSlotDescriptor[] = [
  // eslint-disable-next-line max-len
  { slotIndex: 1,  brand: 'brand243', model: 'model244', cosmeticCondition: 'cosmeticCondition247', anyIssues: 'anyIssues250', pictures: 'pictures249',  originalOwner: 'originalOwner245',  originalPackaging: 'originalPackaging246', exposureTo: 'exposureTo'     },
  { slotIndex: 2,  brand: 'brand234', model: 'model235', cosmeticCondition: 'cosmeticCondition238', anyIssues: 'anyIssues241', pictures: 'pictures240',  originalOwner: 'originalOwner236',  originalPackaging: 'originalPackaging237', exposureTo: 'exposureTo239'  },
  { slotIndex: 3,  brand: 'brand225', model: 'model226', cosmeticCondition: 'cosmeticCondition229', anyIssues: 'anyIssues232', pictures: 'pictures231',  originalOwner: 'originalOwner227',  originalPackaging: 'originalPackaging228', exposureTo: 'exposureTo230'  },
  { slotIndex: 4,  brand: 'brand216', model: 'model217', cosmeticCondition: 'cosmeticCondition220', anyIssues: 'anyIssues223', pictures: 'pictures222',  originalOwner: 'originalOwner218',  originalPackaging: 'originalPackaging219', exposureTo: 'exposureTo221'  },
  { slotIndex: 5,  brand: 'brand207', model: 'model208', cosmeticCondition: 'cosmeticCondition211', anyIssues: 'anyIssues214', pictures: 'pictures213',  originalOwner: 'originalOwner209',  originalPackaging: 'originalPackaging210', exposureTo: 'exposureTo212'  },
  { slotIndex: 6,  brand: 'brand198', model: 'model199', cosmeticCondition: 'cosmeticCondition202', anyIssues: 'anyIssues205', pictures: 'pictures204',  originalOwner: 'originalOwner200',  originalPackaging: 'originalPackaging201', exposureTo: 'exposureTo203'  },
  { slotIndex: 7,  brand: 'brand189', model: 'model190', cosmeticCondition: 'cosmeticCondition193', anyIssues: 'anyIssues196', pictures: 'pictures195',  originalOwner: 'originalOwner191',  originalPackaging: 'originalPackaging192', exposureTo: 'exposureTo194'  },
  { slotIndex: 8,  brand: 'brand180', model: 'model181', cosmeticCondition: 'cosmeticCondition184', anyIssues: 'anyIssues187', pictures: 'pictures186',  originalOwner: 'originalOwner182',  originalPackaging: 'originalPackaging183', exposureTo: 'exposureTo185'  },
  { slotIndex: 9,  brand: 'brand',    model: 'model',    cosmeticCondition: 'cosmeticCondition',    anyIssues: 'anyIssues178', pictures: 'pictures',     originalOwner: 'originalOwner173',  originalPackaging: 'originalPackaging',    exposureTo: 'exposureTo176'  },
  // Slot 10 note: JotForm question name='originalOwner' has text "Original packaging?" (naming quirk in original form build)
  { slotIndex: 10, brand: 'typeA13',  model: 'typeA15',  cosmeticCondition: 'typeA26',              anyIssues: 'anyIssues',    pictures: 'fileUpload',   originalOwner: 'typeA23',           originalPackaging: 'originalOwner',        exposureTo: 'typeA28'        },
];

function toAnswerString(answer: JotFormAnswer): string {
  // prettyFormat is the highest-quality human-readable string JotForm provides (e.g. full name joins).
  if (answer.prettyFormat?.trim()) {
    return answer.prettyFormat.trim();
  }

  const rawValue = answer.answer;

  if (typeof rawValue === 'string') {
    return rawValue.trim();
  }

  if (Array.isArray(rawValue)) {
    return rawValue
      .map((entry) => String(entry).trim())
      .filter(Boolean)
      .join(', ');
  }

  if (rawValue && typeof rawValue === 'object') {
    return Object.values(rawValue)
      .map((entry) => String(entry).trim())
      .filter(Boolean)
      .join(' ');
  }

  return '';
}

// Look up an answer by its JotForm question `name` and return its string value.
function getAnswerByName(answers: Record<string, JotFormAnswer>, name: string): string {
  const answer = Object.values(answers).find((a) => a.name === name);
  return answer ? toAnswerString(answer) : '';
}

// Collect image URLs from a slot's file upload question.
function collectSlotImageUrls(answers: Record<string, JotFormAnswer>, picturesFieldName: string): string[] {
  const answer = Object.values(answers).find((a) => a.name === picturesFieldName);
  if (!answer) return [];

  const rawValue = answer.answer;
  const values = Array.isArray(rawValue)
    ? rawValue
    : typeof rawValue === 'string'
      ? [rawValue]
      : [];

  return values
    .map((v) => String(v).trim())
    .filter((v) => v.startsWith('http://') || v.startsWith('https://'));
}

export function mapJotFormSubmissionToWorkflowItems(submission: JotFormSubmission): NormalizedJotFormWorkflowItem[] {
  const answers = submission.answers ?? {};

  // Shared fields — filled once per submission and copied onto every item row.
  const acquiredFrom = getAnswerByName(answers, 'name') || undefined;
  const customerInclusionNotes = getAnswerByName(answers, 'anythingMore161') || undefined;
  const sellerEmail = getAnswerByName(answers, 'email') || undefined;
  const sellerPhone = getAnswerByName(answers, 'typeA19') || undefined;
  const sellerZipCode = getAnswerByName(answers, 'zipCode') || undefined;
  const sellerLocation = getAnswerByName(answers, 'whereAre') || undefined;
  const howDidYouHear = getAnswerByName(answers, 'typeA162') || undefined;
  // joinOur is a checkbox — treat any non-empty answer as opted in.
  const joinOurRaw = getAnswerByName(answers, 'joinOur');
  const mailingListOptIn = joinOurRaw ? true : undefined;

  // All items from the same submission share a group ID so staff can view them together.
  const submissionGroupId = submission.id;

  const items: NormalizedJotFormWorkflowItem[] = [];

  for (const slot of ITEM_SLOTS) {
    const brand = getAnswerByName(answers, slot.brand);
    const model = getAnswerByName(answers, slot.model);

    // A slot is active only if the user entered a brand or model.
    if (!brand && !model) {
      continue;
    }

    const cosmeticCondition = getAnswerByName(answers, slot.cosmeticCondition) || undefined;
    const anyIssues = getAnswerByName(answers, slot.anyIssues) || undefined;
    const originalOwner = getAnswerByName(answers, slot.originalOwner) || undefined;
    const originalPackaging = getAnswerByName(answers, slot.originalPackaging) || undefined;
    const smokeExposure = getAnswerByName(answers, slot.exposureTo) || undefined;
    const imageUrls = collectSlotImageUrls(answers, slot.pictures);

    // Per-slot ID ensures each Airtable row is idempotently upsertable.
    const slotSubmissionId = `${submission.id}-slot${slot.slotIndex}`;

    const airtableFields = {
      ...buildUsedGearIntakeBaseFields({
        acquiredFrom,
        make: brand || undefined,
        model: model || undefined,
        // Cosmetic condition dropdown value becomes the customer cosmetic notes field.
        customerCosmeticNotes: cosmeticCondition,
        // "Any issues? Anything else included?" maps to customer functional notes.
        customerFunctionalNotes: anyIssues,
        // "Anything more you'd like us to know?" maps to customer inclusion notes.
        customerInclusionNotes,
        originalBox: originalPackaging,
        originalOwner,
        smokeExposure,
        sellerEmail,
        sellerPhone,
        sellerZipCode,
        sellerLocation,
        howDidYouHear,
        mailingListOptIn,
      }),
      ...buildUsedGearWorkflowFields({
        workflowSource: 'JotForm',
        workflowStatus: 'Pending Review',
        submissionGroupId,
        qualificationComplete: false,
        jotFormSubmissionId: slotSubmissionId,
      }),
      'Item Title': buildUsedGearItemTitle({
        make: brand || undefined,
        model: model || undefined,
        jotFormSubmissionId: slotSubmissionId,
        submissionGroupId,
      }),
    };

    items.push({
      submissionId: slotSubmissionId,
      submissionGroupId,
      airtableFields,
      imageUrls,
    });
  }

  return items;
}
