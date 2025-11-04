"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Check, File, Zap } from "lucide-react";

type InitResponse = { upload_id: string };
type CompleteResponse = { status: string; download_url?: string; file_hash?: string };

export default function SendPage() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [parallel, setParallel] = useState(false);
  const [downloadLink, setDownloadLink] = useState("");
  const [uploadTime, setUploadTime] = useState<string>("");
  const [sseStatus, setSseStatus] = useState<any>(null);

  const CHUNK_SIZE = 1024 * 1024;
  const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8080";

  const sseRef = useRef<EventSource | null>(null);

  const bufferToHex = (buf: ArrayBuffer) => {
    const arr = new Uint8Array(buf);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  useEffect(() => {
    return () => {
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setProgress(0);
    setDownloadLink("");
    setUploadTime("");
  };

  async function uploadChunk(uploadID: string, idx: number, chunk: Blob, priority = "normal") {
    const res = await fetch(`${API_URL}/upload/${uploadID}/${idx}`, {
      method: "PUT",
      headers: { "Content-Type": chunk.type || "application/octet-stream", "X-Priority": priority },
      body: chunk,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`chunk ${idx} failed: ${res.status} ${text}`);
    }
    return true;
  }

  const startSSE = (uploadID: string) => {
    if (sseRef.current) {
      sseRef.current.close();
    }
    const src = new EventSource(`${API_URL.replace(/\/$/, "")}/events/${uploadID}`);
    sseRef.current = src;
    src.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        setSseStatus(data);
        if (data.completed_percent !== undefined) {
          setProgress(data.completed_percent);
        } else if (data.received_count && data.total_chunks) {
          const p = Math.round((data.received_count * 100) / data.total_chunks);
          setProgress(p);
        }
      } catch (e) {}
    };
    src.onerror = () => {
      // SSE might close; we'll rely on polling via /status if needed
      src.close();
      sseRef.current = null;
    };
  };

  const startUpload = async () => {
    if (!file) return alert("Select a file first.");
    if (!API_URL) return alert("API_URL not set");

    setIsUploading(true);
    setProgress(0);
    setUploadTime("");

    const startTime = performance.now();
    const uploadID = `${file.name.replace(/[^a-z0-9.-_]/gi, "")}-${Date.now()}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // compute chunk hashes and overall file hash
    const chunkHashes: string[] = new Array(totalChunks);
    try {
      for (let i = 0; i < totalChunks; i++) {
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
        total_chunks: totalChunks,
        chunk_size: CHUNK_SIZE,
        chunk_hashes: chunkHashes,
        file_hash: fileHash,
      };

      // persist session to localStorage to allow resume
      localStorage.setItem(`aetherlink:session:${uploadID}`, JSON.stringify({ uploadID, filename: file.name, totalChunks, createdAt: Date.now() }));

      // init session
      const initRes = await fetch(`${API_URL}/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      });
      if (initRes.status !== 201) {
        const t = await initRes.text().catch(() => "");
        throw new Error(`init failed: ${initRes.status} ${t}`);
      }

      // subscribe SSE
      startSSE(uploadID);

      // query status -> which chunks already present
      const statusRes = await fetch(`${API_URL}/status/${uploadID}`);
      let received: number[] = [];
      if (statusRes.ok) {
        const parsed = await statusRes.json().catch(() => ({}));
        received = parsed.received_chunks || [];
      }
      const receivedSet = new Set<number>(received);

      let uploadedCount = received.length;
      setProgress(Math.round((uploadedCount / totalChunks) * 100));

      const uploadWithRetry = async (idx: number, attempt = 1): Promise<void> => {
        const start = idx * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const blob = file.slice(start, end);
        const priority = "normal"; // placeholder — you can add UI to set this per file or chunk
        try {
          await uploadChunk(uploadID, idx, blob, priority);
          uploadedCount++;
          // update progress from count if SSE not active
          setProgress(Math.round((uploadedCount / totalChunks) * 100));
        } catch (err) {
          if (attempt < 6) {
            await new Promise((r) => setTimeout(r, attempt * 400));
            return uploadWithRetry(idx, attempt + 1);
          }
          throw err;
        }
      };

      if (parallel) {
        const MAX_WORKERS = 4;
        const chunksToUpload: number[] = [];
        for (let i = 0; i < totalChunks; i++) {
          if (!receivedSet.has(i)) chunksToUpload.push(i);
        }
        for (let i = 0; i < chunksToUpload.length; i += MAX_WORKERS) {
          const batch = chunksToUpload.slice(i, i + MAX_WORKERS);
          await Promise.all(batch.map((idx) => uploadWithRetry(idx)));
        }
      } else {
        for (let i = 0; i < totalChunks; i++) {
          if (receivedSet.has(i)) continue;
          await uploadWithRetry(i);
        }
      }

      // complete
      const completeRes = await fetch(`${API_URL}/complete/${uploadID}`, { method: "POST" });
      if (!completeRes.ok) {
        const t = await completeRes.text().catch(() => "");
        throw new Error(`complete failed: ${completeRes.status} ${t}`);
      }
      const completeJson = (await completeRes.json()) as CompleteResponse;
      const endTime = performance.now();
      setUploadTime(((endTime - startTime) / 1000).toFixed(2) + "s");
      if (completeJson.download_url) {
        const url = completeJson.download_url;
        setDownloadLink(`${API_URL.replace(/\/$/, "")}${url}`);
      } else {
        setDownloadLink(`${API_URL.replace(/\/$/, "")}/static/${uploadID}/${encodeURIComponent(file.name)}`);
      }

      // cleanup session persistence
      localStorage.removeItem(`aetherlink:session:${uploadID}`);
    } catch (err: any) {
      alert("Upload failed: " + (err?.message || err));
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl">
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-800/50 overflow-hidden">
          <div className="bg-linear-to-r from-blue-600 to-purple-600 p-8 text-center relative overflow-hidden">
            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">AetherLink</h1>
              <p className="text-blue-100 text-sm">Secure & Resilient File Transfer</p>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div className="relative">
              <input type="file" id="file-upload" onChange={handleFileChange} className="hidden" />
              <label htmlFor="file-upload" className={`block w-full p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${file ? "border-blue-500 bg-blue-500/10" : "border-slate-700 bg-slate-800/50 hover:border-blue-500/50 hover:bg-slate-800"}`}>
                <div className="flex flex-col items-center justify-center space-y-3">
                  {file ? (
                    <>
                      <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                        <File className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-white font-medium">{file.name}</p>
                        <p className="text-slate-400 text-sm mt-1">{formatFileSize(file.size)}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-slate-700/50 rounded-xl flex items-center justify-center">
                        <Upload className="w-6 h-6 text-slate-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-white font-medium">Choose a file</p>
                        <p className="text-slate-400 text-sm mt-1">or drag and drop here</p>
                      </div>
                    </>
                  )}
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Parallel Upload</p>
                  <p className="text-slate-400 text-xs">Faster transfers (Beta)</p>
                </div>
              </div>
              <button onClick={() => setParallel(!parallel)} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${parallel ? "bg-blue-500" : "bg-slate-700"}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${parallel ? "transform translate-x-6" : ""}`}></div>
              </button>
            </div>

            <button disabled={!file || isUploading} onClick={startUpload} className="w-full bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl">
              {isUploading ? <span>Uploading... {progress}%</span> : <span>Start Upload</span>}
            </button>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Progress</span>
                  <span className="text-blue-400 font-semibold">{progress}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-linear-to-r from-blue-500 to-purple-500 rounded-full" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {downloadLink && (
              <div className="bg-linear-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-2xl p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-500/30 rounded-xl flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-green-400 font-semibold">Upload Complete!</p>
                    <p className="text-green-300/70 text-sm">Finished in {uploadTime}</p>
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-slate-400 text-xs mb-2 uppercase tracking-wider">Download Link</p>
                  <a href={downloadLink} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 break-all text-sm underline">
                    {downloadLink}
                  </a>
                </div>
              </div>
            )}

          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-slate-500 text-sm">Powered by AetherLink • Secure File Transfer</p>
        </div>
      </div>
    </div>
  );
}
