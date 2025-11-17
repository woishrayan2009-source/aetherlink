"use client";
import { MultiFileUploadState } from "@/types/MultiFileUpload";
import { Files, CheckCircle, XCircle, Upload, TrendingUp } from "lucide-react";

interface MultiFileOverviewProps {
  state: MultiFileUploadState;
  isDark?: boolean;
}

export function MultiFileOverview({ state, isDark = true }: MultiFileOverviewProps) {
  const { files, totalFiles, completedCount, failedCount, overallProgress, isUploading } = state;

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const uploadingCount = files.filter(f => f.status === 'uploading').length;

  if (totalFiles === 0) return null;

  return (
    <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-800/50 border-white/10' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${isDark ? 'bg-cyan-500/20' : 'bg-cyan-100'}`}>
          <Files className={`w-5 h-5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
        </div>
        <div>
          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Multi-File Upload
          </h3>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {totalFiles} file{totalFiles !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Overall Progress
          </span>
          <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {overallProgress}%
          </span>
        </div>
        <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <div
            className="h-full bg-linear-to-r from-cyan-500 to-blue-500 transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-3 rounded-lg ${isDark ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'}`}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Completed
            </span>
          </div>
          <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {completedCount}
          </p>
        </div>

        <div className={`p-3 rounded-lg ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Failed
            </span>
          </div>
          <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {failedCount}
          </p>
        </div>

        {isUploading && (
          <>
            <div className={`p-3 rounded-lg ${isDark ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-cyan-50 border border-cyan-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Upload className="w-4 h-4 text-cyan-500 animate-pulse" />
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Uploading
                </span>
              </div>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {uploadingCount}
              </p>
            </div>

            <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-500/10 border border-gray-500/20' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Pending
                </span>
              </div>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {pendingCount}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
