import { CompressionSettings } from "./CompressionToggle";
import { NetworkSelector } from "./NetworkSelector";
import { CompressionToggle } from "./CompressionToggle";

interface UploadControlsProps {
  selectedProfile: string;
  onProfileChange: (profile: string) => void;
  file: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  compressionSettings: CompressionSettings;
  onCompressionChange: (settings: CompressionSettings) => void;
  workers: number;
  isUploading: boolean;
  isDark: boolean;
}

export function UploadControls({
  selectedProfile,
  onProfileChange,
  file,
  onFileChange,
  compressionSettings,
  onCompressionChange,
  workers,
  isUploading,
  isDark
}: UploadControlsProps) {
  return (
    <div className="space-y-6">
      {/* <NetworkSelector
        selectedProfile={selectedProfile}
        onProfileChange={onProfileChange}
        isUploading={isUploading}
        isDark={isDark}
      /> */}

      <CompressionToggle
        file={file}
        settings={compressionSettings}
        onSettingsChange={onCompressionChange}
        isDark={isDark}
        isUploading={isUploading}
      />
    </div>
  );
}
