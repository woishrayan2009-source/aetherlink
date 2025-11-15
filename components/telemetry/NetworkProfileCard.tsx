"use client";
import { useMemo, useEffect, useState, useRef } from 'react';
import { NetworkStatusSnapshot } from '@/types/TelemetryMetrics';

interface NetworkProfileCardProps {
  networkHistory: NetworkStatusSnapshot[];
  isNetworkDegraded: boolean;
  currentConcurrency: number;
  isDark: boolean;
}

export function NetworkProfileCard({
  networkHistory,
  isNetworkDegraded,
  currentConcurrency,
  isDark,
}: NetworkProfileCardProps) {
  const [liveConnection, setLiveConnection] = useState<any>(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    return connection || null;
  });
  
  useEffect(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      const handleChange = () => {
        setLiveConnection({ ...connection });
      };
      
      connection.addEventListener('change', handleChange);
      return () => connection.removeEventListener('change', handleChange);
    }
  }, []);
  
  const currentNetwork = useMemo(() => {
    if (networkHistory.length > 0) {
      return networkHistory[networkHistory.length - 1];
    }
    if (liveConnection) {
      return {
        timestamp: new Date().toTimeString(),
        downlink: liveConnection.downlink,
        effectiveType: liveConnection.effectiveType,
        rtt: liveConnection.rtt,
        saveData: liveConnection.saveData,
      };
    }
    return null;
  }, [networkHistory, liveConnection]);
  
  const networkChange = useMemo(() => {
    if (networkHistory.length < 2) return null;
    
    const previous = networkHistory[networkHistory.length - 2];
    const current = networkHistory[networkHistory.length - 1];
    
    if (!previous.downlink || !current.downlink) return null;
    
    const changePercent = ((current.downlink - previous.downlink) / previous.downlink) * 100;
    
    return {
      from: previous.downlink,
      to: current.downlink,
      changePercent,
      improved: changePercent > 0,
    };
  }, [networkHistory]);
  
  const effectiveTypeLabel = useMemo(() => {
    if (!currentNetwork?.effectiveType) return 'Unknown';
    
    const labels: Record<string, string> = {
      'slow-2g': '🐌 Slow 2G',
      '2g': '📱 2G',
      '3g': '📶 3G',
      '4g': '🚀 4G',
    };
    
    return labels[currentNetwork.effectiveType] || currentNetwork.effectiveType;
  }, [currentNetwork]);
  
  return (
    <div className={`p-4 rounded-xl backdrop-blur-sm ${
      isDark ? 'bg-white/5 border border-white/10' : 'bg-white/60 border border-cyan-200'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className={`text-sm font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
            📡 Network Profile
          </h4>
          <p className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/60'}`}>
            Live connection monitoring
          </p>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
          isNetworkDegraded
            ? isDark ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
            : isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
        }`}>
          {isNetworkDegraded ? 'Degraded' : 'Healthy'}
        </div>
      </div>
      
      {currentNetwork ? (
        <div className="space-y-3">
          {/* Connection Type */}
          <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-cyan-50'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDark ? 'text-white/70' : 'text-cyan-700'}`}>
                Connection Type
              </span>
              <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
                {effectiveTypeLabel}
              </span>
            </div>
          </div>
          
          {/* Downlink Speed */}
          {currentNetwork.downlink !== undefined && (
            <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-cyan-50'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm ${isDark ? 'text-white/70' : 'text-cyan-700'}`}>
                  Downlink Speed
                </span>
                <span className={`text-lg font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                  {currentNetwork.downlink.toFixed(1)} Mbps
                </span>
              </div>
              
              {/* Speed indicator */}
              <div className={`h-1.5 rounded-full overflow-hidden mt-2 ${
                isDark ? 'bg-white/10' : 'bg-cyan-200'
              }`}>
                <div
                  className="h-full transition-all duration-500 rounded-full"
                  style={{
                    width: `${Math.min((currentNetwork.downlink / 50) * 100, 100)}%`,
                    background: currentNetwork.downlink > 10 
                      ? 'linear-gradient(to right, #10b981, #059669)'
                      : currentNetwork.downlink > 5
                      ? 'linear-gradient(to right, #f59e0b, #d97706)'
                      : 'linear-gradient(to right, #ef4444, #dc2626)',
                  }}
                />
              </div>
            </div>
          )}
          
          {/* RTT (Latency) */}
          {currentNetwork.rtt !== undefined && (
            <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-cyan-50'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${isDark ? 'text-white/70' : 'text-cyan-700'}`}>
                  Round Trip Time
                </span>
                <span className={`text-sm font-bold ${
                  currentNetwork.rtt < 100 
                    ? isDark ? 'text-green-400' : 'text-green-600'
                    : currentNetwork.rtt < 300
                    ? isDark ? 'text-yellow-400' : 'text-yellow-600'
                    : isDark ? 'text-red-400' : 'text-red-600'
                }`}>
                  {currentNetwork.rtt}ms
                </span>
              </div>
            </div>
          )}
          
          {/* Network Change Alert */}
          {networkChange && (
            <div className={`p-3 rounded-lg ${
              networkChange.improved
                ? isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-300'
                : isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-300'
            }`}>
              <div className="flex items-start gap-2">
                <span className="text-lg">
                  {networkChange.improved ? '📈' : '📉'}
                </span>
                <div className="flex-1 text-xs">
                  <p className={`font-semibold ${
                    networkChange.improved
                      ? isDark ? 'text-green-300' : 'text-green-700'
                      : isDark ? 'text-yellow-300' : 'text-yellow-700'
                  }`}>
                    Network {networkChange.improved ? 'improved' : 'dropped'} by {Math.abs(networkChange.changePercent).toFixed(1)}%
                  </p>
                  <p className={isDark ? 'text-white/60' : 'text-cyan-600/70'}>
                    {networkChange.from.toFixed(1)} Mbps → {networkChange.to.toFixed(1)} Mbps
                  </p>
                  <p className={isDark ? 'text-white/60' : 'text-cyan-600/70'}>
                    → System {networkChange.improved ? 'optimizing' : 'auto-reduced'} to {currentConcurrency} workers
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Save Data Mode */}
          {currentNetwork.saveData && (
            <div className={`p-2 rounded-lg flex items-center gap-2 ${
              isDark ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-300'
            }`}>
              <span>💾</span>
              <span className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                Data Saver mode detected
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className={`p-4 text-center text-xs ${
          isDark ? 'text-white/40' : 'text-cyan-600/40'
        }`}>
          Network API not supported in this browser
        </div>
      )}
    </div>
  );
}
