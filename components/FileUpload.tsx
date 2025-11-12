"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Check, File, Zap, Wifi, WifiOff } from "lucide-react";
import { detectConnectionSpeed, bufferToHex, formatFileSize, uploadChunk } from "@/utils/helpers/file";
import * as THREE from "three";

const ChunkVisualizer = ({ progress, totalChunks, uploadedChunks }: { progress: number; totalChunks: number; uploadedChunks: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const chunksRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.z = 35;
    camera.position.y = 5;
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(300, 300);
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x60a5fa, 1, 100);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(0xa855f7, 0.8, 100);
    pointLight2.position.set(-10, -10, 10);
    scene.add(pointLight2);

    const chunks: THREE.Mesh[] = [];
    const gridSize = Math.ceil(Math.sqrt(totalChunks));
    const spacing = 2;

    for (let i = 0; i < totalChunks; i++) {
      const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      const material = new THREE.MeshPhongMaterial({
        color: 0x1e293b,
        transparent: true,
        opacity: 0.3,
        emissive: 0x1e293b,
        emissiveIntensity: 0.1,
      });
      const cube = new THREE.Mesh(geometry, material);

      const x = (i % gridSize) * spacing - (gridSize * spacing) / 2;
      const z = Math.floor(i / gridSize) * spacing - (gridSize * spacing) / 2;

      cube.position.set(x, -20, z);
      cube.userData.targetY = 0;
      cube.userData.uploaded = false;

      scene.add(cube);
      chunks.push(cube);
    }
    chunksRef.current = chunks;

    const animate = () => {
      requestAnimationFrame(animate);

      chunks.forEach((cube, idx) => {
        cube.rotation.x += 0.005;
        cube.rotation.y += 0.005;

        if (cube.userData.uploaded) {
          cube.position.y += (cube.userData.targetY - cube.position.y) * 0.1;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [totalChunks]);

  useEffect(() => {
    const chunksToActivate = Math.floor((uploadedChunks / totalChunks) * chunksRef.current.length);

    chunksRef.current.forEach((cube, idx) => {
      if (idx < chunksToActivate && !cube.userData.uploaded) {
        cube.userData.uploaded = true;
        cube.userData.targetY = 0;

        (cube.material as THREE.MeshPhongMaterial).color.setHex(0x3b82f6);
        (cube.material as THREE.MeshPhongMaterial).emissive.setHex(0x3b82f6);
        (cube.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.5;
        (cube.material as THREE.MeshPhongMaterial).opacity = 1;
      }
    });
  }, [uploadedChunks, totalChunks]);

  return (
    <div className="flex items-center justify-center">
      <div ref={containerRef} className="rounded-2xl overflow-hidden" />
    </div>
  );
};

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

  const MAX_WORKERS = 4;
  const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8080";

  useEffect(() => {
    const updateNetwork = async () => {
      const info = await detectConnectionSpeed();
      setNetworkInfo(info);
    };

    updateNetwork();

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      connection.addEventListener("change", updateNetwork);
      return () => connection.removeEventListener("change", updateNetwork);
    }
  }, []);

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
    const CHUNK_SIZE = networkInfo.chunkSize;
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
          await uploadChunk(uploadID, idx, blob, priority);
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

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl">
        <div className="relative backdrop-blur-2xl bg-white/5 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] border border-white/10 overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 pointer-events-none" />

          <div className="relative bg-linear-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-xl p-8 text-center border-b border-white/10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl mb-4 border border-white/20">
              <Upload className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">AetherLink</h1>
            <p className="text-blue-100 text-sm">Secure & Resilient File Transfer</p>
          </div>

          <div className="relative p-8 space-y-6">
            <div className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-blue-400/30">
                  {networkInfo.type === "Auto" ? <Wifi className="w-5 h-5 text-blue-400" /> : <Wifi className="w-5 h-5 text-green-400" />}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Network: {networkInfo.type}</p>
                  <p className="text-slate-300 text-xs">Chunk: {formatFileSize(networkInfo.chunkSize)}</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <input type="file" id="file-upload" onChange={handleFileChange} className="hidden" />
              <label
                htmlFor="file-upload"
                className={`block w-full p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 backdrop-blur-xl ${file
                  ? "border-blue-400/50 bg-blue-500/10"
                  : "border-white/20 bg-white/5 hover:border-blue-400/50 hover:bg-white/10"
                  }`}
              >
                <div className="flex flex-col items-center justify-center space-y-3">
                  {file ? (
                    <>
                      <div className="w-12 h-12 bg-blue-500/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-blue-400/30">
                        <File className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-white font-medium">{file.name}</p>
                        <p className="text-slate-300 text-sm mt-1">{formatFileSize(file.size)}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                        <Upload className="w-6 h-6 text-slate-300" />
                      </div>
                      <div className="text-center">
                        <p className="text-white font-medium">Choose a file</p>
                        <p className="text-slate-300 text-sm mt-1">or drag and drop here</p>
                      </div>
                    </>
                  )}
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-500/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-purple-400/30">
                  <Zap className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Parallel Upload</p>
                  <p className="text-slate-300 text-xs">Faster transfers</p>
                </div>
              </div>
              <button
                onClick={() => setParallel(!parallel)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 backdrop-blur-sm ${parallel ? "bg-blue-500/80 border border-blue-400/50" : "bg-white/10 border border-white/20"
                  }`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-lg transition-transform duration-300 ${parallel ? "transform translate-x-6" : ""
                  }`} />
              </button>
            </div>

            <button
              disabled={!file || isUploading}
              onClick={startUpload}
              className="w-full bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl backdrop-blur-xl border border-white/10 shadow-lg transition-all duration-300"
            >
              {isUploading ? <span>Uploading... {progress}%</span> : <span>Start Upload</span>}
            </button>

            {isUploading && totalChunks > 0 && (
              <div className="space-y-4">
                <ChunkVisualizer progress={progress} totalChunks={totalChunks} uploadedChunks={uploadedChunks} />

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Progress</span>
                    <span className="text-blue-400 font-semibold">{progress}%</span>
                  </div>
                  <div className="h-2 bg-white/10 backdrop-blur-sm rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-linear-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {downloadLink && (
              <div className="bg-linear-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-xl border border-green-400/30 rounded-2xl p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-500/30 backdrop-blur-sm rounded-xl flex items-center justify-center border border-green-400/40">
                    <Check className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-green-400 font-semibold">Upload Complete!</p>
                    <p className="text-green-300/70 text-sm">Finished in {uploadTime}</p>
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <p className="text-slate-300 text-xs mb-2 uppercase tracking-wider">Download Link</p>
                  <a
                    href={downloadLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 break-all text-sm underline"
                  >
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