"use client";
import { useEffect } from "react";
import { FileImage, Video, FileArchive, Gauge } from "lucide-react";

export interface CompressionSettings {
  enabled: boolean;
  quality: number; // 0-100 (0 = max compression, 100 = min compression)
  level: 'fast' | 'balanced' | 'maximum';
  estimatedSize: number;
  originalSize: number;
}

interface CompressionToggleProps {
  file: File | null;
  settings: CompressionSettings;
  onSettingsChange: (settings: CompressionSettings) => void;
  isDark: boolean;
  isUploading: boolean;
}

export function CompressionToggle({
  file,
  settings,
  onSettingsChange,
  isDark,
  isUploading
}: CompressionToggleProps) {
  const isCompressible = file && (
    file.type.startsWith('image/') || 
    file.type.startsWith('video/')
  );

  const getFileIcon = () => {
    if (!file) return null;
    if (file.type.startsWith('image/')) return <FileImage className="w-4 h-4" />;
    if (file.type.startsWith('video/')) return <Video className="w-4 h-4" />;
    return <FileArchive className="w-4 h-4" />;
  };

  useEffect(() => {
    if (file && settings.enabled && isCompressible) {
      const estimateCompression = (fileSize: number, quality: number, level: string): number => {
        let compressionRatio = 1.0;

        if (file.type.startsWith('image/')) {
          const qualityFactor = quality / 100;
          
          if (level === 'maximum') {
            compressionRatio = 0.15 + (qualityFactor * 0.35);
          } else if (level === 'balanced') {
            compressionRatio = 0.25 + (qualityFactor * 0.35);
          } else {
            compressionRatio = 0.40 + (qualityFactor * 0.30);
          }
        } else if (file.type.startsWith('video/')) {
          const qualityFactor = quality / 100;
          
          if (level === 'maximum') {
            compressionRatio = 0.20 + (qualityFactor * 0.40);
          } else if (level === 'balanced') {
            compressionRatio = 0.30 + (qualityFactor * 0.40);
          } else {
            compressionRatio = 0.50 + (qualityFactor * 0.30);
          }
        }

        return Math.round(fileSize * compressionRatio);
      };

      const estimated = estimateCompression(file.size, settings.quality, settings.level);
      
      if (estimated !== settings.estimatedSize || file.size !== settings.originalSize) {
        onSettingsChange({
          ...settings,
          estimatedSize: estimated,
          originalSize: file.size
        });
      }
    }
  }, [file, settings, onSettingsChange, isCompressible]);  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const savingsPercentage = settings.originalSize > 0
    ? Math.round(((settings.originalSize - settings.estimatedSize) / settings.originalSize) * 100)
    : 0;

  if (!file) return null;

  return (
    <div className={`backdrop-blur-xl border rounded-2xl p-6 space-y-4 transition-all duration-300 ${
      isDark
        ? 'bg-linear-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30'
        : 'bg-linear-to-br from-purple-50 to-pink-50 border-purple-200'
    }`}>
      {/* Header with Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 backdrop-blur-sm rounded-xl flex items-center justify-center border transition-all duration-300 ${
            isDark ? 'bg-purple-500/30 border-purple-400/40' : 'bg-purple-200 border-purple-400'
          }`}>
            <Gauge className={`w-5 h-5 ${isDark ? 'text-purple-300' : 'text-purple-700'}`} />
          </div>
          <div>
            <p className={`font-semibold transition-colors duration-300 ${
              isDark ? 'text-purple-300' : 'text-purple-700'
            }`}>Pre-Upload Compression</p>
            <p className={`text-xs flex items-center gap-1 transition-colors duration-300 ${
              isDark ? 'text-purple-400/70' : 'text-purple-600'
            }`}>
              {getFileIcon()}
              {isCompressible ? 'Supported file type' : 'Not supported for this file type'}
            </p>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => onSettingsChange({ ...settings, enabled: e.target.checked })}
            disabled={!isCompressible || isUploading}
            className="sr-only peer"
          />
          <div className={`w-11 h-6 rounded-full transition-all duration-300 peer ${
            !isCompressible || isUploading
              ? isDark ? 'bg-slate-700' : 'bg-gray-300'
              : settings.enabled
                ? 'bg-linear-to-r from-purple-600 to-pink-600'
                : isDark ? 'bg-slate-700' : 'bg-gray-300'
          } peer-focus:ring-4 ${isDark ? 'peer-focus:ring-purple-800' : 'peer-focus:ring-purple-300'}`}>
            <div className={`absolute top-0.5 start-0.5 bg-white rounded-full h-5 w-5 transition-transform duration-300 ${
              settings.enabled ? 'translate-x-5' : ''
            }`} />
          </div>
        </label>
      </div>

      {/* Compression Options */}
      {settings.enabled && isCompressible && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
          {/* Quality Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Quality Level
              </label>
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {settings.quality}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.quality}
              onChange={(e) => onSettingsChange({ ...settings, quality: parseInt(e.target.value) })}
              disabled={isUploading}
              className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
                isDark ? 'bg-slate-700' : 'bg-gray-300'
              }`}
              style={{
                background: isDark
                  ? `linear-gradient(to right, #db2777 0%, #db2777 ${settings.quality}%, #334155 ${settings.quality}%, #334155 100%)`
                  : `linear-gradient(to right, #ec4899 0%, #ec4899 ${settings.quality}%, #d1d5db ${settings.quality}%, #d1d5db 100%)`
              }}
            />
            <div className="flex justify-between mt-1">
              <span className={`text-xs ${isDark ? 'text-pink-400' : 'text-pink-600'}`}>Max Compression</span>
              <span className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>Min Compression</span>
            </div>
          </div>

          {/* Compression Level */}
          <div>
            <label className={`text-sm font-medium mb-2 block ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Compression Speed
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['fast', 'balanced', 'maximum'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => onSettingsChange({ ...settings, level })}
                  disabled={isUploading}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                    settings.level === level
                      ? isDark
                        ? 'bg-linear-to-r from-purple-600 to-pink-600 text-white border-2 border-purple-400'
                        : 'bg-linear-to-r from-purple-500 to-pink-500 text-white border-2 border-purple-500'
                      : isDark
                        ? 'bg-slate-800/50 text-gray-400 border border-slate-700 hover:bg-slate-700/50'
                        : 'bg-white/50 text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Size */}
          {settings.originalSize > 0 && (
            <div className={`p-4 rounded-xl border transition-all duration-300 ${
              isDark
                ? 'bg-linear-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/30'
                : 'bg-linear-to-br from-emerald-50 to-teal-50 border-emerald-300'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  💾 Size Estimate
                </span>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Original:</span>
                  <span className={`font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {formatBytes(settings.originalSize)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Compressed:</span>
                  <span className={`font-mono ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    {formatBytes(settings.estimatedSize)}
                  </span>
                </div>
                <div className={`pt-2 mt-2 border-t flex justify-between items-center ${
                  isDark ? 'border-emerald-500/30' : 'border-emerald-300'
                }`}>
                  <span className={`text-sm font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    💰 Savings:
                  </span>
                  <span className={`text-sm font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    {formatBytes(settings.originalSize - settings.estimatedSize)} ({savingsPercentage}% smaller)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className={`p-3 rounded-lg text-xs ${
            isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'
          }`}>
            <strong>ℹ️ Note:</strong> Compression happens in your browser before upload. 
            {file.type.startsWith('image/') && ' Images will be converted to WebP format.'}
            {file.type.startsWith('video/') && ' Videos will be re-encoded with H.264.'}
          </div>
        </div>
      )}
    </div>
  );
}
