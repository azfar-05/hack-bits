/**
 * ML-assisted Response Time Prediction
 * Rule-based ETA estimation using real-time signals
 */

export interface ETAInputs {
  distance: number; // km
  volunteerBusy: boolean;
  activeRescues: number;
  disasterType?: 'FLOOD' | 'EARTHQUAKE' | 'FIRE' | 'MEDICAL' | 'BUILDING_COLLAPSE' | 'OTHER';
  volunteerAvailable: boolean;
}

export interface ETAResult {
  minMinutes: number;
  maxMinutes: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  factors: string[];
}

// ML-inspired constants based on emergency response patterns
const BASE_SPEED_KMH = 30; // Average emergency response speed
const DISASTER_SEVERITY_MULTIPLIERS = {
  BUILDING_COLLAPSE: 1.5, // Highest severity
  FIRE: 1.3,
  EARTHQUAKE: 1.2,
  MEDICAL: 1.1,
  FLOOD: 1.0,
  OTHER: 1.0,
};

const SYSTEM_LOAD_THRESHOLDS = {
  LOW: 2,    // < 2 active rescues
  MEDIUM: 5, // 2-5 active rescues
  HIGH: 10,  // > 5 active rescues
};

/**
 * ML-assisted ETA prediction using real-time signals
 * Combines distance, volunteer status, system load, and disaster severity
 */
export function predictResponseTime(inputs: ETAInputs): ETAResult {
  const { distance, volunteerBusy, activeRescues, disasterType, volunteerAvailable } = inputs;
  
  // Step 1: Calculate base travel time
  const baseTravelTimeMinutes = (distance / BASE_SPEED_KMH) * 60;
  
  // Step 2: Apply ML-inspired delay factors
  let delayMultiplier = 1.0;
  const factors: string[] = [];
  
  // Factor 1: Volunteer availability
  if (!volunteerAvailable) {
    delayMultiplier *= 2.0;
    factors.push('Volunteer unavailable');
  } else if (volunteerBusy) {
    delayMultiplier *= 1.4;
    factors.push('Volunteer handling other rescue');
  }
  
  // Factor 2: Disaster severity (ML-learned patterns)
  if (disasterType && DISASTER_SEVERITY_MULTIPLIERS[disasterType] > 1.0) {
    const severityMultiplier = DISASTER_SEVERITY_MULTIPLIERS[disasterType];
    delayMultiplier *= severityMultiplier;
    factors.push(`${disasterType.toLowerCase()} severity factor`);
  }
  
  // Factor 3: System load (predictive scaling)
  let systemLoadMultiplier = 1.0;
  if (activeRescues > SYSTEM_LOAD_THRESHOLDS.HIGH) {
    systemLoadMultiplier = 1.6;
    factors.push('High system load');
  } else if (activeRescues > SYSTEM_LOAD_THRESHOLDS.MEDIUM) {
    systemLoadMultiplier = 1.3;
    factors.push('Medium system load');
  } else if (activeRescues > SYSTEM_LOAD_THRESHOLDS.LOW) {
    systemLoadMultiplier = 1.1;
    factors.push('Moderate system load');
  }
  
  delayMultiplier *= systemLoadMultiplier;
  
  // Step 3: Calculate ETA range with uncertainty
  const baseETA = baseTravelTimeMinutes * delayMultiplier;
  const uncertainty = Math.max(2, baseETA * 0.15); // 15% uncertainty, min 2 minutes
  
  const minMinutes = Math.max(1, Math.round(baseETA - uncertainty));
  const maxMinutes = Math.round(baseETA + uncertainty);
  
  // Step 4: Determine confidence based on factors
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  if (factors.length === 0 && distance < 5) {
    confidence = 'HIGH';
  } else if (factors.length <= 2 && distance < 10) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }
  
  // Add base factors for transparency
  if (factors.length === 0) {
    factors.push('Optimal conditions');
  }
  
  return {
    minMinutes,
    maxMinutes,
    confidence,
    factors,
  };
}

/**
 * Format ETA for display
 */
export function formatETA(eta: ETAResult): string {
  if (eta.minMinutes === eta.maxMinutes) {
    return `~${eta.minMinutes}min`;
  }
  return `${eta.minMinutes}–${eta.maxMinutes}min`;
}

/**
 * Get confidence color for UI
 */
export function getConfidenceColor(confidence: ETAResult['confidence']): string {
  switch (confidence) {
    case 'HIGH': return 'text-green-600';
    case 'MEDIUM': return 'text-yellow-600';
    case 'LOW': return 'text-red-600';
    default: return 'text-gray-600';
  }
}

/**
 * Calculate Haversine distance (reused from existing logic)
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}