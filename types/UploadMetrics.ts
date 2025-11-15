export interface UploadMetrics {
  successfulChunks: number;
  failedRetries: number;
  startTime: number;
  endTime?: number;
  bandwidth: number;
  totalBytes: number;
  wastedBytes: number;
}

export interface CostComparison {
  traditionalCost: number;
  aetherLinkCost: number;
  savings: number;
  savingsPercentage: number;
  wastedMultiplier: number;
}

export const COST_PER_MB = 0.09; // $0.09 per MB (AWS S3 pricing)
export const WASTED_MULTIPLIER = 3.5; // 3.5x due to retries/failures in traditional uploads
