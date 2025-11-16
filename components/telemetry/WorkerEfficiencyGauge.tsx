"use client";
import { useMemo } from 'react';

interface WorkerEfficiencyGaugeProps {
  currentEfficiency: number;
  averageEfficiency: number;
  activeWorkers: number;
  totalWorkers: number;
  isNetworkDegraded: boolean;
  isDark: boolean;
}

export function WorkerEfficiencyGauge({
  currentEfficiency,
  averageEfficiency,
  activeWorkers,
  totalWorkers,
  isNetworkDegraded,
  isDark,
}: WorkerEfficiencyGaugeProps) {
  // DEFENSIVE: Clamp activeWorkers to never exceed totalWorkers in UI
  const displayWorkers = Math.min(activeWorkers, totalWorkers);
  
  // Detect and log UI overflow (shouldn't happen with backend fixes)
  if (activeWorkers > totalWorkers) {
    console.error(`❌ TELEMETRY UI OVERFLOW: ${activeWorkers} active workers > ${totalWorkers} max workers`);
  }
  
  // Calculate gauge arc
  const gaugeConfig = useMemo(() => {
    const radius = 40;
    const strokeWidth = 8;
    const circumference = 2 * Math.PI * radius;
    const progress = (currentEfficiency / 100) * 0.75; // 75% of circle
    const offset = circumference * (1 - progress);
    
    // Color based on efficiency
    let color = '#10b981'; // green
    if (currentEfficiency < 40) color = '#ef4444'; // red
    else if (currentEfficiency < 70) color = '#f59e0b'; // yellow
    
    return {
      radius,
      strokeWidth,
      circumference,
      offset,
      color,
      viewBox: '0 0 100 100',
      center: 50,
    };
  }, [currentEfficiency]);
  
  const efficiencyLabel = useMemo(() => {
    if (currentEfficiency >= 80) return 'Excellent';
    if (currentEfficiency >= 60) return 'Good';
    if (currentEfficiency >= 40) return 'Fair';
    return 'Poor';
  }, [currentEfficiency]);
  
  return (
    <div className={`p-4 rounded-xl backdrop-blur-sm ${
      isDark ? 'bg-white/5 border border-white/10' : 'bg-white/60 border border-cyan-200'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className={`text-sm font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
            ⚙️ Worker Efficiency
          </h4>
          <p className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/60'}`}>
            Active vs idle workers
          </p>
        </div>
      </div>
      
      {/* Gauge */}
      <div className="flex items-center justify-center mb-4">
        <div className="relative w-32 h-32">
          <svg
            viewBox={gaugeConfig.viewBox}
            className="w-full h-full transform -rotate-135"
          >
            {/* Background arc */}
            <circle
              cx={gaugeConfig.center}
              cy={gaugeConfig.center}
              r={gaugeConfig.radius}
              fill="none"
              stroke={isDark ? '#ffffff10' : '#06b6d420'}
              strokeWidth={gaugeConfig.strokeWidth}
              strokeDasharray={`${gaugeConfig.circumference * 0.75} ${gaugeConfig.circumference}`}
              strokeLinecap="round"
            />
            
            {/* Progress arc */}
            <circle
              cx={gaugeConfig.center}
              cy={gaugeConfig.center}
              r={gaugeConfig.radius}
              fill="none"
              stroke={gaugeConfig.color}
              strokeWidth={gaugeConfig.strokeWidth}
              strokeDasharray={`${gaugeConfig.circumference * 0.75} ${gaugeConfig.circumference}`}
              strokeDashoffset={gaugeConfig.offset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
              style={{
                filter: isDark ? 'drop-shadow(0 0 4px currentColor)' : 'none',
              }}
            />
          </svg>
          
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
              {currentEfficiency.toFixed(0)}%
            </div>
            <div className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/70'}`}>
              {efficiencyLabel}
            </div>
          </div>
        </div>
      </div>
      
      {/* Metrics */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className={isDark ? 'text-white/60' : 'text-cyan-600/70'}>
            Active Workers
          </span>
          <span className={`font-semibold ${
            displayWorkers > totalWorkers
              ? 'text-red-500'  // Red if overflow (shouldn't happen)
              : isDark ? 'text-cyan-400' : 'text-cyan-600'
          }`}>
            {displayWorkers} / {totalWorkers}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <span className={isDark ? 'text-white/60' : 'text-cyan-600/70'}>
            Average Efficiency
          </span>
          <span className={`font-semibold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
            {averageEfficiency.toFixed(1)}%
          </span>
        </div>
        
        {/* Network status */}
        {isNetworkDegraded && (
          <div className={`mt-2 p-2 rounded-lg flex items-center gap-2 ${
            isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-300'
          }`}>
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
            <span className={`text-xs font-medium ${
              isDark ? 'text-yellow-300' : 'text-yellow-700'
            }`}>
              System downscaled due to poor network
            </span>
          </div>
        )}
      </div>
      
      {/* Visual bar */}
      <div className="mt-3">
        <div className={`h-2 rounded-full overflow-hidden ${
          isDark ? 'bg-white/10' : 'bg-cyan-100'
        }`}>
          <div
            className="h-full transition-all duration-500 ease-out rounded-full"
            style={{
              width: `${currentEfficiency}%`,
              background: `linear-gradient(to right, ${gaugeConfig.color}, ${gaugeConfig.color}dd)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
