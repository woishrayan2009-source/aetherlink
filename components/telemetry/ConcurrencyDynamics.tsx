"use client";
import { useMemo } from 'react';
import { ConcurrencySnapshot } from '@/types/TelemetryMetrics';

interface ConcurrencyDynamicsProps {
  concurrencyHistory: ConcurrencySnapshot[];
  currentConcurrency: number;
  peakConcurrency: number;
  concurrencyDrops: number;
  isDark: boolean;
}

export function ConcurrencyDynamics({
  concurrencyHistory,
  currentConcurrency,
  peakConcurrency,
  concurrencyDrops,
  isDark,
}: ConcurrencyDynamicsProps) {
  // Generate sparkline data
  const sparklineData = useMemo(() => {
    if (concurrencyHistory.length === 0) return [];
    
    const maxConcurrency = Math.max(...concurrencyHistory.map(s => s.concurrency), 40);
    
    return concurrencyHistory.map((snapshot, idx) => ({
      x: (idx / Math.max(concurrencyHistory.length - 1, 1)) * 100,
      y: 100 - (snapshot.concurrency / maxConcurrency * 100),
      concurrency: snapshot.concurrency,
    }));
  }, [concurrencyHistory]);
  
  const sparklinePath = useMemo(() => {
    if (sparklineData.length === 0) return '';
    
    return sparklineData.map((d, i) => 
      `${i === 0 ? 'M' : 'L'} ${d.x} ${d.y}`
    ).join(' ');
  }, [sparklineData]);
  
  const lastChange = concurrencyHistory[concurrencyHistory.length - 1];
  const trend = concurrencyHistory.length > 1 
    ? concurrencyHistory[concurrencyHistory.length - 1].concurrency - concurrencyHistory[0].concurrency
    : 0;
  
  return (
    <div className={`p-4 rounded-xl backdrop-blur-sm ${
      isDark ? 'bg-white/5 border border-white/10' : 'bg-white/60 border border-cyan-200'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className={`text-sm font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
            🔄 Concurrency Dynamics
          </h4>
          <p className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/60'}`}>
            Real-time worker scaling
          </p>
        </div>
      </div>
      
      {/* Sparkline */}
      <div className="relative h-16 mb-3">
        {sparklineData.length === 0 ? (
          <div className={`flex items-center justify-center h-full text-xs ${
            isDark ? 'text-white/40' : 'text-cyan-600/40'
          }`}>
            Monitoring...
          </div>
        ) : (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
            {/* Background grid */}
            <line x1="0" y1="25" x2="100" y2="25" stroke={isDark ? '#ffffff10' : '#06b6d420'} strokeWidth="0.5" />
            <line x1="0" y1="50" x2="100" y2="50" stroke={isDark ? '#ffffff10' : '#06b6d420'} strokeWidth="0.5" />
            <line x1="0" y1="75" x2="100" y2="75" stroke={isDark ? '#ffffff10' : '#06b6d420'} strokeWidth="0.5" />
            
            {/* Area */}
            <path
              d={`${sparklinePath} L 100 100 L 0 100 Z`}
              fill={isDark ? '#06b6d420' : '#0891b220'}
              className="transition-all duration-300"
            />
            
            {/* Line */}
            <path
              d={sparklinePath}
              fill="none"
              stroke={isDark ? '#06b6d4' : '#0891b2'}
              strokeWidth="2"
              className="transition-all duration-300"
            />
            
            {/* Current point */}
            {sparklineData.length > 0 && (
              <circle
                cx={sparklineData[sparklineData.length - 1].x}
                cy={sparklineData[sparklineData.length - 1].y}
                r="2"
                fill={isDark ? '#06b6d4' : '#0891b2'}
                className="animate-pulse"
              />
            )}
          </svg>
        )}
      </div>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`p-2 rounded-lg text-center ${
          isDark ? 'bg-white/5' : 'bg-cyan-50'
        }`}>
          <div className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/70'}`}>
            Current
          </div>
          <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
            {currentConcurrency}
          </div>
        </div>
        
        <div className={`p-2 rounded-lg text-center ${
          isDark ? 'bg-white/5' : 'bg-cyan-50'
        }`}>
          <div className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/70'}`}>
            Peak
          </div>
          <div className={`text-lg font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
            {peakConcurrency}
          </div>
        </div>
        
        <div className={`p-2 rounded-lg text-center ${
          isDark ? 'bg-white/5' : 'bg-cyan-50'
        }`}>
          <div className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/70'}`}>
            Drops
          </div>
          <div className={`text-lg font-bold ${
            concurrencyDrops > 0 
              ? isDark ? 'text-yellow-400' : 'text-yellow-600'
              : isDark ? 'text-white' : 'text-cyan-900'
          }`}>
            {concurrencyDrops}
          </div>
        </div>
      </div>
      
      {/* Last change indicator */}
      {lastChange && lastChange.reason && (
        <div className={`mt-3 p-2 rounded-lg text-xs ${
          isDark ? 'bg-cyan-500/10 text-cyan-300' : 'bg-cyan-50 text-cyan-700'
        }`}>
          <div className="flex items-center gap-2">
            <span className={trend > 0 ? '🔼' : trend < 0 ? '🔽' : '➡️'}>
              {trend > 0 ? '🔼' : trend < 0 ? '🔽' : '➡️'}
            </span>
            <span className="truncate">{lastChange.reason}</span>
          </div>
        </div>
      )}
    </div>
  );
}
