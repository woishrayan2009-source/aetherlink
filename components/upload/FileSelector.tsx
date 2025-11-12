"use client";
import { Upload, File } from "lucide-react";
import { formatFileSize } from "@/utils/helpers/file";

interface FileSelectorProps {
  file: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isDark: boolean;
}

export function FileSelector({ file, onFileChange, isDark }: FileSelectorProps) {
  return (
    <div className="relative group">
      <input
        type="file"
        id="file-upload"
        onChange={onFileChange}
        className="hidden"
      />
      <label
        htmlFor="file-upload"
        className={`block relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 ${
          file
            ? isDark
              ? "bg-cyan-500/10 border-2 border-cyan-500/50"
              : "bg-cyan-50 border-2 border-cyan-400"
            : isDark
              ? "bg-white/5 border-2 border-dashed border-white/20 hover:border-cyan-500/50 hover:bg-white/10"
              : "bg-white/60 border-2 border-dashed border-cyan-300 hover:border-cyan-400 hover:bg-white/80"
        }`}
      >
        <div className="relative z-10 p-10 flex flex-col items-center justify-center space-y-4">
          {file ? (
            <>
              <div className={`w-16 h-16 backdrop-blur-sm rounded-2xl flex items-center justify-center border transition-all duration-300 ${
                isDark ? 'bg-cyan-500/20 border-cyan-400/30' : 'bg-cyan-100 border-cyan-300'
              }`}>
                <File className={`w-8 h-8 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
              </div>
              <div className="text-center">
                <p className={`font-semibold text-lg transition-colors duration-300 ${
                  isDark ? 'text-white' : 'text-cyan-900'
                }`}>{file.name}</p>
                <p className={`text-sm mt-1 transition-colors duration-300 ${
                  isDark ? 'text-cyan-300' : 'text-cyan-600'
                }`}>{formatFileSize(file.size)}</p>
              </div>
            </>
          ) : (
            <>
              <div className={`w-16 h-16 backdrop-blur-sm rounded-2xl flex items-center justify-center border transition-all duration-300 ${
                isDark ? 'bg-white/10 border-white/20' : 'bg-cyan-100 border-cyan-300'
              }`}>
                <Upload className={`w-8 h-8 ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`} />
              </div>
              <div className="text-center">
                <p className={`font-semibold text-lg transition-colors duration-300 ${
                  isDark ? 'text-white' : 'text-cyan-900'
                }`}>Choose a file</p>
                <p className={`text-sm mt-1 transition-colors duration-300 ${
                  isDark ? 'text-cyan-300' : 'text-cyan-600'
                }`}>or drag and drop here</p>
              </div>
            </>
          )}
        </div>
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
          isDark ? 'bg-linear-to-br from-cyan-500/5 to-blue-500/5' : 'bg-linear-to-br from-cyan-100/50 to-blue-100/50'
        }`} />
      </label>
    </div>
  );
}
