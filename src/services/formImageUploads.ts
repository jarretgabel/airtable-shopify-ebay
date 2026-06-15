import type { WorkflowImageRole } from '@/services/workflowImageMetadata';

export interface FormImageUploadAsset {
  originalFile: File;
  uploadFile: File;
  imageRole?: WorkflowImageRole;
  customImageRole?: string;
  altText?: string;
}
