"use client";
import { useMemo } from 'react';
import { RetryDataPoint } from '@/types/TelemetryMetrics';

interface RetryHeatmapProps {
  retryHeatmap: RetryDataPoint[];
  totalChunks: number;
  isDark: boolean;
}

export function RetryHeatmap({ retryHeatmap, totalChunks, isDark }: RetryHeatmapProps) {
  // Generate heatmap cells
  const heatmapData = useMemo(() => {
    if (totalChunks === 0) return [];
    
    // Create a map for quick lookup
    const retryMap = new Map(retryHeatmap.map(r => [r.chunkIndex, r.retryCount]));
    
    // Generate cells (max 100 visible cells)
    const cellCount = Math.min(totalChunks, 100);
    const chunksPerCell = totalChunks / cellCount;
    
    const cells: { index: number; retries: number; color: string }[] = [];
    
    for (let i = 0; i < cellCount; i++) {
      const startChunk = Math.floor(i * chunksPerCell);
      const endChunk = Math.floor((i + 1) * chunksPerCell);
      
      // Sum retries in this range
      let totalRetries = 0;
      for (let c = startChunk; c < endChunk; c++) {
        totalRetries += retryMap.get(c) || 0;
      }
      
      // Determine color
      let color = isDark ? '#10b98120' : '#10b98130'; // green (no retries)
      if (totalRetries > 5) color = isDark ? '#ef444480' : '#ef444460'; // red
      else if (totalRetries > 2) color = isDark ? '#f59e0b60' : '#f59e0b50'; // yellow
      else if (totalRetries > 0) color = isDark ? '#06b6d440' : '#06b6d430'; // cyan
      
      cells.push({
        index: i,
        retries: totalRetries,
        color,
      });
    }
    
    return cells;
  }, [retryHeatmap, totalChunks, isDark]);
  
  const maxRetries = Math.max(...retryHeatmap.map(r => r.retryCount), 1);
  const totalRetries = retryHeatmap.reduce((sum, r) => sum + r.retryCount, 0);
  
  return (
    <div className={`p-4 rounded-xl backdrop-blur-sm ${
      isDark ? 'bg-white/5 border border-white/10' : 'bg-white/60 border border-cyan-200'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className={`text-sm font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
            🔥 Retry Heatmap
          </h4>
          <p className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/60'}`}>
            Chunks requiring retries
          </p>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${
            totalRetries > 0 
              ? isDark ? 'text-yellow-400' : 'text-yellow-600'
              : isDark ? 'text-green-400' : 'text-green-600'
          }`}>
            {totalRetries}
          </div>
          <div className={`text-xs ${isDark ? 'text-white/60' : 'text-cyan-600/60'}`}>
            total retries
          </div>
        </div>
      </div>
      
      {/* Heatmap Grid */}
      <div className="mb-3">
        {heatmapData.length === 0 ? (
          <div className={`flex items-center justify-center h-16 text-xs rounded-lg ${
            isDark ? 'bg-white/5 text-white/40' : 'bg-cyan-50 text-cyan-600/40'
          }`}>
            No data yet...
          </div>
        ) : (
          <div className="grid grid-cols-20 gap-0.5 p-2 rounded-lg"
            style={{
              gridTemplateColumns: `repeat(${Math.min(20, Math.ceil(Math.sqrt(heatmapData.length)))}, minmax(0, 1fr))`,
            }}
          >
            {heatmapData.map((cell) => (
              <div
                key={cell.index}
                className="aspect-square rounded-sm transition-all duration-200 hover:scale-110 hover:z-10 relative group"
                style={{ backgroundColor: cell.color }}
                title={`Chunk ${Math.floor((cell.index / heatmapData.length) * totalChunks)}: ${cell.retries} retries`}
              >
                {cell.retries > 0 && (
                  <div className={`absolute inset-0 flex items-center justify-center text-[6px] font-bold ${
                    cell.retries > 5 ? 'text-white' : isDark ? 'text-white/70' : 'text-cyan-900/70'
                  }`}>
                    {cell.retries > 9 ? '9+' : cell.retries}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Legend */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className={isDark ? 'text-white/60' : 'text-cyan-600/70'}>
            Chunks with retries
          </span>
          <span className={`font-semibold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
            {retryHeatmap.length} / {totalChunks}
          </span>
        </div>
        
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: isDark ? '#10b98120' : '#10b98130' }}></div>
            <span className={isDark ? 'text-white/60' : 'text-cyan-600/70'}>No retry</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: isDark ? '#06b6d440' : '#06b6d430' }}></div>
            <span className={isDark ? 'text-white/60' : 'text-cyan-600/70'}>1-2</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: isDark ? '#f59e0b60' : '#f59e0b50' }}></div>
            <span className={isDark ? 'text-white/60' : 'text-cyan-600/70'}>3-5</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: isDark ? '#ef444480' : '#ef444460' }}></div>
            <span className={isDark ? 'text-white/60' : 'text-cyan-600/70'}>5+</span>
          </div>
        </div>
      </div>
    </div>
  );
}
