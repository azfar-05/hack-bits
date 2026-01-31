"use client";

import { useState, useEffect } from "react";
import { 
  scanSocialMediaForEmergencies, 
  getEmergencyStats,
  type EmergencyPost, 
  type ScanResult 
} from "~/lib/social-media-scanner";

interface SocialMediaDashboardProps {
  onEmergencyDetected?: (post: EmergencyPost) => void;
}

export function SocialMediaDashboard({ onEmergencyDetected }: SocialMediaDashboardProps) {
  const [posts, setPosts] = useState<EmergencyPost[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'VERIFIED'>('ALL');

  // Auto-scan every 30 seconds
  useEffect(() => {
    if (autoScan) {
      const interval = setInterval(() => {
        handleScan();
      }, 30000);
      
      // Initial scan
      handleScan();
      
      return () => clearInterval(interval);
    }
  }, [autoScan]);

  // Update stats when posts change
  useEffect(() => {
    if (posts.length > 0) {
      setStats(getEmergencyStats(posts));
    }
  }, [posts]);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const result = await scanSocialMediaForEmergencies();
      
      // Check for new critical emergencies
      const newCritical = result.posts.filter(post => 
        post.severity === 'CRITICAL' && 
        !posts.some(existing => existing.id === post.id)
      );
      
      // Notify about new critical emergencies
      newCritical.forEach(post => {
        onEmergencyDetected?.(post);
      });
      
      setPosts(result.posts);
      setScanResult(result.scanResult);
      
      if (newCritical.length > 0) {
        // Show browser notification for critical emergencies
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`🚨 ${newCritical.length} Critical Emergency Alert(s)`, {
            body: newCritical[0]?.content || 'Emergency detected',
            icon: '/favicon.ico'
          });
        }
      }
      
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setIsScanning(false);
    }
  };

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const getFilteredPosts = () => {
    switch (selectedFilter) {
      case 'CRITICAL':
        return posts.filter(p => p.severity === 'CRITICAL');
      case 'HIGH':
        return posts.filter(p => p.severity === 'CRITICAL' || p.severity === 'HIGH');
      case 'VERIFIED':
        return posts.filter(p => p.verified);
      default:
        return posts;
    }
  };

  const getPlatformIcon = (platform: EmergencyPost['platform']) => {
    switch (platform) {
      case 'TWITTER': return '🐦';
      case 'REDDIT': return '🤖';
      case 'NEWS': return '📰';
      case 'RSS': return '📡';
      default: return '📱';
    }
  };

  const getEmergencyIcon = (type: EmergencyPost['emergencyType']) => {
    switch (type) {
      case 'FIRE': return '🔥';
      case 'FLOOD': return '🌊';
      case 'EARTHQUAKE': return '🏗️';
      case 'ACCIDENT': return '🚗';
      case 'MEDICAL': return '🏥';
      case 'WEATHER': return '⛈️';
      default: return '🚨';
    }
  };

  const getSeverityColor = (severity: EmergencyPost['severity']) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'LOW': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const filteredPosts = getFilteredPosts();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-xl">
            <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v1a1 1 0 01-1 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 01-1-1V5a1 1 0 011-1h4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">🔍 AI Social Media Scanner</h2>
            <p className="text-gray-600">Real-time emergency detection from social platforms</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto-scan"
              checked={autoScan}
              onChange={(e) => setAutoScan(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="auto-scan" className="text-sm text-gray-700">Auto-scan</label>
          </div>
          
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors font-medium flex items-center gap-2"
          >
            {isScanning ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Scanning...
              </>
            ) : (
              <>
                🔍 Scan Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scan Statistics */}
      {scanResult && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Scanned</p>
                <p className="text-2xl font-bold text-gray-900">{scanResult.totalScanned}</p>
              </div>
              <div className="text-2xl">📊</div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Emergencies</p>
                <p className="text-2xl font-bold text-red-600">{scanResult.emergenciesDetected}</p>
              </div>
              <div className="text-2xl">🚨</div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">High Priority</p>
                <p className="text-2xl font-bold text-orange-600">{scanResult.highPriorityAlerts}</p>
              </div>
              <div className="text-2xl">⚠️</div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Last Scan</p>
                <p className="text-sm font-bold text-green-600">
                  {formatTimeAgo(scanResult.lastScanTime)}
                </p>
              </div>
              <div className="text-2xl">⏰</div>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Statistics */}
      {stats && (
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Emergency Analytics</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.total}</div>
              <div className="text-sm text-gray-500">Total Detected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.lastHour}</div>
              <div className="text-sm text-gray-500">Last Hour</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.lastDay}</div>
              <div className="text-sm text-gray-500">Last 24h</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.bySeverity.CRITICAL}</div>
              <div className="text-sm text-gray-500">Critical</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Type */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">By Emergency Type</h4>
              <div className="space-y-2">
                {Object.entries(stats.byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      {getEmergencyIcon(type as EmergencyPost['emergencyType'])}
                      {type}
                    </span>
                    <span className="text-sm font-medium">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* By Location */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">By Location</h4>
              <div className="space-y-2">
                {Object.entries(stats.byLocation).slice(0, 5).map(([location, count]) => (
                  <div key={location} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      📍 {location}
                    </span>
                    <span className="text-sm font-medium">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Filter:</span>
        {['ALL', 'CRITICAL', 'HIGH', 'VERIFIED'].map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter as any)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedFilter === filter
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {filter}
          </button>
        ))}
        <span className="text-sm text-gray-500 ml-2">
          ({filteredPosts.length} posts)
        </span>
      </div>

      {/* Emergency Posts */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">🚨 Live Emergency Feed</h3>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {filteredPosts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-2">🔍</div>
              <p className="text-sm">No emergencies detected</p>
              <p className="text-xs text-gray-400">
                {isScanning ? 'Scanning social media...' : 'Click "Scan Now" to check for emergencies'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredPosts.map((post) => (
                <div key={post.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="text-2xl">{getEmergencyIcon(post.emergencyType)}</div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(post.severity)}`}>
                          {post.severity}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          {getPlatformIcon(post.platform)}
                          {post.platform}
                        </span>
                        {post.verified && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            ✓ Verified
                          </span>
                        )}
                        <span className="text-xs text-gray-500">{formatTimeAgo(post.timestamp)}</span>
                      </div>
                      
                      <p className="text-sm text-gray-900 mb-2 line-clamp-2">{post.content}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>@{post.author}</span>
                          {post.location && (
                            <span className="flex items-center gap-1">
                              📍 {post.location.name}
                            </span>
                          )}
                          <span>Confidence: {Math.round(post.confidence * 100)}%</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {post.engagement.likes && (
                            <span className="text-xs text-gray-500">❤️ {post.engagement.likes}</span>
                          )}
                          {post.engagement.shares && (
                            <span className="text-xs text-gray-500">🔄 {post.engagement.shares}</span>
                          )}
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                          >
                            View →
                          </a>
                        </div>
                      </div>
                      
                      {post.keywords.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {post.keywords.slice(0, 3).map((keyword) => (
                            <span key={keyword} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}