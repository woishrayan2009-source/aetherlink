"use client";
import { useState } from "react";

export default function FileUpload() {
    const [file, setFile] = useState<File | null>(null);
    const [progress, setProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [parallel, setParallel] = useState(false);
    const [downloadLink, setDownloadLink] = useState("");
    const [uploadTime, setUploadTime] = useState<string>("");

    // Match server client uploader defaults: 5 KB chunks (small for demo/testing)
    const CHUNK_SIZE = 5 * 1024; // 5 KB per chunk
    const API_URL = process.env.NEXT_PUBLIC_SERVER_URL;

    // helper: convert ArrayBuffer (from crypto.subtle.digest) to hex string
    const bufferToHex = (buf: ArrayBuffer) => {
        const arr = new Uint8Array(buf);
        return Array.from(arr)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFile(e.target.files?.[0] || null);
        setProgress(0);
        setDownloadLink("");
        setUploadTime("");
    };

    // Upload a single chunk with PUT to /upload/{uploadID}/{idx}
    const uploadChunk = async (uploadID: string, idx: number, chunk: Blob, contentType = "application/octet-stream") => {
        const res = await fetch(`${API_URL}/upload/${uploadID}/${idx}`, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: chunk,
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`chunk ${idx} failed: ${res.status} ${text}`);
        }
    };

    const startUpload = async () => {
        if (!file) return alert("Select a file first.");
        if (!API_URL) return alert("API_URL not set (NEXT_PUBLIC_SERVER_URL)");
        setIsUploading(true);
        setProgress(0);
        setUploadTime("");

        const startTime = performance.now();
        const uploadID = `${file.name.replace(/[^a-z0-9.-_]/gi, "")}-${Date.now()}`;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        // compute per-chunk hashes and overall hash
        const chunkHashes: string[] = new Array(totalChunks);
        try {
            // compute chunk hashes
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const blob = file.slice(start, end);
                const ab = await blob.arrayBuffer();
                const digest = await crypto.subtle.digest("SHA-256", ab);
                chunkHashes[i] = bufferToHex(digest);
            }

            // compute overall hash (digest of entire file)
            const whole = await file.arrayBuffer();
            const overallDigest = await crypto.subtle.digest("SHA-256", whole);
            const fileHash = bufferToHex(overallDigest);

            // init metadata on server
            const metadata = {
                upload_id: uploadID,
                filename: file.name,
                total_chunks: totalChunks,
                chunk_size: CHUNK_SIZE,
                chunk_hashes: chunkHashes,
                file_hash: fileHash,
            } as any;

            const initRes = await fetch(`${API_URL}/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(metadata),
            });
            if (initRes.status !== 201) {
                const t = await initRes.text().catch(() => "");
                throw new Error(`init failed: ${initRes.status} ${t}`);
            }

            // query status to resume if needed
            const statusRes = await fetch(`${API_URL}/status/${uploadID}`);
            let received: number[] = [];
            if (statusRes.ok) {
                const parsed = await statusRes.json().catch(() => ({}));
                received = parsed.received_chunks || [];
            }
            const receivedSet = new Set<number>(received);

            // upload missing chunks
            let uploadedCount = 0;

            const uploadWithRetry = async (idx: number, attempt = 1): Promise<void> => {
                const start = idx * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const blob = file.slice(start, end);
                const contentType = file.type || "application/octet-stream";
                try {
                    await uploadChunk(uploadID, idx, blob, contentType);
                    uploadedCount++;
                    setProgress(Math.round((uploadedCount / totalChunks) * 100));
                } catch (err) {
                    if (attempt < 5) {
                        // backoff
                        await new Promise((r) => setTimeout(r, attempt * 300));
                        return uploadWithRetry(idx, attempt + 1);
                    }
                    throw err;
                }
            };

            if (parallel) {
                // Fixed parallel upload: batch chunks into groups and upload each batch concurrently
                const MAX_WORKERS = 4;
                const chunksToUpload: number[] = [];
                for (let i = 0; i < totalChunks; i++) {
                    if (!receivedSet.has(i)) {
                        chunksToUpload.push(i);
                    }
                }

                // Process chunks in batches of MAX_WORKERS
                for (let i = 0; i < chunksToUpload.length; i += MAX_WORKERS) {
                    const batch = chunksToUpload.slice(i, i + MAX_WORKERS);
                    await Promise.all(batch.map(idx => uploadWithRetry(idx)));
                }
            } else {
                for (let i = 0; i < totalChunks; i++) {
                    if (receivedSet.has(i)) continue;
                    await uploadWithRetry(i);
                }
            }

            // complete
            const completeRes = await fetch(`${API_URL}/complete/${uploadID}`, {
                method: "POST",
            });
            if (!completeRes.ok) {
                const t = await completeRes.text().catch(() => "");
                throw new Error(`complete failed: ${completeRes.status} ${t}`);
            }

            const endTime = performance.now();
            const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
            setUploadTime(`${durationSeconds}s`);

            // Construct public download URL (server serves /static)
            const downloadUrl = `${API_URL.replace(/\/$/, "")}/static/${uploadID}/${encodeURIComponent(file.name)}`;
            setDownloadLink(downloadUrl);
        } catch (err: any) {
            alert(`Upload failed: ${err?.message || err}`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-6">
            <div className="w-full max-w-md bg-gray-900 rounded-2xl p-6 shadow-lg">
                <h1 className="text-2xl font-bold mb-4 text-center text-blue-400">
                    AetherLink File Sender
                </h1>

                <input
                    type="file"
                    onChange={handleFileChange}
                    className="w-full text-sm text-gray-400 mb-4"
                />

                <div className="flex items-center mb-4 justify-between">
                    <label className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            checked={parallel}
                            onChange={() => setParallel(!parallel)}
                        />
                        <span className="text-sm">Enable Parallel Upload (Beta)</span>
                    </label>
                </div>

                <button
                    disabled={!file || isUploading}
                    onClick={startUpload}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-xl py-2 font-semibold"
                >
                    {isUploading ? "Uploading..." : "Upload"}
                </button>

                {isUploading && (
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-4">
                        <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                {downloadLink && (
                    <div className="mt-4 text-center">
                        <p className="text-green-400 font-semibold mb-2">
                            ✓ Upload completed in {uploadTime}
                        </p>
                        <p className="text-sm text-gray-400 mb-1">Download URL:</p>
                        <a 
                            href={downloadLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 break-all text-sm underline"
                        >
                            {downloadLink}
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
