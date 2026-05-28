import { APP_PAGES, type AppPage } from '@/auth/pages';
import {
  DEFAULT_WORKFLOW_GUIDE_CONTENT,
  type GuideStep,
  type PageGuideCard,
  type QuickAnswer,
  type RecordGuideCard,
  type RoleGuide,
  type RoleStartPoint,
  type WorkflowFlowStage,
  type WorkflowGuideContent,
} from '@/components/tabs/workflowGuideContent';
import { getConfiguredRecords, updateConfiguredRecord } from '@/services/app-api/airtable';
import type { UserRole } from '@/stores/auth/authTypes';
import type { AirtableRecord } from '@/types/airtable';

export type UserGuideContentType = 'role-guide' | 'workflow-rule' | 'workflow-stage' | 'page-guide' | 'record-guide' | 'role-start-point';

export interface UserGuideEditableField {
  name: string;
  label: string;
  multiline: boolean;
}

export interface UserGuideEditableRecord {
  id: string;
  name: string;
  contentKey: string;
  contentType: UserGuideContentType;
  sortOrder: number;
  fieldValues: Record<string, string>;
}

export interface WorkflowGuideContentResult {
  content: WorkflowGuideContent;
  editableRecords: UserGuideEditableRecord[];
  source: 'airtable' | 'default';
}

const USER_ROLES = Object.keys(DEFAULT_WORKFLOW_GUIDE_CONTENT.roleGuides) as UserRole[];
const PAGE_SET = new Set<AppPage>(APP_PAGES);
const USER_ROLE_SET = new Set<UserRole>(USER_ROLES);
const CONTENT_TYPE_SET = new Set<UserGuideContentType>([
  'role-guide',
  'workflow-rule',
  'workflow-stage',
  'page-guide',
  'record-guide',
  'role-start-point',
]);

const ROLE_GUIDE_EDITABLE_FIELDS: UserGuideEditableField[] = [
  { name: 'Role Summary', label: 'Role Summary', multiline: true },
  { name: 'Quick Start Title', label: 'Quick Start Title', multiline: false },
  { name: 'Quick Start Summary', label: 'Quick Start Summary', multiline: true },
  { name: 'Quick Start Item 1', label: 'Quick Start Item 1', multiline: true },
  { name: 'Quick Start Item 2', label: 'Quick Start Item 2', multiline: true },
  { name: 'Quick Start Item 3', label: 'Quick Start Item 3', multiline: true },
  { name: 'Flow Summary', label: 'Flow Summary', multiline: true },
  { name: 'Flow Step 1 Title', label: 'Flow Step 1 Title', multiline: false },
  { name: 'Flow Step 1 Detail', label: 'Flow Step 1 Detail', multiline: true },
  { name: 'Flow Step 2 Title', label: 'Flow Step 2 Title', multiline: false },
  { name: 'Flow Step 2 Detail', label: 'Flow Step 2 Detail', multiline: true },
  { name: 'Flow Step 3 Title', label: 'Flow Step 3 Title', multiline: false },
  { name: 'Flow Step 3 Detail', label: 'Flow Step 3 Detail', multiline: true },
  { name: 'Flow Step 4 Title', label: 'Flow Step 4 Title', multiline: false },
  { name: 'Flow Step 4 Detail', label: 'Flow Step 4 Detail', multiline: true },
  { name: 'Question 1', label: 'Question 1', multiline: true },
  { name: 'Answer 1', label: 'Answer 1', multiline: true },
  { name: 'Question 2', label: 'Question 2', multiline: true },
  { name: 'Answer 2', label: 'Answer 2', multiline: true },
];

const USER_GUIDE_EDITABLE_FIELDS: Record<UserGuideContentType, UserGuideEditableField[]> = {
  'role-guide': ROLE_GUIDE_EDITABLE_FIELDS,
  'workflow-rule': [
    { name: 'Summary', label: 'Rule Title', multiline: false },
    { name: 'Detail', label: 'Rule Detail', multiline: true },
  ],
  'workflow-stage': [
    { name: 'Summary', label: 'Stage Title', multiline: false },
    { name: 'Detail', label: 'Stage Detail', multiline: true },
  ],
  'page-guide': [
    { name: 'Name', label: 'Card Title', multiline: false },
    { name: 'Summary', label: 'Card Summary', multiline: true },
    { name: 'Module 1', label: 'Module 1', multiline: true },
    { name: 'Module 2', label: 'Module 2', multiline: true },
    { name: 'Module 3', label: 'Module 3', multiline: true },
    { name: 'Module 4', label: 'Module 4', multiline: true },
    { name: 'Workflow Use 1', label: 'Use It For 1', multiline: true },
    { name: 'Workflow Use 2', label: 'Use It For 2', multiline: true },
    { name: 'Workflow Use 3', label: 'Use It For 3', multiline: true },
  ],
  'record-guide': [
    { name: 'Name', label: 'Card Title', multiline: false },
    { name: 'Summary', label: 'Card Summary', multiline: true },
    { name: 'Surface 1', label: 'Surface 1', multiline: true },
    { name: 'Surface 2', label: 'Surface 2', multiline: true },
    { name: 'Surface 3', label: 'Surface 3', multiline: true },
    { name: 'Workflow Use 1', label: 'Use It For 1', multiline: true },
    { name: 'Workflow Use 2', label: 'Use It For 2', multiline: true },
    { name: 'Workflow Use 3', label: 'Use It For 3', multiline: true },
  ],
  'role-start-point': [
    { name: 'Summary', label: 'Start Card Title', multiline: false },
    { name: 'Detail', label: 'Start Card Detail', multiline: true },
  ],
};

function readStringField(fields: Record<string, unknown>, fieldName: string, fallback = ''): string {
  const value = fields[fieldName];
  return typeof value === 'string' ? value : fallback;
}

function readNumberField(fields: Record<string, unknown>, fieldName: string, fallback = 0): number {
  const value = fields[fieldName];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  return fallback;
}

function readPages(fields: Record<string, unknown>): AppPage[] {
  return ['Page 1', 'Page 2', 'Page 3']
    .map((fieldName) => readStringField(fields, fieldName).trim())
    .filter((value): value is AppPage => PAGE_SET.has(value as AppPage));
}

function readRoles(fields: Record<string, unknown>, prefix: 'Primary Role' | 'Support Role'): UserRole[] {
  return [1, 2, 3, 4]
    .map((index) => readStringField(fields, `${prefix} ${index}`).trim())
    .filter((value): value is UserRole => USER_ROLE_SET.has(value as UserRole));
}

function readListFields(fields: Record<string, unknown>, fieldNames: string[], fallback: string[]): string[] {
  const values = fieldNames.map((fieldName) => readStringField(fields, fieldName).trim()).filter(Boolean);
  return values.length > 0 ? values : fallback;
}

function normalizeContentType(value: string, fallback: UserGuideContentType): UserGuideContentType {
  return CONTENT_TYPE_SET.has(value as UserGuideContentType) ? value as UserGuideContentType : fallback;
}

function normalizeStageTone(value: string, fallback: WorkflowFlowStage['tone']): WorkflowFlowStage['tone'] {
  if (value === 'intake' || value === 'decision' || value === 'routing' || value === 'specialist' || value === 'publish' || value === 'follow-through') {
    return value;
  }
  return fallback;
}

function normalizeWorkflowStagePages(pages: AppPage[], fallback: WorkflowFlowStage): AppPage[] {
  if (fallback.title === 'Pre-List And Publish') {
    return pages.filter((page) => page === 'listings');
  }

  return pages;
}

function stripNamePrefix(value: string, prefix: string, fallback: string): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return fallback;
  }
  if (!trimmedValue.startsWith(prefix)) {
    return trimmedValue;
  }
  const strippedValue = trimmedValue.slice(prefix.length).trim();
  return strippedValue || fallback;
}

function buildGuideStep(record: AirtableRecord | null, fallback: GuideStep): GuideStep {
  const fields = record?.fields ?? {};
  return {
    title: readStringField(fields, 'Summary', fallback.title),
    detail: readStringField(fields, 'Detail', fallback.detail),
  };
}

function buildQuickAnswers(fields: Record<string, unknown>, fallback: QuickAnswer[]): QuickAnswer[] {
  return fallback.map((item, index) => ({
    question: readStringField(fields, `Question ${index + 1}`, item.question),
    answer: readStringField(fields, `Answer ${index + 1}`, item.answer),
  }));
}

function buildRoleGuide(record: AirtableRecord | null, fallback: RoleGuide): RoleGuide {
  const fields = record?.fields ?? {};
  return {
    roleSummary: readStringField(fields, 'Role Summary', fallback.roleSummary),
    quickStartTitle: readStringField(fields, 'Quick Start Title', fallback.quickStartTitle),
    quickStartSummary: readStringField(fields, 'Quick Start Summary', fallback.quickStartSummary),
    quickStartItems: readListFields(fields, ['Quick Start Item 1', 'Quick Start Item 2', 'Quick Start Item 3'], fallback.quickStartItems),
    flowSummary: readStringField(fields, 'Flow Summary', fallback.flowSummary),
    flowSteps: fallback.flowSteps.map((item, index) => ({
      title: readStringField(fields, `Flow Step ${index + 1} Title`, item.title),
      detail: readStringField(fields, `Flow Step ${index + 1} Detail`, item.detail),
    })),
    questions: buildQuickAnswers(fields, fallback.questions),
  };
}

function buildPageGuideCard(record: AirtableRecord | null, fallback: PageGuideCard): PageGuideCard {
  const fields = record?.fields ?? {};
  const pages = readPages(fields);
  return {
    title: stripNamePrefix(readStringField(fields, 'Name', fallback.title), 'Page - ', fallback.title),
    pages: pages.length > 0 ? pages : fallback.pages,
    summary: readStringField(fields, 'Summary', fallback.summary),
    modules: readListFields(fields, ['Module 1', 'Module 2', 'Module 3', 'Module 4'], fallback.modules),
    workflows: readListFields(fields, ['Workflow Use 1', 'Workflow Use 2', 'Workflow Use 3'], fallback.workflows),
  };
}

function buildRecordGuideCard(record: AirtableRecord | null, fallback: RecordGuideCard): RecordGuideCard {
  const fields = record?.fields ?? {};
  const pages = readPages(fields);
  return {
    title: stripNamePrefix(readStringField(fields, 'Name', fallback.title), 'Record - ', fallback.title),
    pages: pages.length > 0 ? pages : fallback.pages,
    summary: readStringField(fields, 'Summary', fallback.summary),
    surfaces: readListFields(fields, ['Surface 1', 'Surface 2', 'Surface 3'], fallback.surfaces),
    workflows: readListFields(fields, ['Workflow Use 1', 'Workflow Use 2', 'Workflow Use 3'], fallback.workflows),
  };
}

function buildWorkflowStage(record: AirtableRecord | null, fallback: WorkflowFlowStage): WorkflowFlowStage {
  const fields = record?.fields ?? {};
  const pages = normalizeWorkflowStagePages(readPages(fields), fallback);
  const primaryRoles = readRoles(fields, 'Primary Role');
  const supportRoles = readRoles(fields, 'Support Role');

  return {
    title: readStringField(fields, 'Summary', fallback.title),
    detail: readStringField(fields, 'Detail', fallback.detail),
    pages: pages.length > 0 ? pages : fallback.pages,
    tone: normalizeStageTone(readStringField(fields, 'Tone', fallback.tone), fallback.tone),
    primaryRoles: primaryRoles.length > 0 ? primaryRoles : fallback.primaryRoles,
    supportRoles: supportRoles.length > 0 ? supportRoles : fallback.supportRoles,
  };
}

function buildRoleStartPoint(record: AirtableRecord | null, fallback: RoleStartPoint): RoleStartPoint {
  const fields = record?.fields ?? {};
  const pages = readPages(fields);
  return {
    page: pages[0] ?? fallback.page,
    title: readStringField(fields, 'Summary', fallback.title),
    detail: readStringField(fields, 'Detail', fallback.detail),
  };
}

function buildEditableFieldValues(record: AirtableRecord, contentType: UserGuideContentType): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of USER_GUIDE_EDITABLE_FIELDS[contentType]) {
    values[field.name] = readStringField(record.fields, field.name);
  }
  if (contentType === 'page-guide' || contentType === 'record-guide') {
    values.Name = readStringField(record.fields, 'Name');
  }
  return values;
}

function sortEditableRecords(left: UserGuideEditableRecord, right: UserGuideEditableRecord): number {
  return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);
}

export function getUserGuideEditableFields(contentType: UserGuideContentType): UserGuideEditableField[] {
  return USER_GUIDE_EDITABLE_FIELDS[contentType];
}

export function buildWorkflowGuideContentFromRecords(records: AirtableRecord[]): WorkflowGuideContent {
  const recordsByKey = new Map(
    records
      .map((record) => [readStringField(record.fields, 'Content Key'), record] as const)
      .filter(([contentKey]) => contentKey.trim().length > 0),
  );

  return {
    roleGuides: Object.fromEntries(
      USER_ROLES.map((role) => [role, buildRoleGuide(recordsByKey.get(`role-guide.${role}`) ?? null, DEFAULT_WORKFLOW_GUIDE_CONTENT.roleGuides[role])]),
    ) as Record<UserRole, RoleGuide>,
    advancementRules: DEFAULT_WORKFLOW_GUIDE_CONTENT.advancementRules.map((item, index) => buildGuideStep(recordsByKey.get(`workflow-rule.${String(index + 1).padStart(2, '0')}`) ?? null, item)),
    flowStages: DEFAULT_WORKFLOW_GUIDE_CONTENT.flowStages.map((item, index) => buildWorkflowStage(recordsByKey.get(`workflow-stage.${String(index + 1).padStart(2, '0')}`) ?? null, item)),
    pageCards: DEFAULT_WORKFLOW_GUIDE_CONTENT.pageCards.map((item, index) => buildPageGuideCard(recordsByKey.get(`page-guide.${String(index + 1).padStart(2, '0')}`) ?? null, item)),
    recordCards: DEFAULT_WORKFLOW_GUIDE_CONTENT.recordCards.map((item, index) => buildRecordGuideCard(recordsByKey.get(`record-guide.${String(index + 1).padStart(2, '0')}`) ?? null, item)),
    roleStartPoints: Object.fromEntries(
      USER_ROLES.map((role) => [
        role,
        DEFAULT_WORKFLOW_GUIDE_CONTENT.roleStartPoints[role].map((item, index) => buildRoleStartPoint(recordsByKey.get(`role-start-point.${role}.${String(index + 1).padStart(2, '0')}`) ?? null, item)),
      ]),
    ) as Record<UserRole, RoleStartPoint[]>,
  };
}

export function buildUserGuideEditableRecords(records: AirtableRecord[]): UserGuideEditableRecord[] {
  return records
    .map((record) => {
      const contentType = normalizeContentType(readStringField(record.fields, 'Content Type'), 'workflow-rule');
      return {
        id: record.id,
        name: readStringField(record.fields, 'Name') || readStringField(record.fields, 'Content Key'),
        contentKey: readStringField(record.fields, 'Content Key'),
        contentType,
        sortOrder: readNumberField(record.fields, 'Sort Order', Number.MAX_SAFE_INTEGER),
        fieldValues: buildEditableFieldValues(record, contentType),
      };
    })
    .filter((record) => record.contentKey.trim().length > 0)
    .sort(sortEditableRecords);
}

export async function loadWorkflowGuideContent(): Promise<WorkflowGuideContentResult> {
  try {
    const records = await getConfiguredRecords('user-guide');
    if (records.length === 0) {
      return {
        content: DEFAULT_WORKFLOW_GUIDE_CONTENT,
        editableRecords: [],
        source: 'default',
      };
    }

    return {
      content: buildWorkflowGuideContentFromRecords(records),
      editableRecords: buildUserGuideEditableRecords(records),
      source: 'airtable',
    };
  } catch {
    return {
      content: DEFAULT_WORKFLOW_GUIDE_CONTENT,
      editableRecords: [],
      source: 'default',
    };
  }
}

export async function updateWorkflowGuideRecord(recordId: string, fields: Record<string, string>): Promise<void> {
  const payload = Object.fromEntries(
    Object.entries(fields).map(([fieldName, value]) => {
      const trimmedValue = value.trim();
      if (fieldName === 'Name') {
        return [fieldName, trimmedValue || 'Untitled guide row'];
      }
      return [fieldName, trimmedValue || null];
    }),
  );

  await updateConfiguredRecord('user-guide', recordId, payload, { typecast: true });
}