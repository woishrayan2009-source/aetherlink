"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Check, File, Zap, Wifi, Signal, Moon, Sun } from "lucide-react";
import { bufferToHex, detectConnectionSpeed, uploadChunk, formatFileSize } from "@/utils/helpers/file";
import { ChunkVisualizer } from "./ChunkVisualizer";
import { NETWORK_PROFILES } from "@/types/NetworkProfile";

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [parallel, setParallel] = useState(false);
  const [downloadLink, setDownloadLink] = useState("");
  const [uploadTime, setUploadTime] = useState<string>("");
  const [networkInfo, setNetworkInfo] = useState({ type: "Auto", chunkSize: 10 * 1024 * 1024 });
  const [totalChunks, setTotalChunks] = useState(0);
  const [uploadedChunks, setUploadedChunks] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<string>("normal");
  const [isDark, setIsDark] = useState(true);

  const currentProfile = NETWORK_PROFILES[selectedProfile];
  const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8080";

  useEffect(() => {
    const updateNetwork = async () => {
      if (selectedProfile === "normal") {
        const info = await detectConnectionSpeed();
        setNetworkInfo(info);
      } else {
        setNetworkInfo({
          type: currentProfile.speed,
          chunkSize: currentProfile.chunkSize
        });
      }
    };

    updateNetwork();

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      connection.addEventListener("change", updateNetwork);
      return () => connection.removeEventListener("change", updateNetwork);
    }
  }, [selectedProfile, currentProfile.speed, currentProfile.chunkSize]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setProgress(0);
    setDownloadLink("");
    setUploadTime("");
    setUploadedChunks(0);
  };

  const startUpload = async () => {
    if (!file) return alert("Select a file first.");
    if (!API_URL) return alert("API_URL not set");

    setIsUploading(true);
    setProgress(0);
    setUploadTime("");
    setUploadedChunks(0);

    const startTime = performance.now();
    const uploadID = `${file.name.replace(/[^a-z0-9.-_]/gi, "")}-${Date.now()}`;
    const CHUNK_SIZE = currentProfile.chunkSize;
    const MAX_WORKERS = currentProfile.workers;
    const chunks = Math.ceil(file.size / CHUNK_SIZE);
    setTotalChunks(chunks);

    const chunkHashes: string[] = new Array(chunks);
    try {
      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const blob = file.slice(start, end);
        const ab = await blob.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", ab);
        chunkHashes[i] = bufferToHex(digest);
      }

      const whole = await file.arrayBuffer();
      const overallDigest = await crypto.subtle.digest("SHA-256", whole);
      const fileHash = bufferToHex(overallDigest);

      const metadata = {
        upload_id: uploadID,
        filename: file.name,
        total_chunks: chunks,
        chunk_size: CHUNK_SIZE,
        chunk_hashes: chunkHashes,
        file_hash: fileHash,
      };

      const initRes = await fetch(`${API_URL}/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      });

      if (!initRes.ok) throw new Error(`init failed: ${initRes.status}`);

      const statusRes = await fetch(`${API_URL}/status/${uploadID}`);
      let received: number[] = [];
      if (statusRes.ok) {
        const parsed = await statusRes.json() as { received_chunks: number[] };
        received = parsed.received_chunks || [];
      }
      const receivedSet = new Set<number>(received);

      let uploadedCount = received.length;
      setUploadedChunks(uploadedCount);
      setProgress(Math.round((uploadedCount / chunks) * 100));

      const uploadWithRetry = async (idx: number, attempt = 1): Promise<void> => {
        const start = idx * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const blob = file.slice(start, end);
        const priority = "normal";
        try {
          await uploadChunk(uploadID, idx, blob, priority, currentProfile);
          uploadedCount++;
          setUploadedChunks(uploadedCount);
          setProgress(Math.round((uploadedCount / chunks) * 100));
        } catch (err) {
          if (attempt < 6) {
            await new Promise((r) => setTimeout(r, attempt * 400));
            return uploadWithRetry(idx, attempt + 1);
          }
          throw err;
        }
      };

      if (parallel) {
        const chunksToUpload: number[] = [];
        for (let i = 0; i < chunks; i++) {
          if (!receivedSet.has(i)) chunksToUpload.push(i);
        }

        for (let i = 0; i < chunksToUpload.length; i += MAX_WORKERS) {
          const batch = chunksToUpload.slice(i, i + MAX_WORKERS);
          await Promise.all(batch.map((idx) => uploadWithRetry(idx)));
        }
      } else {
        for (let i = 0; i < chunks; i++) {
          if (receivedSet.has(i)) continue;
          await uploadWithRetry(i);
        }
      }

      const completeRes = await fetch(`${API_URL}/complete/${uploadID}`, { method: "POST" });
      if (!completeRes.ok) throw new Error(`complete failed: ${completeRes.status}`);

      const completeJson = await completeRes.json() as { status: string; download_url?: string };
      const endTime = performance.now();
      setUploadTime(((endTime - startTime) / 1000).toFixed(2) + "s");

      if (completeJson.download_url) {
        setDownloadLink(`${API_URL.replace(/\/$/, "")}${completeJson.download_url}`);
      } else {
        setDownloadLink(`${API_URL.replace(/\/$/, "")}/static/${uploadID}/${encodeURIComponent(file.name)}`);
      }
    } catch (err: any) {
      alert("Upload failed: " + (err?.message || err));
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusColor = () => {
    switch (currentProfile.color) {
      case "green": return isDark ? "text-green-400 bg-green-500/20 border-green-500/30" : "text-green-600 bg-green-100 border-green-300";
      case "yellow": return isDark ? "text-yellow-400 bg-yellow-500/20 border-yellow-500/30" : "text-yellow-600 bg-yellow-100 border-yellow-300";
      case "red": return isDark ? "text-red-400 bg-red-500/20 border-red-500/30" : "text-red-600 bg-red-100 border-red-300";
      default: return isDark ? "text-cyan-400 bg-cyan-500/20 border-cyan-500/30" : "text-cyan-600 bg-cyan-100 border-cyan-300";
    }
  };

  return (
    <div className={`h-screen overflow-hidden ${isDark ? 'dark bg-linear-to-br from-slate-950 via-cyan-950 to-slate-950' : 'bg-linear-to-br from-sky-50 via-cyan-50 to-blue-50'} transition-colors duration-300`}>
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setIsDark(!isDark)}
          className={`p-3 rounded-xl transition-all duration-300 ${isDark
              ? 'bg-white/10 hover:bg-white/20 border border-white/20'
              : 'bg-cyan-100 hover:bg-cyan-200 border border-cyan-300'
            }`}
        >
          {isDark ? <Sun className="w-5 h-5 text-yellow-300" /> : <Moon className="w-5 h-5 text-cyan-700" />}
        </button>
      </div>

      <div className="h-full flex flex-col lg:flex-row gap-6 p-4 lg:p-6 max-w-7xl mx-auto overflow-hidden">
        {/* Main Upload Box */}
        <div className="flex-1 lg:grow-2 flex flex-col min-h-0">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className={`backdrop-blur-2xl rounded-3xl shadow-2xl border overflow-hidden transition-all duration-300 ${isDark
                ? 'bg-slate-900/40 border-white/10'
                : 'bg-white/60 border-cyan-200'
              }`}>
          <div className={`absolute inset-0 pointer-events-none ${isDark
              ? 'bg-linear-to-br from-cyan-500/10 via-blue-500/10 to-cyan-500/10'
              : 'bg-linear-to-br from-cyan-200/20 via-blue-200/20 to-cyan-200/20'
            }`} />

          <div className={`relative backdrop-blur-xl p-8 text-center border-b transition-all duration-300 ${isDark
              ? 'bg-linear-to-r from-cyan-600/20 to-blue-600/20 border-white/10'
              : 'bg-linear-to-r from-cyan-200/60 to-blue-200/60 border-cyan-300'
            }`}>
            <div className={`inline-flex items-center justify-center w-16 h-16 backdrop-blur-md rounded-2xl mb-4 border transition-all duration-300 ${isDark
                ? 'bg-white/10 border-white/20'
                : 'bg-white/80 border-cyan-300'
              }`}>
              <Upload className={`w-8 h-8 ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`} />
            </div>
            <h1 className={`text-3xl font-bold mb-2 transition-colors duration-300 ${isDark ? 'text-white' : 'text-cyan-900'
              }`}>AetherLink</h1>
            <p className={`text-sm transition-colors duration-300 ${isDark ? 'text-cyan-100' : 'text-cyan-700'
              }`}>Secure & Resilient File Transfer</p>
          </div>

          <div className="relative p-8 space-y-6">
            <div className={`backdrop-blur-xl rounded-xl border p-4 transition-all duration-300 ${isDark
                ? 'bg-white/5 border-white/10'
                : 'bg-white/80 border-cyan-200'
              }`}>
              <label className={`block text-sm font-medium mb-3 transition-colors duration-300 ${isDark ? 'text-cyan-300' : 'text-cyan-700'
                }`}>
                Network Simulator
              </label>
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
                disabled={isUploading}
                className={`w-full px-4 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDark
                    ? 'bg-slate-800/50 border-white/20 text-white focus:ring-cyan-500/50'
                    : 'bg-white border-cyan-300 text-cyan-900 focus:ring-cyan-400'
                  }`}
              >
                {Object.values(NETWORK_PROFILES).map(profile => (
                  <option key={profile.name} value={profile.name}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={`flex items-center justify-between p-4 backdrop-blur-xl rounded-xl border transition-all duration-300 ${getStatusColor()}`}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  <Signal className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{currentProfile.speed}</p>
                  <p className="text-xs opacity-80">
                    Latency: {currentProfile.delay}ms • Loss: {currentProfile.failureRate}%
                  </p>
                </div>
              </div>
            </div>

            <div className="relative group">
              <input
                type="file"
                id="file-upload"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className={`block relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 ${file
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
                      <div className={`w-16 h-16 backdrop-blur-sm rounded-2xl flex items-center justify-center border transition-all duration-300 ${isDark
                          ? 'bg-cyan-500/20 border-cyan-400/30'
                          : 'bg-cyan-100 border-cyan-300'
                        }`}>
                        <File className={`w-8 h-8 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                      </div>
                      <div className="text-center">
                        <p className={`font-semibold text-lg transition-colors duration-300 ${isDark ? 'text-white' : 'text-cyan-900'
                          }`}>{file.name}</p>
                        <p className={`text-sm mt-1 transition-colors duration-300 ${isDark ? 'text-cyan-300' : 'text-cyan-600'
                          }`}>{formatFileSize(file.size)}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`w-16 h-16 backdrop-blur-sm rounded-2xl flex items-center justify-center border transition-all duration-300 ${isDark
                          ? 'bg-white/10 border-white/20'
                          : 'bg-cyan-100 border-cyan-300'
                        }`}>
                        <Upload className={`w-8 h-8 ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`} />
                      </div>
                      <div className="text-center">
                        <p className={`font-semibold text-lg transition-colors duration-300 ${isDark ? 'text-white' : 'text-cyan-900'
                          }`}>Choose a file</p>
                        <p className={`text-sm mt-1 transition-colors duration-300 ${isDark ? 'text-cyan-300' : 'text-cyan-600'
                          }`}>or drag and drop here</p>
                      </div>
                    </>
                  )}
                </div>
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isDark
                    ? 'bg-linear-to-br from-cyan-500/5 to-blue-500/5'
                    : 'bg-linear-to-br from-cyan-100/50 to-blue-100/50'
                  }`} />
              </label>
            </div>

            <div className={`flex items-center justify-between p-4 backdrop-blur-xl rounded-xl border transition-all duration-300 ${isDark
                ? 'bg-white/5 border-white/10'
                : 'bg-white/80 border-cyan-200'
              }`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 backdrop-blur-sm rounded-lg flex items-center justify-center border transition-all duration-300 ${isDark
                    ? 'bg-cyan-500/20 border-cyan-400/30'
                    : 'bg-cyan-100 border-cyan-300'
                  }`}>
                  <Zap className={`w-5 h-5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                </div>
                <div>
                  <p className={`font-medium text-sm transition-colors duration-300 ${isDark ? 'text-white' : 'text-cyan-900'
                    }`}>Parallel Upload</p>
                  <p className={`text-xs transition-colors duration-300 ${isDark ? 'text-cyan-300' : 'text-cyan-600'
                    }`}>Workers: {currentProfile.workers}</p>
                </div>
              </div>
              <button
                onClick={() => setParallel(!parallel)}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 backdrop-blur-sm border ${parallel
                    ? isDark
                      ? "bg-cyan-500/80 border-cyan-400/50"
                      : "bg-cyan-500 border-cyan-600"
                    : isDark
                      ? "bg-white/10 border-white/20"
                      : "bg-gray-200 border-gray-300"
                  }`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-lg transition-transform duration-300 ${parallel ? "transform translate-x-6" : ""
                  }`} />
              </button>
            </div>

            <button
              disabled={!file || isUploading}
              onClick={startUpload}
              className={`w-full font-semibold py-4 rounded-xl backdrop-blur-xl border shadow-lg transition-all duration-300 ${!file || isUploading
                  ? isDark
                    ? "bg-slate-700 border-slate-600 text-slate-400 cursor-not-allowed"
                    : "bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed"
                  : isDark
                    ? "bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 border-white/10 text-white"
                    : "bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 border-cyan-600 text-white"
                }`}
            >
              {isUploading ? <span>Uploading... {progress}%</span> : <span>Start Upload</span>}
            </button>

            {isUploading && totalChunks > 0 && (
              <div className="space-y-4">
                <ChunkVisualizer progress={progress} totalChunks={totalChunks} uploadedChunks={uploadedChunks} />

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className={`transition-colors duration-300 ${isDark ? 'text-cyan-300' : 'text-cyan-700'
                      }`}>Progress</span>
                    <span className={`font-semibold transition-colors duration-300 ${isDark ? 'text-cyan-400' : 'text-cyan-600'
                      }`}>{progress}%</span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden backdrop-blur-sm transition-all duration-300 ${isDark ? 'bg-white/10' : 'bg-cyan-100'
                    }`}>
                    <div
                      className={`h-full transition-all duration-300 ${isDark
                          ? 'bg-linear-to-r from-cyan-500 to-blue-500'
                          : 'bg-linear-to-r from-cyan-400 to-blue-400'
                        }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {downloadLink && (
              <div className={`backdrop-blur-xl border rounded-2xl p-6 space-y-4 transition-all duration-300 ${isDark
                  ? 'bg-linear-to-br from-green-500/20 to-emerald-500/20 border-green-500/30'
                  : 'bg-linear-to-br from-green-100 to-emerald-100 border-green-300'
                }`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 backdrop-blur-sm rounded-xl flex items-center justify-center border transition-all duration-300 ${isDark
                      ? 'bg-green-500/30 border-green-400/40'
                      : 'bg-green-200 border-green-400'
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
                <div className={`backdrop-blur-sm rounded-xl p-4 border transition-all duration-300 ${isDark
                    ? 'bg-slate-900/50 border-white/10'
                    : 'bg-white/60 border-green-300'
                  }`}>
                  <p className={`text-xs mb-2 uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-green-300/70' : 'text-green-600'
                    }`}>Download Link</p>
                  <a
                    href={downloadLink}
                    target="_blank"
                    rel="noreferrer"
                    className={`break-all text-sm underline transition-colors duration-300 ${isDark
                        ? 'text-cyan-400 hover:text-cyan-300'
                        : 'text-cyan-600 hover:text-cyan-700'
                      }`}
                  >
                    {downloadLink}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
          </div>
        </div>

      {/* Animation Panel - Side */}
      <div className="flex-1 lg:grow flex flex-col min-h-0">
        <div className="h-full overflow-y-auto custom-scrollbar">
          <div className={`backdrop-blur-2xl rounded-3xl shadow-2xl border overflow-hidden transition-all duration-300 flex flex-col ${isDark
            ? 'bg-slate-900/40 border-white/10'
            : 'bg-white/60 border-cyan-200'
          }`}>
          <div className={`relative backdrop-blur-xl p-6 text-center border-b transition-all duration-300 shrink-0 ${isDark
              ? 'bg-linear-to-r from-cyan-600/20 to-blue-600/20 border-white/10'
              : 'bg-linear-to-r from-cyan-200/60 to-blue-200/60 border-cyan-300'
            }`}>
            <h2 className={`text-xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-cyan-900'
              }`}>Upload Activity</h2>
          </div>

          <div className="flex-1 p-6 space-y-4 overflow-y-auto">
            {isUploading ? (
              <>
                {/* Animated Upload Visualization */}
                <div className="space-y-6">
                  {/* Pulsing Upload Icon */}
                  <div className="flex justify-center">
                    <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${isDark ? 'bg-cyan-500/20' : 'bg-cyan-100'
                      }`}>
                      <div className={`absolute inset-0 rounded-full animate-ping ${isDark ? 'bg-cyan-500/30' : 'bg-cyan-400/30'
                        }`} />
                      <Upload className={`w-12 h-12 z-10 animate-pulse ${isDark ? 'text-cyan-400' : 'text-cyan-600'
                        }`} />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3">
                    <div className={`p-4 rounded-xl backdrop-blur-sm border transition-all duration-300 ${isDark
                        ? 'bg-white/5 border-white/10'
                        : 'bg-white/80 border-cyan-200'
                      }`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                          Chunks Uploaded
                        </span>
                        <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
                          {uploadedChunks}/{totalChunks}
                        </span>
                      </div>
                      <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-cyan-100'
                        }`}>
                        <div
                          className={`h-full transition-all duration-300 ${isDark
                              ? 'bg-linear-to-r from-cyan-500 to-blue-500'
                              : 'bg-linear-to-r from-cyan-400 to-blue-400'
                            }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl backdrop-blur-sm border transition-all duration-300 ${isDark
                        ? 'bg-white/5 border-white/10'
                        : 'bg-white/80 border-cyan-200'
                      }`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                          Progress
                        </span>
                        <span className={`text-2xl font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                          {progress}%
                        </span>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl backdrop-blur-sm border transition-all duration-300 ${isDark
                        ? 'bg-white/5 border-white/10'
                        : 'bg-white/80 border-cyan-200'
                      }`}>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                            Mode
                          </span>
                          <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
                            {parallel ? 'Parallel' : 'Sequential'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                            Workers
                          </span>
                          <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
                            {currentProfile.workers}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                            Network
                          </span>
                          <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-cyan-900'}`}>
                            {currentProfile.speed}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Animated Dots */}
                  <div className="flex justify-center space-x-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-full ${isDark ? 'bg-cyan-500' : 'bg-cyan-600'
                          }`}
                        style={{
                          animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : downloadLink ? (
              /* Success State */
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${isDark ? 'bg-green-500/20' : 'bg-green-100'
                    }`}>
                    <Check className={`w-12 h-12 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className={`text-xl font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                    Upload Complete!
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-green-300' : 'text-green-600'}`}>
                    Time: {uploadTime}
                  </p>
                  <p className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                    {uploadedChunks} chunks uploaded successfully
                  </p>
                </div>
              </div>
            ) : (
              /* Idle State */
              <div className="space-y-4 text-center py-8">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${isDark ? 'bg-white/10' : 'bg-cyan-100'
                  }`}>
                  <Upload className={`w-10 h-10 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-cyan-900'}`}>
                    Ready to Upload
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                    Select a file to start
                  </p>
                </div>
                <div className={`p-4 rounded-xl backdrop-blur-sm border ${isDark
                    ? 'bg-white/5 border-white/10'
                    : 'bg-white/80 border-cyan-200'
                  }`}>
                  <div className="space-y-2 text-left text-sm">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-cyan-500' : 'bg-cyan-600'}`} />
                      <span className={isDark ? 'text-cyan-300' : 'text-cyan-700'}>
                        Chunked upload with resume
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-cyan-500' : 'bg-cyan-600'}`} />
                      <span className={isDark ? 'text-cyan-300' : 'text-cyan-700'}>
                        SHA-256 integrity checks
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-cyan-500' : 'bg-cyan-600'}`} />
                      <span className={isDark ? 'text-cyan-300' : 'text-cyan-700'}>
                        Network adaptive streaming
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 text-center p-4 border-t border-white/10">
            <p className={`text-sm transition-colors duration-300 ${isDark ? 'text-slate-500' : 'text-cyan-600'
              }`}>
              Powered by AetherLink
            </p>
          </div>
        </div>
        </div>
      </div>
      </div>
    </div>
  );
}
