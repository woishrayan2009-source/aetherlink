interface CancelButtonProps {
  onClick: () => void;
  isDark: boolean;
}

export function CancelButton({ onClick, isDark }: CancelButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full font-semibold py-4 rounded-xl backdrop-blur-xl border shadow-lg transition-all duration-300 ${
        isDark
          ? "bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 border-red-500/50 text-white"
          : "bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border-red-600 text-white"
      }`}
    >
      <span className="flex items-center justify-center gap-2">
        <span>❌</span>
        <span>Cancel Upload</span>
      </span>
    </button>
  );
}
