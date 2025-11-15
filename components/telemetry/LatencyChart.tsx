"use client";
import { useMemo } from 'react';
import { ChunkLatencyPoint } from '@/types/TelemetryMetrics';

interface LatencyChartProps {
  latencyPoints: ChunkLatencyPoint[];
  isDark: boolean;
}

export function LatencyChart({ latencyPoints, isDark }: LatencyChartProps) {
  const chartData = useMemo(() => {
    if (latencyPoints.length === 0) return { points: [], max: 1000, avg: 0 };
    
    // Calculate moving average (window of 10)
    const windowSize = 10;
    const movingAvg: { x: number; y: number; color: string }[] = [];
    
    for (let i = 0; i < latencyPoints.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = latencyPoints.slice(start, i + 1);
      const avg = window.reduce((sum, p) => sum + p.latency, 0) / window.length;
      
      // Color based on latency
      let color = '#10b981'; // green
      if (avg > 500) color = '#ef4444'; // red
      else if (avg > 300) color = '#f59e0b'; // yellow
      
      movingAvg.push({
        x: (i / latencyPoints.length) * 100,
        y: avg,
        color,
      });
    }
    
    const maxLatency = Math.max(...latencyPoints.map(p => p.latency));
    const avgLatency = latencyPoints.reduce((sum, p) => sum + p.latency, 0) / latencyPoints.length;
    
    return { points: movingAvg, max: maxLatency, avg: avgLatency };
  }, [latencyPoints]);
  
  const svgHeight = 80;
  const svgWidth = 100;
  
  // Generate SVG path
  const path = useMemo(() => {
    if (chartData.points.length === 0) return '';
    
    const scale = svgHeight / chartData.max;
    const points = chartData.points.map(p => ({
      x: p.x,
      y: svgHeight - (p.y * scale),
    }));
    
    const pathData = points.map((p, i) => 
      `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    ).join(' ');
    
    return pathData;
  }, [chartData]);
  
  // Generate gradient
  const gradientId = 'latency-gradient';
  
  return (
    <div className={`p-4 rounded-xl backdrop-blur-sm ${
      isDark ? 'bg-white/5 border border-white/10' : 'bg-white/60 border border-cyan-200'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className={`text-sm font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
            ⚡ Chunk Latency
          </h4>
          <p className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/60'}`}>
            Moving average (10-chunk window)
          </p>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
            {chartData.avg.toFixed(0)}ms
          </div>
          <div className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/60'}`}>
            avg
          </div>
        </div>
      </div>
      
      <div className="relative h-20">
        {latencyPoints.length === 0 ? (
          <div className={`flex items-center justify-center h-full text-xs ${
            isDark ? 'text-white/40' : 'text-cyan-600/40'
          }`}>
            Waiting for data...
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            {/* Gradient definition */}
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isDark ? '#06b6d4' : '#0891b2'} stopOpacity="0.3" />
                <stop offset="100%" stopColor={isDark ? '#06b6d4' : '#0891b2'} stopOpacity="0.05" />
              </linearGradient>
            </defs>
            
            {/* Area under curve */}
            {path && (
              <path
                d={`${path} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`}
                fill={`url(#${gradientId})`}
              />
            )}
            
            {/* Line */}
            {path && (
              <path
                d={path}
                fill="none"
                stroke={isDark ? '#06b6d4' : '#0891b2'}
                strokeWidth="1.5"
                className="transition-all duration-300"
              />
            )}
            
            {/* Peak indicator */}
            {chartData.points.length > 0 && (() => {
              const peakIndex = chartData.points.reduce((maxIdx, p, idx, arr) => 
                p.y < arr[maxIdx].y ? idx : maxIdx, 0);
              const peak = chartData.points[peakIndex];
              
              return peak && peak.color === '#ef4444' ? (
                <g>
                  <circle
                    cx={peak.x}
                    cy={svgHeight - (latencyPoints[peakIndex].latency / chartData.max * svgHeight)}
                    r="1.5"
                    fill="#ef4444"
                    className="animate-pulse"
                  />
                </g>
              ) : null;
            })()}
          </svg>
        )}
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-1 rounded bg-green-500"></div>
          <span className={isDark ? 'text-white/60' : 'text-cyan-600/70'}>Fast (&lt;300ms)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-1 rounded bg-yellow-500"></div>
          <span className={isDark ? 'text-white/60' : 'text-cyan-600/70'}>Moderate</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-1 rounded bg-red-500"></div>
          <span className={isDark ? 'text-white/60' : 'text-cyan-600/70'}>Slow (&gt;500ms)</span>
        </div>
      </div>
    </div>
  );
}
