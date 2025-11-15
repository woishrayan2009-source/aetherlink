"use client";
import { useMemo } from 'react';

interface PerformanceScoreProps {
  performanceScore: number;
  throughput: number;
  adaptiveImprovement: number;
  averageEfficiency: number;
  retriesPerChunk: number;
  isDark: boolean;
}

export function PerformanceScore({
  performanceScore,
  throughput,
  adaptiveImprovement,
  averageEfficiency,
  retriesPerChunk,
  isDark,
}: PerformanceScoreProps) {
  const scoreGrade = useMemo(() => {
    if (performanceScore >= 90) return { grade: 'A+', color: '#10b981', label: 'Excellent' };
    if (performanceScore >= 80) return { grade: 'A', color: '#10b981', label: 'Great' };
    if (performanceScore >= 70) return { grade: 'B', color: '#06b6d4', label: 'Good' };
    if (performanceScore >= 60) return { grade: 'C', color: '#f59e0b', label: 'Fair' };
    return { grade: 'D', color: '#ef4444', label: 'Poor' };
  }, [performanceScore]);
  
  const improvementText = useMemo(() => {
    if (adaptiveImprovement > 30) return 'Massive improvement';
    if (adaptiveImprovement > 20) return 'Significant improvement';
    if (adaptiveImprovement > 10) return 'Notable improvement';
    return 'Optimized performance';
  }, [adaptiveImprovement]);
  
  return (
    <div className={`p-6 rounded-xl backdrop-blur-sm relative overflow-hidden ${
      isDark ? 'bg-white/5 border border-white/10' : 'bg-white/60 border border-cyan-200'
    }`}>
      {/* Animated background gradient */}
      <div
        className="absolute inset-0 opacity-20 animate-pulse"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${scoreGrade.color}, transparent 70%)`,
        }}
      />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className={`text-sm font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
              🏆 Performance Score
            </h4>
            <p className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/60'}`}>
              End-to-end efficiency index
            </p>
          </div>
        </div>
        
        {/* Main Score Display */}
        <div className="flex items-center justify-center mb-6">
          <div className="text-center">
            <div className="relative inline-block">
              <svg className="w-32 h-32" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={isDark ? '#ffffff10' : '#06b6d420'}
                  strokeWidth="6"
                />
                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={scoreGrade.color}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - performanceScore / 100)}`}
                  transform="rotate(-90 50 50)"
                  className="transition-all duration-1000 ease-out"
                  style={{
                    filter: 'drop-shadow(0 0 8px currentColor)',
                  }}
                />
              </svg>
              
              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div
                  className="text-4xl font-bold"
                  style={{ color: scoreGrade.color }}
                >
                  {scoreGrade.grade}
                </div>
                <div className={`text-xs font-medium ${isDark ? 'text-white/70' : 'text-cyan-700'}`}>
                  {scoreGrade.label}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Adaptive Improvement Banner */}
        <div className={`p-4 rounded-xl mb-4 relative overflow-hidden ${
          isDark ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30' : 'bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-300'
        }`}>
          <div className="absolute top-0 right-0 text-6xl opacity-10">🚀</div>
          <div className="relative z-10">
            <div className={`text-xs font-semibold mb-1 ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
              ⚡ Adaptive Mode Performance
            </div>
            <div className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-cyan-900'}`}>
              +{adaptiveImprovement.toFixed(1)}%
            </div>
            <div className={`text-xs ${isDark ? 'text-white/70' : 'text-cyan-700/70'}`}>
              {improvementText} vs. static 40-worker mode
            </div>
          </div>
        </div>
        
        {/* Performance Breakdown */}
        <div className="grid grid-cols-2 gap-2">
          <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-cyan-50'}`}>
            <div className={`text-xs mb-1 ${isDark ? 'text-white/60' : 'text-cyan-600/70'}`}>
              Throughput
            </div>
            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
              {throughput.toFixed(2)}
            </div>
            <div className={`text-xs ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
              chunks/sec
            </div>
          </div>
          
          <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-cyan-50'}`}>
            <div className={`text-xs mb-1 ${isDark ? 'text-white/60' : 'text-cyan-600/70'}`}>
              Worker Efficiency
            </div>
            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
              {averageEfficiency.toFixed(1)}%
            </div>
            <div className={`text-xs ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
              utilization
            </div>
          </div>
          
          <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-cyan-50'}`}>
            <div className={`text-xs mb-1 ${isDark ? 'text-white/60' : 'text-cyan-600/70'}`}>
              Retry Rate
            </div>
            <div className={`text-lg font-bold ${
              retriesPerChunk > 0.1 
                ? isDark ? 'text-yellow-400' : 'text-yellow-600'
                : isDark ? 'text-green-400' : 'text-green-600'
            }`}>
              {(retriesPerChunk * 100).toFixed(1)}%
            </div>
            <div className={`text-xs ${
              retriesPerChunk > 0.1
                ? isDark ? 'text-yellow-400' : 'text-yellow-600'
                : isDark ? 'text-green-400' : 'text-green-600'
            }`}>
              {retriesPerChunk > 0.1 ? 'needs work' : 'excellent'}
            </div>
          </div>
          
          <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-cyan-50'}`}>
            <div className={`text-xs mb-1 ${isDark ? 'text-white/60' : 'text-cyan-600/70'}`}>
              Overall Score
            </div>
            <div className={`text-lg font-bold`} style={{ color: scoreGrade.color }}>
              {performanceScore.toFixed(0)}/100
            </div>
            <div className={`text-xs`} style={{ color: scoreGrade.color }}>
              {scoreGrade.label.toLowerCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
