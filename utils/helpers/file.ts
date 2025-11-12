import { NetworkProfile } from '@/types/NetworkProfile';
import axios from 'axios';
const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8080";

export
    const getStatusColor = () => {
        switch (currentProfile.color) {
            case "green": return isDark ? "text-green-400 bg-green-500/20 border-green-500/30" : "text-green-600 bg-green-100 border-green-300";
            case "yellow": return isDark ? "text-yellow-400 bg-yellow-500/20 border-yellow-500/30" : "text-yellow-600 bg-yellow-100 border-yellow-300";
            case "red": return isDark ? "text-red-400 bg-red-500/20 border-red-500/30" : "text-red-600 bg-red-100 border-red-300";
            default: return isDark ? "text-cyan-400 bg-cyan-500/20 border-cyan-500/30" : "text-cyan-600 bg-cyan-100 border-cyan-300";
        }
    };

export const bufferToHex = (buf: ArrayBuffer) => {
    const arr = new Uint8Array(buf);
    return Array.from(arr)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};

export const uploadChunk = async (
    uploadID: string,
    idx: number,
    blob: Blob,
    priority: string,
    networkProfile: NetworkProfile
): Promise<void> => {
    if (networkProfile.delay > 0) {
        await new Promise(r => setTimeout(r, networkProfile.delay));
    }

    if (Math.random() * 100 < networkProfile.failureRate) {
        console.log(`🔴 Simulated network failure for chunk ${idx}`);
        throw new Error('Simulated network failure');
    }

    const formData = new FormData();
    formData.append("chunk", blob);
    formData.append("chunk_index", idx.toString());
    formData.append("priority", priority);

    const res = await axios.put(`${API_URL}/upload/${uploadID}/${idx}`, blob, {
        headers: { "Content-Type": blob.type || "application/octet-stream", "X-Priority": priority },
    });

    if (res.status !== 200) {
        const text = await res.data.text().catch(() => "");
        throw new Error(`chunk ${idx} failed: ${res.status} ${text}`);
    }
};

export const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

export const detectConnectionSpeed = async (): Promise<{ type: string; chunkSize: number }> => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    if (connection) {
        const effectiveType = connection.effectiveType;
        const downlink = connection.downlink;

        if (effectiveType === "slow-2g" || effectiveType === "2g") {
            return { type: "2G", chunkSize: 5 * 1024 };
        } else if (effectiveType === "3g") {
            return { type: "3G", chunkSize: 512 * 1024 };
        } else if (effectiveType === "4g" && downlink < 5) {
            return { type: "4G", chunkSize: 2 * 1024 * 1024 };
        } else if (effectiveType === "4g" || downlink >= 5) {
            return { type: "5G", chunkSize: 5 * 1024 * 1024 };
        }
    }

    return { type: "Auto", chunkSize: 10 * 1024 * 1024 };
};