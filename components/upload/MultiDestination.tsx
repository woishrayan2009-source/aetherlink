"use client";
import { useState } from "react";
import { Cloud, Globe, Server, Plus, Trash2, Check } from "lucide-react";

export interface Destination {
  id: string;
  name: string;
  type: 'aws' | 'azure' | 'gcp' | 'custom';
  endpoint: string;
  enabled: boolean;
  status?: 'pending' | 'uploading' | 'success' | 'failed';
  progress?: number;
}

interface MultiDestinationProps {
  destinations: Destination[];
  onDestinationsChange: (destinations: Destination[]) => void;
  isDark: boolean;
  isUploading: boolean;
}

export function MultiDestination({
  destinations,
  onDestinationsChange,
  isDark,
  isUploading
}: MultiDestinationProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDestination, setNewDestination] = useState<Partial<Destination>>({
    type: 'custom',
    enabled: true
  });

  const destinationIcons = {
    aws: <Cloud className="w-4 h-4" />,
    azure: <Cloud className="w-4 h-4" />,
    gcp: <Cloud className="w-4 h-4" />,
    custom: <Server className="w-4 h-4" />
  };

  const destinationColors = {
    aws: { bg: 'from-orange-500/10 to-amber-500/10', border: 'orange-500/30', text: 'orange-300' },
    azure: { bg: 'from-blue-500/10 to-cyan-500/10', border: 'blue-500/30', text: 'blue-300' },
    gcp: { bg: 'from-red-500/10 to-yellow-500/10', border: 'red-500/30', text: 'red-300' },
    custom: { bg: 'from-purple-500/10 to-pink-500/10', border: 'purple-500/30', text: 'purple-300' }
  };

  const addDestination = () => {
    if (!newDestination.name || !newDestination.endpoint) {
      alert('Please fill in all fields');
      return;
    }

    const destination: Destination = {
      id: Date.now().toString(),
      name: newDestination.name!,
      type: newDestination.type as Destination['type'],
      endpoint: newDestination.endpoint!,
      enabled: true,
      status: 'pending'
    };

    onDestinationsChange([...destinations, destination]);
    setNewDestination({ type: 'custom', enabled: true });
    setShowAddForm(false);
  };

  const removeDestination = (id: string) => {
    onDestinationsChange(destinations.filter(d => d.id !== id));
  };

  const toggleDestination = (id: string) => {
    onDestinationsChange(
      destinations.map(d => 
        d.id === id ? { ...d, enabled: !d.enabled } : d
      )
    );
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'failed': return '❌';
      case 'uploading': return '⏳';
      default: return '⏸️';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'success': return isDark ? 'text-emerald-400' : 'text-emerald-600';
      case 'failed': return isDark ? 'text-red-400' : 'text-red-600';
      case 'uploading': return isDark ? 'text-blue-400' : 'text-blue-600';
      default: return isDark ? 'text-gray-400' : 'text-gray-600';
    }
  };

  const enabledCount = destinations.filter(d => d.enabled).length;

  return (
    <div className={`backdrop-blur-xl border rounded-2xl p-6 space-y-4 transition-all duration-300 ${
      isDark
        ? 'bg-linear-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/30'
        : 'bg-linear-to-br from-indigo-50 to-purple-50 border-indigo-200'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 backdrop-blur-sm rounded-xl flex items-center justify-center border transition-all duration-300 ${
            isDark ? 'bg-indigo-500/30 border-indigo-400/40' : 'bg-indigo-200 border-indigo-400'
          }`}>
            <Globe className={`w-5 h-5 ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`} />
          </div>
          <div>
            <p className={`font-semibold transition-colors duration-300 ${
              isDark ? 'text-indigo-300' : 'text-indigo-700'
            }`}>Multi-Destination Upload</p>
            <p className={`text-xs transition-colors duration-300 ${
              isDark ? 'text-indigo-400/70' : 'text-indigo-600'
            }`}>
              {enabledCount} destination{enabledCount !== 1 ? 's' : ''} enabled
            </p>
          </div>
        </div>

        {!isUploading && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
              showAddForm
                ? isDark
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'bg-red-100 text-red-700 border border-red-300'
                : isDark
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30'
                  : 'bg-indigo-100 text-indigo-700 border border-indigo-300 hover:bg-indigo-200'
            }`}
          >
            {showAddForm ? '✖️ Cancel' : <><Plus className="w-4 h-4" /> Add Destination</>}
          </button>
        )}
      </div>

      {/* Add Destination Form */}
      {showAddForm && (
        <div className={`p-4 rounded-xl border space-y-3 animate-in slide-in-from-top-2 duration-300 ${
          isDark
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white/80 border-gray-300'
        }`}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Destination Name
              </label>
              <input
                type="text"
                placeholder="My Backup Server"
                value={newDestination.name || ''}
                onChange={(e) => setNewDestination({ ...newDestination, name: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg text-sm border transition-all duration-300 ${
                  isDark
                    ? 'bg-slate-900/50 border-slate-600 text-white placeholder-gray-500 focus:border-indigo-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
                }`}
              />
            </div>

            <div>
              <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Provider Type
              </label>
              <select
                value={newDestination.type}
                onChange={(e) => setNewDestination({ ...newDestination, type: e.target.value as Destination['type'] })}
                className={`w-full px-3 py-2 rounded-lg text-sm border transition-all duration-300 ${
                  isDark
                    ? 'bg-slate-900/50 border-slate-600 text-white focus:border-indigo-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                }`}
              >
                <option value="custom">Custom Server</option>
                <option value="aws">AWS S3</option>
                <option value="azure">Azure Blob</option>
                <option value="gcp">Google Cloud</option>
              </select>
            </div>
          </div>

          <div>
            <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Endpoint URL
            </label>
            <input
              type="url"
              placeholder="https://api.example.com/upload"
              value={newDestination.endpoint || ''}
              onChange={(e) => setNewDestination({ ...newDestination, endpoint: e.target.value })}
              className={`w-full px-3 py-2 rounded-lg text-sm border transition-all duration-300 ${
                isDark
                  ? 'bg-slate-900/50 border-slate-600 text-white placeholder-gray-500 focus:border-indigo-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
              }`}
            />
          </div>

          <button
            onClick={addDestination}
            className={`w-full py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
              isDark
                ? 'bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
                : 'bg-linear-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white'
            }`}
          >
            <Check className="w-4 h-4 inline mr-2" />
            Add Destination
          </button>
        </div>
      )}

      {/* Destinations List */}
      {destinations.length === 0 ? (
        <div className={`p-6 rounded-xl border-2 border-dashed text-center ${
          isDark
            ? 'border-slate-700 text-gray-500'
            : 'border-gray-300 text-gray-500'
        }`}>
          <Globe className={`w-12 h-12 mx-auto mb-2 opacity-30`} />
          <p className="text-sm">No destinations added yet</p>
          <p className="text-xs mt-1">Click &quot;Add Destination&quot; to upload to multiple locations</p>
        </div>
      ) : (
        <div className="space-y-2">
          {destinations.map((dest) => {
            const colors = destinationColors[dest.type];
            return (
              <div
                key={dest.id}
                className={`p-4 rounded-xl border transition-all duration-300 ${
                  isDark
                    ? `bg-linear-to-r ${colors.bg} border-${colors.border}`
                    : 'bg-white/80 border-gray-300'
                } ${dest.enabled ? 'opacity-100' : 'opacity-50'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isDark ? `bg-${colors.text.replace('300', '500/30')}` : 'bg-gray-200'
                    }`}>
                      {destinationIcons[dest.type]}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium text-sm truncate ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {dest.name}
                        </p>
                        {dest.status && (
                          <span className={`text-xs ${getStatusColor(dest.status)}`}>
                            {getStatusIcon(dest.status)}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs truncate ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {dest.endpoint}
                      </p>
                      {dest.status === 'uploading' && dest.progress !== undefined && (
                        <div className="mt-2">
                          <div className={`w-full h-1.5 rounded-full overflow-hidden ${
                            isDark ? 'bg-slate-700' : 'bg-gray-200'
                          }`}>
                            <div
                              className="h-full bg-linear-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                              style={{ width: `${dest.progress}%` }}
                            />
                          </div>
                          <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {dest.progress}% uploaded
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {!isUploading && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleDestination(dest.id)}
                        className={`p-2 rounded-lg transition-all duration-300 ${
                          dest.enabled
                            ? isDark
                              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : isDark
                              ? 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                        title={dest.enabled ? 'Enabled' : 'Disabled'}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => removeDestination(dest.id)}
                        className={`p-2 rounded-lg transition-all duration-300 ${
                          isDark
                            ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                        title="Remove destination"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info */}
      {destinations.length > 0 && (
        <div className={`p-3 rounded-lg text-xs ${
          isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'
        }`}>
          <strong>ℹ️ Note:</strong> Files will be uploaded to all enabled destinations simultaneously. 
          Each destination tracks progress independently.
        </div>
      )}
    </div>
  );
}
