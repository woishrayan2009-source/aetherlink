"use client";
import { FileUploadState } from "@/types/MultiFileUpload";
import { formatFileSize } from "@/utils/helpers/file";
import { CheckCircle, XCircle, Clock, Upload, FileIcon, Download, Ban } from "lucide-react";

interface MultiFileProgressListProps {
  files: FileUploadState[];
  isDark?: boolean;
}

export function MultiFileProgressList({ files, isDark = true }: MultiFileProgressListProps) {
  const getStatusIcon = (status: FileUploadState['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'uploading':
        return <Upload className="w-5 h-5 text-cyan-500 animate-pulse" />;
      case 'cancelled':
        return <Ban className="w-5 h-5 text-orange-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return <FileIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: FileUploadState['status']) => {
    switch (status) {
      case 'completed':
        return 'border-green-500/30 bg-green-500/10';
      case 'failed':
        return 'border-red-500/30 bg-red-500/10';
      case 'uploading':
        return 'border-cyan-500/30 bg-cyan-500/10';
      case 'cancelled':
        return 'border-orange-500/30 bg-orange-500/10';
      case 'pending':
        return 'border-gray-500/30 bg-gray-500/10';
      default:
        return 'border-gray-500/30 bg-gray-500/10';
    }
  };

  const getProgressBarColor = (status: FileUploadState['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'uploading':
        return 'bg-cyan-500';
      case 'cancelled':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (files.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Upload Queue ({files.length} files)
        </h3>
        <div className="flex gap-2 text-xs">
          <span className="text-green-500">
            ✓ {files.filter(f => f.status === 'completed').length}
          </span>
          <span className="text-red-500">
            ✗ {files.filter(f => f.status === 'failed').length}
          </span>
          <span className="text-cyan-500">
            ⟳ {files.filter(f => f.status === 'uploading').length}
          </span>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
        {files.map((fileState) => (
          <div
            key={fileState.uploadId}
            className={`border rounded-lg p-3 transition-all duration-300 ${getStatusColor(fileState.status)}`}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                {getStatusIcon(fileState.status)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {fileState.file.name}
                  </p>
                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {formatFileSize(fileState.file.size)}
                  </span>
                </div>

                {/* Progress Bar */}
                {(fileState.status === 'uploading' || fileState.status === 'completed') && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                        {fileState.uploadedChunks} / {fileState.totalChunks} chunks
                      </span>
                      <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {fileState.progress}%
                      </span>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                      <div
                        className={`h-full transition-all duration-300 ${getProgressBarColor(fileState.status)}`}
                        style={{ width: `${fileState.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Status Info */}
                <div className="flex items-center justify-between text-xs">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                    {fileState.status === 'uploading' && `${fileState.activeWorkers} workers active`}
                    {fileState.status === 'completed' && fileState.uploadTime && `Uploaded in ${fileState.uploadTime}`}
                    {fileState.status === 'failed' && fileState.error && `Error: ${fileState.error}`}
                    {fileState.status === 'cancelled' && 'Upload cancelled'}
                    {fileState.status === 'pending' && 'Waiting...'}
                  </span>

                  {fileState.status === 'completed' && fileState.downloadLink && (
                    <a
                      href={fileState.downloadLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-cyan-500 hover:text-cyan-400 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </a>
                  )}
                </div>

                {/* Share ID Display */}
                {fileState.shareId && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Share ID:
                      </span>
                      <code className={`text-xs font-mono px-2 py-1 rounded ${isDark ? 'bg-gray-700 text-cyan-400' : 'bg-gray-100 text-cyan-600'}`}>
                        {fileState.shareId}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
