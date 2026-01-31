"use client";

import { useState, useEffect } from "react";
import { 
  getAllDrones, 
  getAvailableDrones, 
  deploySwarmMission, 
  getFleetStatistics,
  recallAllDrones,
  type Drone, 
  type SwarmMission,
  type SwarmFinding 
} from "~/lib/drone-swarm";

interface DroneSwarmDashboardProps {
  emergencyLocation?: { latitude: number; longitude: number };
  onMissionDeployed?: (mission: SwarmMission) => void;
}

export function DroneSwarmDashboard({ emergencyLocation, onMissionDeployed }: DroneSwarmDashboardProps) {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [activeMissions, setActiveMissions] = useState<SwarmMission[]>([]);
  const [fleetStats, setFleetStats] = useState(getFleetStatistics());
  const [selectedMissionType, setSelectedMissionType] = useState<SwarmMission['type']>('SEARCH_AND_RESCUE');
  const [isDeploying, setIsDeploying] = useState(false);
  const [findings, setFindings] = useState<SwarmFinding[]>([]);

  // Update drone data every 2 seconds
  useEffect(() => {
    const updateData = () => {
      setDrones(getAllDrones());
      setFleetStats(getFleetStatistics());
    };

    updateData();
    const interval = setInterval(updateData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleDeployMission = async () => {
    if (!emergencyLocation) {
      alert('No emergency location provided');
      return;
    }

    setIsDeploying(true);
    try {
      const mission = await deploySwarmMission(
        emergencyLocation,
        selectedMissionType,
        'CRITICAL',
        500 // 500m search radius
      );
      
      setActiveMissions(prev => [...prev, mission]);
      onMissionDeployed?.(mission);
      
      // Simulate mission findings
      setTimeout(() => {
        const mockFindings: SwarmFinding[] = [
          {
            id: 'finding-1',
            droneId: 'drone-001',
            type: 'PERSON_DETECTED',
            position: { latitude: emergencyLocation.latitude + 0.001, longitude: emergencyLocation.longitude + 0.001 },
            confidence: 0.89,
            description: 'Thermal signature detected - person trapped in debris',
            timestamp: Date.now()
          },
          {
            id: 'finding-2',
            droneId: 'drone-003',
            type: 'SAFE_ZONE',
            position: { latitude: emergencyLocation.latitude - 0.002, longitude: emergencyLocation.longitude + 0.002 },
            confidence: 0.95,
            description: 'Safe landing zone identified for medical evacuation',
            timestamp: Date.now() + 30000
          }
        ];
        setFindings(prev => [...prev, ...mockFindings]);
      }, 5000);
      
    } catch (error) {
      alert(`Failed to deploy mission: ${(error as Error).message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const getDroneStatusColor = (status: Drone['status']) => {
    switch (status) {
      case 'IDLE': return 'bg-green-100 text-green-800';
      case 'DEPLOYED': return 'bg-blue-100 text-blue-800';
      case 'SEARCHING': return 'bg-yellow-100 text-yellow-800';
      case 'RESCUING': return 'bg-red-100 text-red-800';
      case 'RETURNING': return 'bg-purple-100 text-purple-800';
      case 'MAINTENANCE': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDroneTypeIcon = (type: Drone['type']) => {
    switch (type) {
      case 'SEARCH': return '🔍';
      case 'RESCUE': return '🚁';
      case 'MEDICAL': return '🏥';
      case 'SUPPLY': return '📦';
      case 'SURVEILLANCE': return '👁️';
      default: return '🚁';
    }
  };

  const getFindingIcon = (type: SwarmFinding['type']) => {
    switch (type) {
      case 'PERSON_DETECTED': return '👤';
      case 'HAZARD_IDENTIFIED': return '⚠️';
      case 'RESOURCE_FOUND': return '📦';
      case 'SAFE_ZONE': return '✅';
      default: return '📍';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-xl">
            <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v1a1 1 0 01-1 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 01-1-1V5a1 1 0 011-1h4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">🚁 AI Drone Swarm Command</h2>
            <p className="text-gray-600">Autonomous search & rescue coordination</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm text-gray-500">Fleet Status</div>
            <div className="text-lg font-bold text-green-600">
              {fleetStats.available}/{fleetStats.total} Ready
            </div>
          </div>
          <button
            onClick={() => recallAllDrones()}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
          >
            🚨 Recall All
          </button>
        </div>
      </div>

      {/* Fleet Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Fleet</p>
              <p className="text-2xl font-bold text-gray-900">{fleetStats.total}</p>
            </div>
            <div className="text-2xl">🚁</div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Available</p>
              <p className="text-2xl font-bold text-green-600">{fleetStats.available}</p>
            </div>
            <div className="text-2xl">✅</div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Deployed</p>
              <p className="text-2xl font-bold text-blue-600">{fleetStats.deployed}</p>
            </div>
            <div className="text-2xl">🚀</div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Battery</p>
              <p className="text-2xl font-bold text-yellow-600">{fleetStats.averageBattery}%</p>
            </div>
            <div className="text-2xl">🔋</div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Payload</p>
              <p className="text-2xl font-bold text-purple-600">{fleetStats.totalPayloadCapacity}kg</p>
            </div>
            <div className="text-2xl">📦</div>
          </div>
        </div>
      </div>

      {/* Mission Deployment */}
      {emergencyLocation && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-6 border-2 border-red-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-red-900">🚨 Emergency Mission Deployment</h3>
              <p className="text-sm text-red-700">
                Location: {emergencyLocation.latitude.toFixed(4)}, {emergencyLocation.longitude.toFixed(4)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedMissionType}
                onChange={(e) => setSelectedMissionType(e.target.value as SwarmMission['type'])}
                className="px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="SEARCH_AND_RESCUE">🔍 Search & Rescue</option>
                <option value="AREA_SURVEY">📊 Area Survey</option>
                <option value="SUPPLY_DROP">📦 Supply Drop</option>
                <option value="EVACUATION_SUPPORT">🚑 Evacuation Support</option>
              </select>
              <button
                onClick={handleDeployMission}
                disabled={isDeploying || fleetStats.available === 0}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
              >
                {isDeploying ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deploying...
                  </>
                ) : (
                  <>
                    🚀 Deploy Swarm
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Drone Fleet Status */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>🚁</span> Drone Fleet Status
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {drones.map((drone) => (
              <div key={drone.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{getDroneTypeIcon(drone.type)}</div>
                  <div>
                    <p className="font-medium text-gray-900">{drone.name}</p>
                    <p className="text-sm text-gray-500">{drone.type}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">🔋 {drone.battery}%</div>
                      <div className={`w-16 h-2 rounded-full ${
                        drone.battery > 60 ? 'bg-green-200' : 
                        drone.battery > 30 ? 'bg-yellow-200' : 'bg-red-200'
                      }`}>
                        <div 
                          className={`h-full rounded-full ${
                            drone.battery > 60 ? 'bg-green-500' : 
                            drone.battery > 30 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${drone.battery}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">Alt: {drone.position.altitude}m</div>
                  </div>
                  
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDroneStatusColor(drone.status)}`}>
                    {drone.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mission Findings */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>🔍</span> Live Findings
          </h3>
          
          {findings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🔍</div>
              <p className="text-sm">No findings yet</p>
              <p className="text-xs text-gray-400">Deploy a mission to start scanning</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {findings.map((finding) => (
                <div key={finding.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getFindingIcon(finding.type)}</span>
                      <span className="font-medium text-blue-900">{finding.type.replace('_', ' ')}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-blue-600">
                        Confidence: {Math.round(finding.confidence * 100)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(finding.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-blue-800 mb-2">{finding.description}</p>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-600">
                      📍 {finding.position.latitude.toFixed(4)}, {finding.position.longitude.toFixed(4)}
                    </span>
                    <span className="text-gray-500">
                      Drone: {drones.find(d => d.id === finding.droneId)?.name || finding.droneId}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Real-time Mission Status */}
      {activeMissions.length > 0 && (
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>📊</span> Active Missions
          </h3>
          <div className="space-y-4">
            {activeMissions.map((mission) => (
              <div key={mission.id} className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">{mission.type.replace('_', ' ')}</h4>
                    <p className="text-sm text-gray-600">
                      {mission.assignedDrones.length} drones • {mission.estimatedDuration} min estimated
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600">{mission.progress}%</div>
                    <div className="text-xs text-gray-500">{mission.status}</div>
                  </div>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${mission.progress}%` }}
                  ></div>
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Target: {mission.target.latitude.toFixed(4)}, {mission.target.longitude.toFixed(4)}</span>
                  <span>{mission.findings.length} findings</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}