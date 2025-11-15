import { Priority } from "@/types/UploadMetrics";
import { CompressionSettings } from "./CompressionToggle";
import { NetworkSelector } from "./NetworkSelector";
import { PrioritySelector } from "./PrioritySelector";
import { CompressionToggle } from "./CompressionToggle";
import { ParallelToggle } from "./ParallelToggle";

interface UploadControlsProps {
  selectedProfile: string;
  onProfileChange: (profile: string) => void;
  priority: Priority;
  onPriorityChange: (priority: Priority) => void;
  file: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  compressionSettings: CompressionSettings;
  onCompressionChange: (settings: CompressionSettings) => void;
  parallel: boolean;
  onParallelToggle: () => void;
  workers: number;
  isUploading: boolean;
  isDark: boolean;
}

export function UploadControls({
  selectedProfile,
  onProfileChange,
  priority,
  onPriorityChange,
  file,
  onFileChange,
  compressionSettings,
  onCompressionChange,
  parallel,
  onParallelToggle,
  workers,
  isUploading,
  isDark
}: UploadControlsProps) {
  return (
    <div className="space-y-6">
      <NetworkSelector
        selectedProfile={selectedProfile}
        onProfileChange={onProfileChange}
        isUploading={isUploading}
        isDark={isDark}
      />

      <PrioritySelector
        priority={priority}
        onPriorityChange={onPriorityChange}
        isUploading={isUploading}
        isDark={isDark}
      />

      <CompressionToggle
        file={file}
        settings={compressionSettings}
        onSettingsChange={onCompressionChange}
        isDark={isDark}
        isUploading={isUploading}
      />

      <ParallelToggle
        parallel={parallel}
        workers={workers}
        onToggle={onParallelToggle}
        isDark={isDark}
      />
    </div>
  );
}
