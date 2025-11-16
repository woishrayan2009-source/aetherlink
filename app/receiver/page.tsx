"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { FileList } from "@/components/receiver";
import { ReceiverHeader } from "@/components/receiver/ReceiverHeader";
import { ShareIDInput } from "@/components/receiver";

const DEFAULT_ENDPOINT = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8080";

export interface FileMetadata {
    upload_id: string;
    filename: string;
    total_chunks: number;
    received_chunks: number;
    file_size: number;
    upload_time: string;
    status: "complete" | "incomplete" | "error";
    completion_percentage: number;
}

export default function ReceiverPage() {
    const searchParams = useSearchParams();
    const [shareID, setShareID] = useState<string>(searchParams.get("share_id") || "");
    const [files, setFiles] = useState<FileMetadata[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date");
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchFiles = async () => {
        if (!shareID) {
            setFiles([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`${DEFAULT_ENDPOINT}/files?share_id=${encodeURIComponent(shareID)}`);

            if (!response.ok) {
                if (response.status === 400 || response.status === 403) {
                    throw new Error("Invalid share ID. Please check your access code.");
                }
                throw new Error(`Failed to fetch files: ${response.status}`);
            }

            const data = await response.json() as { files: FileMetadata[], count: number };
            setFiles(data.files || []);
            setError(null);
        } catch (err) {
            setError((err as Error).message || "Failed to load files");
            console.error("Error fetching files:", err);
            setFiles([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, [shareID]); // Re-fetch when share ID changes

    useEffect(() => {
        if (!autoRefresh || !shareID) return;

        const interval = setInterval(() => {
            fetchFiles();
        }, 5000); // Refresh every 5 seconds

        return () => clearInterval(interval);
    }, [autoRefresh, shareID]);

    const filteredFiles = files.filter((file) =>
        file.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.upload_id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedFiles = [...filteredFiles].sort((a, b) => {
        switch (sortBy) {
            case "name":
                return a.filename.localeCompare(b.filename);
            case "size":
                return b.file_size - a.file_size;
            case "date":
            default:
                return new Date(b.upload_time).getTime() - new Date(a.upload_time).getTime();
        }
    });

    return (
        <div className="min-h-screen bg-linear-to-br from-zinc-900 via-zinc-800 to-zinc-900">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {!shareID ? (
                    <ShareIDInput onSubmit={setShareID} />
                ) : (
                    <>
                        <ReceiverHeader
                            fileCount={files.length}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            sortBy={sortBy}
                            onSortChange={setSortBy}
                            autoRefresh={autoRefresh}
                            onAutoRefreshToggle={setAutoRefresh}
                            onRefresh={fetchFiles}
                            isRefreshing={loading}
                            shareID={shareID}
                            onChangeShareID={() => setShareID("")}
                        />

                        {loading && files.length === 0 ? (
                            <div className="flex items-center justify-center min-h-[400px]">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                                    <p className="text-zinc-400">Loading files...</p>
                                </div>
                            </div>
                        ) : error && files.length === 0 ? (
                            <div className="flex items-center justify-center min-h-[400px]">
                                <div className="text-center">
                                    <div className="text-6xl mb-4">⚠️</div>
                                    <p className="text-red-400 font-semibold mb-2">Error Loading Files</p>
                                    <p className="text-zinc-400 text-sm mb-4">{error}</p>
                                    <button
                                        onClick={fetchFiles}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            </div>
                        ) : sortedFiles.length === 0 ? (
                            <div className="flex items-center justify-center min-h-[400px]">
                                <div className="text-center">
                                    <div className="text-6xl mb-4">📂</div>
                                    <p className="text-zinc-400 font-semibold mb-2">
                                        {searchQuery ? "No files match your search" : "No files available"}
                                    </p>
                                    <p className="text-zinc-500 text-sm">
                                        {searchQuery
                                            ? "Try adjusting your search query"
                                            : "Upload files from the sender page to see them here"}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <FileList files={sortedFiles} endpoint={DEFAULT_ENDPOINT} shareID={shareID} />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
