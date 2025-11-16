import { Search, SortAsc, RefreshCw, ToggleLeft, ToggleRight, Download, Key, X } from "lucide-react";

interface ReceiverHeaderProps {
  fileCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: "date" | "name" | "size";
  onSortChange: (sort: "date" | "name" | "size") => void;
  autoRefresh: boolean;
  onAutoRefreshToggle: (enabled: boolean) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  shareID?: string;
  onChangeShareID?: () => void;
}

export function ReceiverHeader({
  fileCount,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  autoRefresh,
  onAutoRefreshToggle,
  onRefresh,
  isRefreshing,
  shareID,
  onChangeShareID,
}: ReceiverHeaderProps) {
  return (
    <div className="mb-4 sm:mb-6 lg:mb-8">
      {/* Title Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-linear-to-r from-purple-400 to-pink-600">
            📥 File Receiver
          </h1>
          <p className="text-zinc-400 mt-1 sm:mt-2 text-sm sm:text-base">
            Browse and download available files • {fileCount} file{fileCount !== 1 ? "s" : ""} available
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Share ID Display */}
          {shareID && onChangeShareID && (
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-purple-600/10 border border-purple-500/30 rounded-lg">
              <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
              <span className="text-xs sm:text-sm font-mono text-purple-300">{shareID.slice(0, 8)}...</span>
              <button
                onClick={onChangeShareID}
                className="ml-1 sm:ml-2 p-0.5 sm:p-1 hover:bg-purple-500/20 rounded transition-colors"
                title="Change share ID"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
              </button>
            </div>
          )}
          
          {/* Auto-refresh Toggle */}
          <button
            onClick={() => onAutoRefreshToggle(!autoRefresh)}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg border transition-all ${
              autoRefresh
                ? "bg-purple-600/20 border-purple-500 text-purple-400"
                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
            }`}
            title={autoRefresh ? "Auto-refresh enabled" : "Auto-refresh disabled"}
          >
            {autoRefresh ? <ToggleRight className="w-4 h-4 sm:w-5 sm:h-5" /> : <ToggleLeft className="w-4 h-4 sm:w-5 sm:h-5" />}
            <span className="text-xs sm:text-sm font-medium hidden sm:inline">Auto</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh file list"
          >
            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="text-xs sm:text-sm font-medium hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Controls Section */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        {/* Search Bar */}
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 text-sm sm:text-base bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <SortAsc className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-zinc-500 pointer-events-none" />
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as "date" | "name" | "size")}
            className="appearance-none pl-8 sm:pl-10 pr-8 sm:pr-10 py-2 sm:py-3 text-sm sm:text-base bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer w-full sm:min-w-[180px]"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
          </select>
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      {autoRefresh && (
        <div className="mt-3 sm:mt-4 px-3 sm:px-4 py-2 bg-purple-600/10 border border-purple-500/30 rounded-lg text-xs sm:text-sm text-purple-300 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Auto-refresh enabled • Updates every 5 seconds</span>
          <span className="sm:hidden">Auto-refresh active</span>
        </div>
      )}
    </div>
  );
}
