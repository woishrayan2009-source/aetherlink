import { formatBytes } from "@/utils/helpers/file";

interface CancelDialogProps {
  show: boolean;
  uploadedChunks: number;
  totalChunks: number;
  progress: number;
  chunkSize: number;
  isDark: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function CancelDialog({
  show,
  uploadedChunks,
  totalChunks,
  progress,
  chunkSize,
  isDark,
  onConfirm,
  onDismiss
}: CancelDialogProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`max-w-md w-full rounded-2xl border shadow-2xl transition-all duration-300 ${
        isDark
          ? 'bg-slate-900/95 border-red-500/30'
          : 'bg-white/95 border-red-300'
      }`}>
        <div className={`p-6 border-b ${isDark ? 'border-red-500/20' : 'border-red-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isDark ? 'bg-red-500/20' : 'bg-red-100'
            }`}>
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Cancel Upload?
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {uploadedChunks} of {totalChunks} chunks uploaded
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Are you sure you want to cancel this upload? Your progress will be lost and you&apos;ll need to start over.
          </p>

          <div className={`p-4 rounded-lg ${
            isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <p className={`text-xs ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
              <strong>⚡ Progress:</strong> {progress}% complete ({formatBytes(uploadedChunks * chunkSize)} uploaded)
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onDismiss}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                isDark
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300'
              }`}
            >
              Continue Upload
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                isDark
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              Yes, Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
