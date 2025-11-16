"use client";

import { useState } from "react";
import { Download, CheckCircle, Clock, AlertCircle, FileText, Film, Image as ImageIcon, Music, Archive, File } from "lucide-react";
import { FileMetadata } from "@/app/receiver/page";

interface FileCardProps {
  file: FileMetadata;
  endpoint: string;
  shareID: string;
  animationDelay: number;
}

export function FileCard({ file, endpoint, shareID, animationDelay }: FileCardProps) {
  const [downloading, setDownloading] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    
    if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext || "")) {
      return <Film className="w-8 h-8 text-purple-400" />;
    }
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) {
      return <ImageIcon className="w-8 h-8 text-blue-400" />;
    }
    if (["mp3", "wav", "ogg", "flac"].includes(ext || "")) {
      return <Music className="w-8 h-8 text-green-400" />;
    }
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext || "")) {
      return <Archive className="w-8 h-8 text-yellow-400" />;
    }
    if (["pdf", "doc", "docx", "txt"].includes(ext || "")) {
      return <FileText className="w-8 h-8 text-red-400" />;
    }
    return <File className="w-8 h-8 text-zinc-400" />;
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const downloadUrl = `${endpoint}/download/${file.upload_id}/${encodeURIComponent(file.filename)}?share_id=${encodeURIComponent(shareID)}`;
      
      // Create a temporary anchor element to trigger download
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download file. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const getStatusColor = () => {
    switch (file.status) {
      case "complete":
        return "border-green-500/50 bg-green-600/5";
      case "incomplete":
        return "border-yellow-500/50 bg-yellow-600/5";
      case "error":
        return "border-red-500/50 bg-red-600/5";
      default:
        return "border-zinc-700 bg-zinc-800/50";
    }
  };

  const getStatusIcon = () => {
    switch (file.status) {
      case "complete":
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case "incomplete":
        return <Clock className="w-5 h-5 text-yellow-400" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`relative border rounded-lg sm:rounded-xl p-4 sm:p-6 transition-all hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1 ${getStatusColor()} animate-fade-in`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex-shrink-0">
            {getFileIcon(file.filename)}
          </div>
          <div className="min-w-0">
            <h3 className="text-zinc-100 font-semibold text-sm sm:text-base lg:text-lg truncate" title={file.filename}>
              {file.filename}
            </h3>
            <p className="text-zinc-500 text-xs font-mono">{file.upload_id.slice(0, 8)}...</p>
          </div>
        </div>
        <div className="flex-shrink-0">
          {getStatusIcon()}
        </div>
      </div>

      {/* File Info */}
      <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
        <div className="flex justify-between text-xs sm:text-sm">
          <span className="text-zinc-400">Size</span>
          <span className="text-zinc-200 font-medium">{formatFileSize(file.file_size)}</span>
        </div>
        <div className="flex justify-between text-xs sm:text-sm">
          <span className="text-zinc-400">Uploaded</span>
          <span className="text-zinc-200 font-medium">{formatDate(file.upload_time)}</span>
        </div>
        <div className="flex justify-between text-xs sm:text-sm">
          <span className="text-zinc-400">Chunks</span>
          <span className="text-zinc-200 font-medium">
            {file.received_chunks} / {file.total_chunks}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      {file.status !== "complete" && (
        <div className="mb-3 sm:mb-4">
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>Progress</span>
            <span>{file.completion_percentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-500 to-yellow-600 transition-all duration-500"
              style={{ width: `${file.completion_percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Badge */}
      <div className="mb-3 sm:mb-4">
        <span
          className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium ${
            file.status === "complete"
              ? "bg-green-600/20 text-green-400 border border-green-500/30"
              : file.status === "incomplete"
              ? "bg-yellow-600/20 text-yellow-400 border border-yellow-500/30"
              : "bg-red-600/20 text-red-400 border border-red-500/30"
          }`}
        >
          {file.status === "complete" && "✓ Complete"}
          {file.status === "incomplete" && "⏳ Uploading"}
          {file.status === "error" && "✗ Error"}
        </span>
      </div>

      {/* Download Button */}
      <button
        onClick={handleDownload}
        disabled={file.status !== "complete" || downloading}
        className={`w-full flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base rounded-lg font-medium transition-all ${
          file.status === "complete"
            ? downloading
              ? "bg-purple-600/50 text-purple-200 cursor-wait"
              : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/25"
            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
        }`}
      >
        {downloading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            <span>Downloading...</span>
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            <span>{file.status === "complete" ? "Download" : "Not Available"}</span>
          </>
        )}
      </button>
    </div>
  );
}
