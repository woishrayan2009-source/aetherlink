"use client";

import { useEffect, useState } from "react";
import { Clock, Upload, FileCheck, Loader2 } from "lucide-react";

interface ActiveUpload {
  upload_id: string;
  filename: string;
  total_chunks: number;
  received_chunks: number;
  completion_percent: number;
  started_at: string;
}

interface CompletedFile {
  upload_id: string;
  filename: string;
  file_size: number;
  completed_at: string;
}

interface RoomState {
  share_id: string;
  active_uploads: ActiveUpload[];
  completed_files: CompletedFile[];
  last_updated: string;
  expires_at: string;
  expires_in: number;
}

interface RoomEvent {
  type: "upload_start" | "chunk_received" | "upload_complete" | "room_state";
  share_id: string;
  upload_id?: string;
  filename?: string;
  data?: any;
  timestamp: string;
}

interface RoomDashboardProps {
  shareId: string;
  endpoint: string;
  onFilesChange?: (files: CompletedFile[]) => void;
}

export function RoomDashboard({ shareId, endpoint, onFilesChange }: RoomDashboardProps) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  // Format time remaining
  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return "Expired";
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Fetch initial room state
  useEffect(() => {
    const fetchRoomState = async () => {
      try {
        const response = await fetch(`${endpoint}/room/${shareId}`);
        if (!response.ok) throw new Error("Failed to fetch room state");
        
        const data: RoomState = await response.json();
        setRoomState(data);
        setExpiresIn(data.expires_in);
        
        if (onFilesChange && data.completed_files) {
          onFilesChange(data.completed_files);
        }
      } catch (error) {
        console.error("Error fetching room state:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRoomState();
  }, [shareId, endpoint, onFilesChange]);

  // Connect to room SSE for real-time updates
  useEffect(() => {
    if (!shareId) return;

    const es = new EventSource(`${endpoint}/room/${shareId}/events`);

    es.onmessage = (event) => {
      try {
        const roomEvent: RoomEvent = JSON.parse(event.data);
        
        if (roomEvent.type === "room_state" && roomEvent.data) {
          const newState = roomEvent.data as RoomState;
          setRoomState(newState);
          setExpiresIn(newState.expires_in);
          
          if (onFilesChange && newState.completed_files) {
            onFilesChange(newState.completed_files);
          }
        } else if (roomEvent.type === "chunk_received" && roomState) {
          // Update specific upload progress
          setRoomState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              active_uploads: prev.active_uploads.map((upload) =>
                upload.upload_id === roomEvent.upload_id
                  ? {
                      ...upload,
                      received_chunks: roomEvent.data.received_chunks,
                      completion_percent: roomEvent.data.percent,
                    }
                  : upload
              ),
            };
          });
        } else if (roomEvent.type === "upload_start" && roomState) {
          // Refresh full state on new upload
          fetch(`${endpoint}/room/${shareId}`)
            .then((res) => res.json())
            .then((data: RoomState) => {
              setRoomState(data);
              setExpiresIn(data.expires_in);
            });
        } else if (roomEvent.type === "upload_complete" && roomState) {
          // Refresh full state on completion
          fetch(`${endpoint}/room/${shareId}`)
            .then((res) => res.json())
            .then((data: RoomState) => {
              setRoomState(data);
              setExpiresIn(data.expires_in);
              if (onFilesChange && data.completed_files) {
                onFilesChange(data.completed_files);
              }
            });
        }
      } catch (error) {
        console.error("Error parsing SSE event:", error);
      }
    };

    es.onerror = () => {
      console.error("SSE connection error");
      es.close();
    };

    setEventSource(es);

    return () => {
      es.close();
    };
  }, [shareId, endpoint, onFilesChange, roomState]);

  // Countdown timer
  useEffect(() => {
    if (expiresIn <= 0) return;

    const timer = setInterval(() => {
      setExpiresIn((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresIn]);

  if (loading) {
    return (
      <div className="mb-8 p-6 bg-zinc-800/50 border border-zinc-700 rounded-lg">
        <div className="flex items-center justify-center gap-3 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading room...</span>
        </div>
      </div>
    );
  }

  if (!roomState) return null;

  const hasActiveUploads = roomState.active_uploads?.length > 0;
  const hasCompletedFiles = roomState.completed_files?.length > 0;

  return (
    <div className="mb-4 sm:mb-6 lg:mb-8 space-y-3 sm:space-y-4">
      {/* Room Status Header */}
      <div className="p-4 sm:p-6 bg-zinc-800/50 border border-zinc-700 rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-zinc-100">Room Active</h3>
              <p className="text-xs sm:text-sm text-zinc-400">
                {roomState?.active_uploads?.length || 0} active · {roomState?.completed_files?.length || 0} completed
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-zinc-900/50 rounded-lg border border-zinc-700 self-start sm:self-auto">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
            <div className="text-right">
              <p className="text-xs text-zinc-500">Expires in</p>
              <p className="text-xs sm:text-sm font-semibold text-zinc-200">
                {formatTimeRemaining(expiresIn)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Uploads */}
      {hasActiveUploads && (
        <div className="p-4 sm:p-6 bg-zinc-800/50 border border-zinc-700 rounded-lg">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            <h4 className="text-base sm:text-lg font-semibold text-zinc-100">Active Uploads</h4>
          </div>
          
          <div className="space-y-2 sm:space-y-3">
            {roomState.active_uploads.map((upload) => (
              <div key={upload.upload_id} className="p-3 sm:p-4 bg-zinc-900/50 rounded-lg border border-zinc-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs sm:text-sm font-medium text-zinc-200 truncate pr-2 sm:pr-4">
                    {upload.filename}
                  </span>
                  <span className="text-xs text-zinc-400 whitespace-nowrap">
                    {upload.completion_percent}%
                  </span>
                </div>
                
                <div className="relative h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-linear-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
                    style={{ width: `${upload.completion_percent}%` }}
                  />
                </div>
                
                <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    {upload.received_chunks} / {upload.total_chunks} chunks
                  </span>
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Uploading...
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Files Summary */}
      {hasCompletedFiles && (
        <div className="p-4 sm:p-6 bg-zinc-800/50 border border-zinc-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <FileCheck className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
            <h4 className="text-base sm:text-lg font-semibold text-zinc-100">Ready to Download</h4>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">
            {roomState.completed_files.length} file{roomState.completed_files.length !== 1 ? "s" : ""} available below
          </p>
        </div>
      )}

      {/* Empty State */}
      {!hasActiveUploads && !hasCompletedFiles && (
        <div className="p-6 sm:p-8 bg-zinc-800/50 border border-zinc-700 rounded-lg text-center">
          <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">📭</div>
          <p className="text-sm sm:text-base text-zinc-400 font-medium">No files yet</p>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Waiting for files to be uploaded to this room
          </p>
        </div>
      )}
    </div>
  );
}
