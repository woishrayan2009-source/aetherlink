interface CancelledMessageProps {
  isDark: boolean;
}

export function CancelledMessage({ isDark }: CancelledMessageProps) {
  return (
    <div className={`backdrop-blur-xl border rounded-2xl p-6 space-y-4 transition-all duration-300 ${
      isDark
        ? 'bg-linear-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/30'
        : 'bg-linear-to-br from-yellow-100 to-orange-100 border-yellow-300'
    }`}>
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 backdrop-blur-sm rounded-xl flex items-center justify-center border transition-all duration-300 ${
          isDark ? 'bg-yellow-500/30 border-yellow-400/40' : 'bg-yellow-200 border-yellow-400'
        }`}>
          <span className="text-2xl">⚠️</span>
        </div>
        <div>
          <p className={`font-semibold transition-colors duration-300 ${
            isDark ? 'text-yellow-400' : 'text-yellow-700'
          }`}>Upload Cancelled</p>
          <p className={`text-sm transition-colors duration-300 ${
            isDark ? 'text-yellow-300/70' : 'text-yellow-600'
          }`}>Upload was stopped by user</p>
        </div>
      </div>
    </div>
  );
}
