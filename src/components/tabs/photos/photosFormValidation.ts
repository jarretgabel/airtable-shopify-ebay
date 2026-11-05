import type { PhotosFormStageContext } from '@/services/photosForm';
import type { PhotosFormValues } from '@/components/tabs/photos/photosFormSchema';

export type PhotosSubmitIntent = 'save' | 'complete';

export type InclusionConfirmationKey = 'originalBox' | 'manual' | 'remote' | 'powerCable' | 'additionalItems';

export interface InclusionConfirmationItem {
  key: InclusionConfirmationKey;
  label: string;
  value: string;
}

function isApplicableIncludedValue(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) {
    return false;
  }

  return !['no', 'none', 'n/a', 'na', 'not included', 'missing'].includes(normalizedValue);
}

export function buildApplicableIncludedItems(values: PhotosFormValues): InclusionConfirmationItem[] {
  const candidateItems: InclusionConfirmationItem[] = [
    { key: 'originalBox', label: 'Original Box', value: values.originalBox },
    { key: 'manual', label: 'Manual', value: values.manual },
    { key: 'remote', label: 'Remote', value: values.remote },
    { key: 'powerCable', label: 'Power Cable', value: values.powerCable },
    { key: 'additionalItems', label: 'Additional Items', value: values.additionalItems },
  ];

  return candidateItems.filter((item) => isApplicableIncludedValue(item.value));
}

export function validatePhotosForm(
  values: PhotosFormValues,
  stageContext: PhotosFormStageContext,
  inclusionConfirmations: Partial<Record<InclusionConfirmationKey, boolean>>,
  submitIntent: PhotosSubmitIntent,
  imagesProcessing: boolean,
): string | null {
  if (!values.sku.trim()) return 'SKU is required.';
  if (!values.make.trim()) return 'Make is required.';
  if (!values.model.trim()) return 'Model is required.';
  if (!values.componentType.trim()) return 'Component Type is required.';
  if (!values.photoDate.trim()) return 'Photo Date is required.';
  if (imagesProcessing) return 'Wait for image processing to finish before saving Photos.';
  if (values.imageFiles.length === 0 && stageContext.existingAttachments.length === 0) {
    return 'Upload at least one image before submitting the Photos form.';
  }

  if (submitIntent !== 'complete') {
    return null;
  }

  const applicableIncludedItems = buildApplicableIncludedItems(values);
  const missingConfirmations = applicableIncludedItems
    .filter((item) => !inclusionConfirmations[item.key])
    .map((item) => item.label);

  if (missingConfirmations.length > 0) {
    return `Confirm that the following included items were checked and photographed: ${missingConfirmations.join(', ')}.`;
  }

  return null;
}
