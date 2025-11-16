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


      {/* Share ID Section - PROMINENT */}
      <div className={`backdrop-blur-sm rounded-xl p-5 border-2 transition-all duration-300 ${isDark
        ? 'bg-purple-500/20 border-purple-500/50'
        : 'bg-purple-100 border-purple-400'
        }`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`text-xs uppercase tracking-wider font-semibold transition-colors duration-300 ${isDark ? 'text-purple-300' : 'text-purple-700'
            }`}>🔑 Share ID (Required for Access)</p>
        </div>
        <div className={`flex items-center justify-between gap-3 p-3 rounded-lg mb-3 transition-all duration-300 ${isDark ? 'bg-slate-900/70' : 'bg-white/80'
          }`}>
          <code className={`flex-1 text-sm font-mono break-all transition-colors duration-300 ${isDark ? 'text-purple-300' : 'text-purple-700'
            }`}>
            {shareId}
          </code>
          <button
            onClick={() => copyToClipboard(shareId, true)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 ${isDark
              ? 'bg-purple-500/30 hover:bg-purple-500/40 text-purple-300'
              : 'bg-purple-200 hover:bg-purple-300 text-purple-700'
              }`}
          >
            {copiedShareId ? (
              <>
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span className="text-sm font-medium">Copy</span>
              </>
            )}
          </button>
        </div>
        <p className={`text-xs transition-colors duration-300 ${isDark ? 'text-purple-300/70' : 'text-purple-600'
          }`}>
          📤 Share this ID with recipients so they can access your files
        </p>
      </div>

      {/* Share Link Section */}
      <div className={`backdrop-blur-sm rounded-xl p-4 border transition-all duration-300 ${isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/60 border-green-300'
        }`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`text-xs uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-green-300/70' : 'text-green-600'
            }`}>🔗 Quick Share Link</p>
        </div>
        <div className={`flex items-center justify-between gap-3 p-3 rounded-lg transition-all duration-300 ${isDark ? 'bg-slate-900/50' : 'bg-white/50'
          }`}>
          <a
            href={shareLink}
            target="_blank"
            rel="noreferrer"
            className={`flex-1 break-all text-sm underline transition-colors duration-300 ${isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-600 hover:text-cyan-700'
              }`}
          >
            {shareLink}
          </a>
          <button
            onClick={() => copyToClipboard(shareLink, false)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 ${isDark
              ? 'bg-slate-700/50 hover:bg-slate-700/70 text-cyan-300'
              : 'bg-slate-200 hover:bg-slate-300 text-cyan-700'
              }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span className="text-sm font-medium">Copy</span>
              </>
            )}
          </button>
        </div>
        <p className={`text-xs mt-2 transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>
          📧 Or send this direct link (includes share ID)
        </p>
      </div>

      {/* Download Link Section */}
      <div className={`backdrop-blur-sm rounded-xl p-4 border transition-all duration-300 ${isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/60 border-green-300'
        }`}>
        <p className={`text-xs mb-2 uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-green-300/70' : 'text-green-600'
          }`}>📥 Direct Download</p>
        <a
          href={downloadLink}
          target="_blank"
          rel="noreferrer"
          className={`break-all text-sm underline transition-colors duration-300 flex items-center gap-2 ${isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-600 hover:text-cyan-700'
            }`}
        >
          <ExternalLink className="w-4 h-4 flex-shrink-0" />
          <span>{downloadLink}</span>
        </a>
      </div>
    </div>
  );
}
