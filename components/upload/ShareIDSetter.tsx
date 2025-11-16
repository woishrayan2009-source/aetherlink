"use client";
import { Key, RefreshCw, Info } from "lucide-react";
import { useState } from "react";

interface ShareIDSetterProps {
  shareId: string;
  onShareIdChange: (id: string) => void;
  isDark: boolean;
  disabled?: boolean;
}

export function ShareIDSetter({ shareId, onShareIdChange, isDark, disabled }: ShareIDSetterProps) {
  const [isCustom, setIsCustom] = useState(false);

  const generateRandomId = () => {
    // Generate 32-character hex string (same as backend)
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const hex = Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    onShareIdChange(hex);
    setIsCustom(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    onShareIdChange(value);
    setIsCustom(true);
  };

  return (
    <div className={`backdrop-blur-sm rounded-xl p-4 border transition-all duration-300 ${
      isDark 
        ? 'bg-slate-900/50 border-white/10' 
        : 'bg-white/60 border-slate-300'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Key className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          <p className={`text-sm font-medium transition-colors duration-300 ${
            isDark ? 'text-purple-400' : 'text-purple-700'
          }`}>
            Share ID (Optional)
          </p>
        </div>
        <button
          onClick={generateRandomId}
          disabled={disabled}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all duration-300 ${
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : isDark
              ? 'bg-purple-500/30 hover:bg-purple-500/40 text-purple-300'
              : 'bg-purple-200 hover:bg-purple-300 text-purple-700'
          }`}
        >
          <RefreshCw className="w-3 h-3" />
          Generate
        </button>
      </div>

      <input
        type="text"
        value={shareId}
        onChange={handleInputChange}
        disabled={disabled}
        placeholder="Auto-generated or enter custom ID..."
        className={`w-full px-3 py-2 rounded-lg text-sm font-mono border transition-all duration-300 ${
          isDark
            ? 'bg-slate-800/70 border-white/10 text-slate-200 placeholder:text-slate-500'
            : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />

      <div className={`mt-2 flex items-start gap-2 text-xs transition-colors duration-300 ${
        isDark ? 'text-slate-400' : 'text-slate-600'
      }`}>
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          {isCustom && shareId ? (
            <>Using custom Share ID: <span className="font-mono text-purple-400">{shareId.slice(0, 12)}...</span></>
          ) : shareId ? (
            <>Generated Share ID will be used</>
          ) : (
            <>A random Share ID will be auto-generated if left empty</>
          )}
        </p>
      </div>
    </div>
  );
}
