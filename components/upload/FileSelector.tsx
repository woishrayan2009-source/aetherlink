"use client";
import { Upload, File } from "lucide-react";
import { formatFileSize } from "@/utils/helpers/file";

interface FileSelectorProps {
  file: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function FileSelector({ file, onFileChange }: FileSelectorProps) {
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
        className={`block relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 ${file
            ? "bg-cyan-500/10 border-2 border-cyan-500/50"
            : "bg-white/5 border-2 border-dashed border-white/20 hover:border-cyan-500/50 hover:bg-white/10"
          }`}
      >
        <div className="relative z-10 p-10 flex flex-col items-center justify-center space-y-4">
          {file ? (
            <>
              <div className={`w-16 h-16 backdrop-blur-sm rounded-2xl flex items-center justify-center border transition-all duration-300 ${"bg-cyan-500/20 border-cyan-400/30"
                }`}>
                <File className={`w-8 h-8 ${"text-cyan-400"}`} />
              </div>
              <div className="text-center">
                <p className={`font-semibold text-lg transition-colors duration-300 ${"text-cyan-900"
                  }`}>{file.name}</p>
                <p className={`text-sm mt-1 transition-colors duration-300 ${"text-cyan-600"
                  }`}>{formatFileSize(file.size)}</p>
              </div>
            </>
          ) : (
            <>
              <div className={`w-16 h-16 backdrop-blur-sm rounded-2xl flex items-center justify-center border transition-all duration-300 ${"bg-white/10 border-white/20"
                }`}>
                <Upload className={`w-8 h-8 ${"text-cyan-300"}`} />
              </div>
              <div className="text-center">
                <p className={`font-semibold text-lg transition-colors duration-300 ${"text-cyan-900"
                  }`}>Choose a file</p>
                <p className={`text-sm mt-1 transition-colors duration-300 ${"text-cyan-600"
                  }`}>or drag and drop here</p>
              </div>
            </>
          )}
        </div>
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${"bg-linear-to-br from-cyan-500/5 to-blue-500/5"
          }`} />
      </label>
    </div>
  );
}
