"use client";
import { NETWORK_PROFILES } from "@/types/NetworkProfile";

interface NetworkSelectorProps {
  selectedProfile: string;
  onProfileChange: (profile: string) => void;
  isUploading: boolean;
  isDark: boolean;
}

export function NetworkSelector({ selectedProfile, onProfileChange, isUploading, isDark }: NetworkSelectorProps) {
  return (
    <div className={`backdrop-blur-xl rounded-xl border p-4 transition-all duration-300 ${
      isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-cyan-200'
    }`}>
      <label className={`block text-sm font-medium mb-3 transition-colors duration-300 ${
        isDark ? 'text-cyan-300' : 'text-cyan-700'
      }`}>
        Network Simulator
      </label>
      <select
        value={selectedProfile}
        onChange={(e) => onProfileChange(e.target.value)}
        disabled={isUploading}
        className={`w-full px-4 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          isDark
            ? 'bg-slate-800/50 border-white/20 text-white focus:ring-cyan-500/50'
            : 'bg-white border-cyan-300 text-cyan-900 focus:ring-cyan-400'
        }`}
      >
        {Object.values(NETWORK_PROFILES).map(profile => (
          <option key={profile.name} value={profile.name}>
            {profile.label}
          </option>
        ))}
      </select>
    </div>
  );
}
