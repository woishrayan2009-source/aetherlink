"use client";
import { Upload } from "lucide-react";
import Image from "next/image";

interface UploadHeaderProps {
  isDark: boolean;
}

export function UploadHeader({ isDark }: UploadHeaderProps) {
  return (
    <div className={`relative backdrop-blur-xl p-8 text-center border-b transition-all duration-300 ${
      isDark
        ? 'bg-linear-to-r from-cyan-600/20 to-blue-600/20 border-white/10'
        : 'bg-linear-to-r from-cyan-200/60 to-blue-200/60 border-cyan-300'
    }`}>
      <div className={`inline-flex items-center justify-center w-16 h-16 backdrop-blur-md rounded-2xl mb-4 border transition-all duration-300 ${
        isDark ? 'bg-white/10 border-white/20' : 'bg-white/80 border-cyan-300'
      }`}>
        {/* <Upload className={`w-8 h-8 ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`} /> */}
        <Image unoptimized fetchPriority="high" height={100} width={100} alt="AetherLink Icon" src={'/logo.png'} />
      </div>
      <h1 className={`text-3xl font-bold mb-2 transition-colors duration-300 ${
        isDark ? 'text-white' : 'text-cyan-900'
      }`}>AetherLink</h1>
      <p className={`text-sm transition-colors duration-300 ${
        isDark ? 'text-cyan-100' : 'text-cyan-700'
      }`}>Secure & Resilient File Transfer</p>
    </div>
  );
}
