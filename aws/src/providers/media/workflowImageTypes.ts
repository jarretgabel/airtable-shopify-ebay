export type WorkflowImageArchiveStage = 'intake' | 'testing' | 'photos';

interface WorkflowImageArchiveFilePayload {
  filename: string;
  contentType: string;
  file: string;
}

export interface WorkflowImageArchiveRequest {
  folderKey: string;
  stage: WorkflowImageArchiveStage;
  original: WorkflowImageArchiveFilePayload;
  processed: WorkflowImageArchiveFilePayload;
}

export interface ArchivedWorkflowImageFile {
  id: string;
  filename: string;
  url: string;
}

export interface WorkflowImageArchiveResult {
  folderId: string;
  original: ArchivedWorkflowImageFile;
  processed: ArchivedWorkflowImageFile;
}
