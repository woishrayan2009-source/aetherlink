"use client";

import { useState } from "react";
import { Key, ArrowRight } from "lucide-react";

interface ShareIDInputProps {
  onSubmit: (shareID: string) => void;
}

export function ShareIDInput({ onSubmit }: ShareIDInputProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    
    if (!trimmed) {
      setError("Please enter a share ID");
      return;
    }
    
    if (trimmed.length < 8) {
      setError("Share ID must be at least 8 characters");
      return;
    }
    
    onSubmit(trimmed);
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-purple-600/20 rounded-full mb-3 sm:mb-4">
            <Key className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-linear-to-r from-purple-400 to-pink-600 mb-2 sm:mb-3">
            Enter Share ID
          </h1>
          <p className="text-sm sm:text-base text-zinc-400">
            Enter the share ID to access your files
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <input
              type="text"
              placeholder="Enter share ID..."
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError("");
              }}
              className="w-full px-3 sm:px-4 py-3 sm:py-4 text-sm sm:text-base bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all font-mono"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-xs sm:text-sm text-red-400">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-purple-500/25"
          >
            <span>Access Files</span>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </form>

        <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-zinc-800/30 border border-zinc-700/50 rounded-lg">
          <p className="text-sm text-zinc-400 mb-2">
            <span className="font-semibold text-zinc-300">Don't have a share ID?</span>
          </p>
          <p className="text-xs text-zinc-500">
            The share ID is provided when files are uploaded. Ask the sender for the access code.
          </p>
        </div>
      </div>
    </div>
  );
}
