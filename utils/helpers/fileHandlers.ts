import { Priority } from "@/types/UploadMetrics";

interface FileChangeHandlers {
  setFile: (file: File | null) => void;
  setProgress: (progress: number) => void;
  setDownloadLink: (link: string) => void;
  setUploadTime: (time: string) => void;
  setUploadedChunks: (chunks: number) => void;
  setMetrics: React.Dispatch<React.SetStateAction<any>>;
  setCostComparison: (comparison: null) => void;
  setPriority: (priority: Priority) => void;
}

export function handleFileChange(
  e: React.ChangeEvent<HTMLInputElement>,
  handlers: FileChangeHandlers
) {
  handlers.setFile(e.target.files?.[0] || null);
  handlers.setProgress(0);
  handlers.setDownloadLink("");
  handlers.setUploadTime("");
  handlers.setUploadedChunks(0);
  handlers.setMetrics({
    successfulChunks: 0,
    failedRetries: 0,
    startTime: 0,
    bandwidth: 0,
    totalBytes: 0,
    wastedBytes: 0
  });
  handlers.setCostComparison(null);
  
  const savedPriority = localStorage.getItem('upload-priority') as Priority | null;
  if (savedPriority && ['high', 'medium', 'low'].includes(savedPriority)) {
    handlers.setPriority(savedPriority);
  }
}
