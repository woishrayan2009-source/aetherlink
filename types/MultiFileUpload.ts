import { UploadMetrics, CostComparison } from "./UploadMetrics";
import { NetworkProfile } from "./NetworkProfile";

export interface FileUploadState {
  file: File;
  uploadId: string;
  shareId: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  uploadedChunks: number;
  totalChunks: number;
  metrics: UploadMetrics;
  downloadLink?: string;
  uploadTime?: string;
  costComparison?: CostComparison;
  error?: string;
  activeWorkers: number;
  startTime?: number;
}

export interface MultiFileUploadState {
  files: FileUploadState[];
  isUploading: boolean;
  completedCount: number;
  failedCount: number;
  totalFiles: number;
  overallProgress: number;
}

export interface MultiFileUploadCallbacks {
  onFileComplete?: (fileState: FileUploadState) => void;
  onFileError?: (fileState: FileUploadState, error: string) => void;
  onAllComplete?: (results: FileUploadState[]) => void;
  onProgressUpdate?: (state: MultiFileUploadState) => void;
}
