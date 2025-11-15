interface UploadButtonProps {
  file: File | null;
  isUploading: boolean;
  isCompressing: boolean;
  compressionProgress: number;
  progress: number;
  onUpload: () => void;
  isDark: boolean;
}

export function UploadButton({
  file,
  isUploading,
  isCompressing,
  compressionProgress,
  progress,
  onUpload,
  isDark
}: UploadButtonProps) {
  const disabled = !file || isUploading;

  const getButtonText = () => {
    if (isCompressing) return `Compressing... ${compressionProgress}%`;
    if (isUploading) return `Uploading... ${progress}%`;
    return 'Start Upload';
  };

  return (
    <button
      disabled={disabled}
      onClick={onUpload}
      className={`w-full font-semibold py-4 rounded-xl backdrop-blur-xl border shadow-lg transition-all duration-300 ${
        disabled
          ? isDark
            ? "bg-slate-700 border-slate-600 text-slate-400 cursor-not-allowed"
            : "bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed"
          : isDark
            ? "bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 border-white/10 text-white"
            : "bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 border-cyan-600 text-white"
      }`}
    >
      <span>{getButtonText()}</span>
    </button>
  );
}
