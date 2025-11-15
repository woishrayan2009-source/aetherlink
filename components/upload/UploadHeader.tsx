"use client";
import { Upload } from "lucide-react";
import Image from "next/image";

export function UploadHeader() {
  return (
    <div className={`relative backdrop-blur-xl p-8 text-center border-b transition-all duration-300 ${'bg-linear-to-r from-cyan-600/20 to-blue-600/20 border-white/10'
      }`}>
      <div className={`inline-flex items-center justify-center w-16 h-16 backdrop-blur-md rounded-2xl mb-4 border transition-all duration-300 ${'bg-white/10 border-white/20'
        }`}>
        <Image unoptimized fetchPriority="high" height={100} width={100} alt="AetherLink Icon" src={'/logo.png'} />
      </div>
      <h1 className={`text-3xl font-bold mb-2 transition-colors duration-300 ${'text-white'
        }`}>AetherLink</h1>
      <p className={`text-sm transition-colors duration-300 ${'text-cyan-100'
        }`}>Secure & Resilient File Transfer</p>
    </div>
  );
}
