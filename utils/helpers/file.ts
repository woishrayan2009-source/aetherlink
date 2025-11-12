import axios from 'axios';
const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8080";

export const bufferToHex = (buf: ArrayBuffer) => {
    const arr = new Uint8Array(buf);
    return Array.from(arr)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};

export async function uploadChunk(uploadID: string, idx: number, chunk: Blob, priority = "normal") {

    const res = await axios.put(`${API_URL}/upload/${uploadID}/${idx}`, chunk, {
        headers: { "Content-Type": chunk.type || "application/octet-stream", "X-Priority": priority },
    });

    if (res.status !== 200) {
        const text = await res.data.text().catch(() => "");
        throw new Error(`chunk ${idx} failed: ${res.status} ${text}`);
    }

    return true;
}

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