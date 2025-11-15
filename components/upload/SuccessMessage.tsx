"use client";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

interface SuccessMessageProps {
  downloadLink: string;
  uploadTime: string;
  isDark: boolean;
  shareId: string;
}

export function SuccessMessage({ downloadLink, uploadTime, isDark, shareId }: SuccessMessageProps) {
  const [copied, setCopied] = useState(false);
  const [copiedShareId, setCopiedShareId] = useState(false);

  const shareLink = typeof window !== 'undefined'
    ? `${window.location.origin}/receiver?share_id=${shareId}`
    : '';

  const copyToClipboard = async (text: string, isCopyingShareId = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isCopyingShareId) {
        setCopiedShareId(true);
        setTimeout(() => setCopiedShareId(false), 2000);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={`backdrop-blur-xl border rounded-2xl p-6 space-y-4 transition-all duration-300 ${isDark
        ? 'bg-linear-to-br from-green-500/20 to-emerald-500/20 border-green-500/30'
        : 'bg-linear-to-br from-green-100 to-emerald-100 border-green-300'
      }`}>
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 backdrop-blur-sm rounded-xl flex items-center justify-center border transition-all duration-300 ${isDark ? 'bg-green-500/30 border-green-400/40' : 'bg-green-200 border-green-400'
          }`}>
          <Check className={`w-6 h-6 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
        </div>
        <div>
          <p className={`font-semibold transition-colors duration-300 ${isDark ? 'text-green-400' : 'text-green-700'
            }`}>Upload Complete!</p>
          <p className={`text-sm transition-colors duration-300 ${isDark ? 'text-green-300/70' : 'text-green-600'
            }`}>Finished in {uploadTime}</p>
        </div>
      </div>


      {/* Download Link Section */}
      <div className={`backdrop-blur-sm rounded-xl p-4 border transition-all duration-300 ${isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/60 border-green-300'
        }`}>
        <p className={`text-xs mb-2 uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-green-300/70' : 'text-green-600'
          }`}>Download Link</p>
        <a
          href={downloadLink}
          target="_blank"
          rel="noreferrer"
          className={`break-all text-sm underline transition-colors duration-300 ${isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-600 hover:text-cyan-700'
            }`}
        >
          {downloadLink}
        </a>
      </div>
    </div>
  );
}
