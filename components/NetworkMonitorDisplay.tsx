'use client';

import React from 'react';
import { AdaptiveNetworkState } from '@/hooks/useAdaptiveNetworkMonitor';

interface NetworkMonitorDisplayProps {
    networkState: AdaptiveNetworkState;
    className?: string;
}

export function NetworkMonitorDisplay({ networkState, className = '' }: NetworkMonitorDisplayProps) {
    const { metrics, chunkSize, workers, quality, isMonitoring } = networkState;

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const getQualityColor = (quality: string) => {
        switch (quality) {
            case 'poor': return 'text-red-500';
            case 'fair': return 'text-yellow-500';
            case 'good': return 'text-green-500';
            case 'excellent': return 'text-blue-500';
            default: return 'text-gray-500';
        }
    };

    const getQualityBg = (quality: string) => {
        switch (quality) {
            case 'poor': return 'bg-red-500/10 border-red-500/20';
            case 'fair': return 'bg-yellow-500/10 border-yellow-500/20';
            case 'good': return 'bg-green-500/10 border-green-500/20';
            case 'excellent': return 'bg-blue-500/10 border-blue-500/20';
            default: return 'bg-gray-500/10 border-gray-500/20';
        }
    };

    return (
        <div className={`p-4 rounded-lg border ${getQualityBg(quality)} ${className}`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                    Network Monitor
                </h3>
                <span className={`text-xs font-medium uppercase ${getQualityColor(quality)}`}>
                    {quality}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                    <span className="text-gray-500">Type:</span>
                    <span className="ml-2 font-medium">{metrics.effectiveType || 'Unknown'}</span>
                </div>
                <div>
                    <span className="text-gray-500">Speed:</span>
                    <span className="ml-2 font-medium">{metrics.downlink || 0} Mbps</span>
                </div>
                <div>
                    <span className="text-gray-500">Latency:</span>
                    <span className="ml-2 font-medium">{Math.round(metrics.latency)} ms</span>
                </div>
                <div>
                    <span className="text-gray-500">Jitter:</span>
                    <span className="ml-2 font-medium">{Math.round(metrics.jitter)} ms</span>
                </div>
                <div>
                    <span className="text-gray-500">Chunk:</span>
                    <span className="ml-2 font-medium">{formatBytes(chunkSize)}</span>
                </div>
                <div>
                    <span className="text-gray-500">Workers:</span>
                    <span className="ml-2 font-medium">{workers}</span>
                </div>
            </div>

            {metrics.saveData && (
                <div className="mt-3 text-xs text-orange-500 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Data Saver Mode Active
                </div>
            )}
        </div>
    );
}
