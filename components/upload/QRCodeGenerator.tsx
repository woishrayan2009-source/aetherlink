"use client";
import { useState } from "react";
import QRCode from "react-qr-code";
import { QrCode, Copy, Check } from "lucide-react";

interface QRCodeGeneratorProps {
  shareId: string;
  isDark?: boolean;
  disabled?: boolean;
}

export function QRCodeGenerator({ shareId, isDark = true, disabled = false }: QRCodeGeneratorProps) {
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate the receiver URL with share ID
  const receiverUrl = `${process.env.NEXT_PUBLIC_ORIGIN_URL}/receiver?share_id=${encodeURIComponent(shareId)}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(receiverUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!shareId || disabled) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl border bg-slate-800/50 border-white/10">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 rounded-lg bg-cyan-500/20">
            <QrCode className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-semibold text-xs sm:text-sm text-white">
              Share Room
            </h3>
            <p className="text-xs text-gray-400 hidden sm:block">
              Generate QR code for receivers
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowQR(!showQR)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showQR
              ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {showQR ? 'Hide QR' : 'Show QR'}
        </button>
      </div>

      {showQR && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="p-4 rounded-xl border bg-slate-800/50 border-white/10">
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white rounded-lg">
                <QRCode
                  value={receiverUrl}
                  size={200}
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                />
              </div>

              <div className="w-full space-y-2">
                <p className="text-xs text-gray-400 text-center">
                  Scan this QR code on another device to join the room
                </p>

                <div className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-lg">
                  <code className="flex-1 text-xs text-cyan-400 font-mono break-all">
                    {receiverUrl}
                  </code>
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}