import { NetworkProfile } from '@/types/NetworkProfile';
import axios from 'axios';
const API_URL = process.env.NEXT_PUBLIC_SERVER_URL!;

export const bufferToHex = (buf: ArrayBuffer) => {
    const arr = new Uint8Array(buf);
    return Array.from(arr)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export const uploadChunk = async (
    uploadID: string,
    idx: number,
    blob: Blob,
    networkProfile: NetworkProfile,
    endpoint?: string
): Promise<void> => {
    const uploadEndpoint = endpoint || API_URL;

    if (networkProfile.delay > 0) {
        await new Promise(r => setTimeout(r, networkProfile.delay));
    }

    if (Math.random() * 100 < networkProfile.failureRate) {
        console.log(`🔴 Simulated network failure for chunk ${idx}`);
        throw new Error('Simulated network failure');
    }

    const res = await axios.put(`${uploadEndpoint}/upload/${uploadID}/${idx}`, blob, {
        headers: { "Content-Type": blob.type || "application/octet-stream" },
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