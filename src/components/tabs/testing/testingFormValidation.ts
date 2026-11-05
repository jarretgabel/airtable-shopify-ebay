import type { TestingFormValues } from '@/components/tabs/testing/testingFormSchema';

export function validateTestingForm(values: TestingFormValues): string | null {
  if (!values.sku.trim()) return 'SKU is required.';
  if (!values.make.trim()) return 'Make is required.';
  if (!values.model.trim()) return 'Model is required.';
  if (!values.componentType.trim()) return 'Component Type is required.';
  if (!values.testingNotes.trim()) return 'Testing Notes is required.';
  if (!values.testingTimeMinutes.trim()) return 'Testing Time is required.';
  if (!values.serviceTimeMinutes.trim()) return 'Service Time is required.';
  if (!values.testingDate.trim()) return 'Testing Date is required.';
  return null;
}
