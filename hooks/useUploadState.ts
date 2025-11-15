import { useState } from "react";
import { UploadMetrics, CostComparison } from "@/types/UploadMetrics";
import { CompressionSettings } from "@/components/upload/CompressionToggle";

export function useUploadState() {
    const [file, setFile] = useState<File | null>(null);
    const [progress, setProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [downloadLink, setDownloadLink] = useState("");
    const [uploadTime, setUploadTime] = useState<string>("");
    const [totalChunks, setTotalChunks] = useState(0);
    const [uploadedChunks, setUploadedChunks] = useState(0);
    const [selectedProfile, setSelectedProfile] = useState<string>("normal");
    const [costComparison, setCostComparison] = useState<CostComparison | null>(null);
    const [isCompressing, setIsCompressing] = useState(false);
    const [compressionProgress, setCompressionProgress] = useState(0);
    const [shareId, setShareId] = useState("");
    const [activeWorkers, setActiveWorkers] = useState(0);

    const [metrics, setMetrics] = useState<UploadMetrics>({
        successfulChunks: 0,
        failedRetries: 0,
        startTime: 0,
        bandwidth: 0,
        totalBytes: 0,
        wastedBytes: 0
    });

    const [compressionSettings, setCompressionSettings] = useState<CompressionSettings>({
        enabled: false,
        quality: 70,
        level: 'balanced',
        estimatedSize: 0,
        originalSize: 0
    });

    return {
        file, setFile,
        progress, setProgress,
        isUploading, setIsUploading,
        isCancelling, setIsCancelling,
        showCancelDialog, setShowCancelDialog,
        downloadLink, setDownloadLink,
        uploadTime, setUploadTime,
        totalChunks, setTotalChunks,
        uploadedChunks, setUploadedChunks,
        selectedProfile, setSelectedProfile,
        costComparison, setCostComparison,
        metrics, setMetrics,
        compressionSettings, setCompressionSettings,
        isCompressing, setIsCompressing,
        compressionProgress, setCompressionProgress,
        shareId, setShareId,
        activeWorkers, setActiveWorkers
    };
}
