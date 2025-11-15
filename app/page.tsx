'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(true);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-linear-to-br from-slate-950 via-cyan-950 to-slate-950' : 'bg-linear-to-br from-sky-50 via-cyan-50 to-blue-50'} transition-colors duration-300`}>
      {/* Theme Toggle */}
      <button
        onClick={() => setIsDark(!isDark)}
        className={`fixed top-6 right-6 p-3 rounded-full backdrop-blur-xl transition-all duration-300 z-50 ${isDark
            ? 'bg-white/10 hover:bg-white/20 text-yellow-300'
            : 'bg-slate-900/10 hover:bg-slate-900/20 text-slate-900'
          }`}
      >
        {isDark ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        )}
      </button>

      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-6xl w-full">
          {/* Header */}
          <div className="text-center mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className={`inline-flex items-center gap-3 mb-6 px-6 py-3 rounded-full backdrop-blur-xl ${isDark ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-cyan-500/20 border border-cyan-500/30'
              }`}>
              <svg className={`w-8 h-8 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h1 className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                AetherLink
              </h1>
            </div>
            <p className={`text-xl ${isDark ? 'text-gray-300' : 'text-gray-700'} max-w-2xl mx-auto`}>
              High-reliability file transfer system designed for unstable networks
            </p>
            <p className={`text-sm mt-3 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
              Choose your role to get started
            </p>
          </div>

          {/* Role Selection Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Sender Card */}
            <div
              onClick={() => router.push('/sender')}
              className={`group relative overflow-hidden rounded-3xl backdrop-blur-2xl border transition-all duration-500 cursor-pointer transform hover:scale-105 hover:-translate-y-2 animate-in fade-in slide-in-from-left duration-700 ${isDark
                  ? 'bg-slate-900/40 border-white/10 hover:bg-slate-900/60 hover:border-cyan-500/50'
                  : 'bg-white/60 border-cyan-200 hover:bg-white/80 hover:border-cyan-400'
                }`}
            >
              {/* linear Overlay */}
              <div className={`absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${isDark
                  ? 'bg-linear-to-br from-cyan-500/10 via-blue-500/10 to-cyan-500/10'
                  : 'bg-linear-to-br from-cyan-200/30 via-blue-200/30 to-cyan-200/30'
                }`} />

              <div className="relative p-8">
                {/* Icon */}
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 group-hover:scale-110 ${isDark ? 'bg-cyan-500/20 group-hover:bg-cyan-500/30' : 'bg-cyan-100 group-hover:bg-cyan-200'
                  }`}>
                  <svg className={`w-10 h-10 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>

                {/* Content */}
                <h2 className={`text-3xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Sender
                </h2>
                <p className={`text-base mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Upload and share files with adaptive network optimization
                </p>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  {[
                    'Chunked uploads with retry logic',
                    'Real-time progress tracking',
                    'Adaptive network monitoring',
                    'Compression support'
                  ].map((feature, idx) => (
                    <li key={idx} className={`flex items-start gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <svg className={`w-5 h-5 mt-0.5 shrink-0 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className={`flex items-center gap-2 text-sm font-semibold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                  Start Sending
                  <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Receiver Card */}
            <div
              onClick={() => router.push('/receiver')}
              className={`group relative overflow-hidden rounded-3xl backdrop-blur-2xl border transition-all duration-500 cursor-pointer transform hover:scale-105 hover:-translate-y-2 animate-in fade-in slide-in-from-right duration-700 ${isDark
                  ? 'bg-slate-900/40 border-white/10 hover:bg-slate-900/60 hover:border-purple-500/50'
                  : 'bg-white/60 border-cyan-200 hover:bg-white/80 hover:border-purple-400'
                }`}
            >
              {/* linear Overlay */}
              <div className={`absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${isDark
                  ? 'bg-linear-to-br from-purple-500/10 via-pink-500/10 to-purple-500/10'
                  : 'bg-linear-to-br from-purple-200/30 via-pink-200/30 to-purple-200/30'
                }`} />

              <div className="relative p-8">
                {/* Icon */}
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 group-hover:scale-110 ${isDark ? 'bg-purple-500/20 group-hover:bg-purple-500/30' : 'bg-purple-100 group-hover:bg-purple-200'
                  }`}>
                  <svg className={`w-10 h-10 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                </div>

                {/* Content */}
                <h2 className={`text-3xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Receiver
                </h2>
                <p className={`text-base mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Access, download, or stream files shared with you
                </p>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  {[
                    'Browse available files',
                    'Download or stream content',
                    'Real-time transfer status',
                    'Secure file access'
                  ].map((feature, idx) => (
                    <li key={idx} className={`flex items-start gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <svg className={`w-5 h-5 mt-0.5 shrink-0 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className={`flex items-center gap-2 text-sm font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                  Start Receiving
                  <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className={`text-center mt-16 animate-in fade-in slide-in-from-bottom duration-700 delay-300`}>
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
              Built for unstable networks • Adaptive chunking • End-to-end integrity
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}