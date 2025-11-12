"use client";
import { Signal } from "lucide-react";
import { NetworkProfile } from "@/types/NetworkProfile";

interface NetworkStatusProps {
  profile: NetworkProfile;
  isDark: boolean;
}

export function NetworkStatus({ profile, isDark }: NetworkStatusProps) {
  const getStatusColor = () => {
    switch (profile.color) {
      case "green": return isDark ? "text-green-400 bg-green-500/20 border-green-500/30" : "text-green-600 bg-green-100 border-green-300";
      case "yellow": return isDark ? "text-yellow-400 bg-yellow-500/20 border-yellow-500/30" : "text-yellow-600 bg-yellow-100 border-yellow-300";
      case "red": return isDark ? "text-red-400 bg-red-500/20 border-red-500/30" : "text-red-600 bg-red-100 border-red-300";
      default: return isDark ? "text-cyan-400 bg-cyan-500/20 border-cyan-500/30" : "text-cyan-600 bg-cyan-100 border-cyan-300";
    }
  };

  return (
    <div className={`flex items-center justify-between p-4 backdrop-blur-xl rounded-xl border transition-all duration-300 ${getStatusColor()}`}>
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <Signal className="w-5 h-5" />
        </div>
        <div>
          <p className="font-semibold text-sm">{profile.speed}</p>
          <p className="text-xs opacity-80">
            Latency: {profile.delay}ms • Loss: {profile.failureRate}%
          </p>
        </div>
      </div>
    </div>
  );
}
