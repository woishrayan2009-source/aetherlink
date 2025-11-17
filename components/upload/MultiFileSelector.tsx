"use client";
import { Upload, Files, File as FileIcon } from "lucide-react";
import { formatFileSize } from "@/utils/helpers/file";

interface MultiFileSelectorProps {
  files: File[];
  onFilesChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

export function MultiFileSelector({ files, onFilesChange, disabled = false }: MultiFileSelectorProps) {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="relative group">
      <input
        type="file"
        id="multi-file-upload"
        onChange={onFilesChange}
        className="hidden"
        multiple
        disabled={disabled}
      />
      <label
        htmlFor="multi-file-upload"
        className={`block relative overflow-hidden rounded-2xl transition-all duration-300 ${
          disabled 
            ? "cursor-not-allowed opacity-50" 
            : "cursor-pointer"
        } ${
          files.length > 0
            ? "bg-cyan-500/10 border-2 border-cyan-500/50"
            : "bg-white/5 border-2 border-dashed border-white/20 hover:border-cyan-500/50 hover:bg-white/10"
        }`}
      >
        <div className="relative z-10 p-10 flex flex-col items-center justify-center space-y-4">
          {files.length > 0 ? (
            <>
              <div className="w-16 h-16 backdrop-blur-sm rounded-2xl flex items-center justify-center border transition-all duration-300 bg-cyan-500/20 border-cyan-400/30">
                <Files className="w-8 h-8 text-cyan-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg transition-colors duration-300 text-white">
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </p>
                <p className="text-sm mt-1 transition-colors duration-300 text-cyan-400">
                  Total: {formatFileSize(totalSize)}
                </p>
                <p className="text-xs mt-2 text-gray-400">
                  Click to add more files
                </p>
              </div>

              {/* Show first few files */}
              {files.length <= 3 && (
                <div className="w-full space-y-1 mt-2">
                  {files.map((file, index) => (
                    <div 
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 rounded px-3 py-1.5"
                    >
                      <FileIcon className="w-3 h-3" />
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-cyan-400">{formatFileSize(file.size)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="w-16 h-16 backdrop-blur-sm rounded-2xl flex items-center justify-center border transition-all duration-300 bg-white/10 border-white/20">
                <Upload className="w-8 h-8 text-cyan-300" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg transition-colors duration-300 text-white">
                  Choose files to upload
                </p>
                <p className="text-sm mt-1 transition-colors duration-300 text-gray-400">
                  Select multiple files or drag and drop here
                </p>
              </div>
            </>
          )}
        </div>
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-linear-to-br from-cyan-500/5 to-blue-500/5" />
      </label>
    </div>
  );
}
