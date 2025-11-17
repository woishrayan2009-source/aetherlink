"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { File, Files } from "lucide-react";

export function UploadModeToggle() {
  const pathname = usePathname();
  const isMultiMode = pathname.includes('/multi');

  return (
    <div className="flex gap-2 p-1 rounded-lg bg-slate-800/50 border border-white/10">
      <Link
        href="/sender"
        className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all ${
          !isMultiMode
            ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
        }`}
      >
        <File className="w-4 h-4" />
        <span>Single File</span>
      </Link>
      <Link
        href="/sender/multi"
        className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all ${
          isMultiMode
            ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
        }`}
      >
        <Files className="w-4 h-4" />
        <span>Multiple Files</span>
      </Link>
    </div>
  );
}
