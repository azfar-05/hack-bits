/**
 * Offline queue for SOS actions
 * Stores actions in localStorage and syncs when network returns
 */

export type QueuedAction = {
  id: string;
  type: 'RESCUE_CREATE' | 'RESCUE_CANCEL';
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
};

const QUEUE_KEY = 'sos_offline_queue';
const MAX_RETRIES = 3;

/**
 * Add action to offline queue
 */
export function queueAction(type: QueuedAction['type'], data: Record<string, unknown>): string {
  const action: QueuedAction = {
    id: crypto.randomUUID(),
    type,
    data,
    timestamp: Date.now(),
    retries: 0,
  };

  const queue = getQueue();
  queue.push(action);
  saveQueue(queue);
  
  console.log(`[OFFLINE QUEUE] Queued ${type}:`, action);
  return action.id;
}

/**
 * Get all queued actions
 */
export function getQueue(): QueuedAction[] {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) as QueuedAction[] : [];
  } catch {
    return [];
  }
}

/**
 * Save queue to localStorage
 */
function saveQueue(queue: QueuedAction[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[OFFLINE QUEUE] Failed to save queue:', error);
  }
}

/**
 * Remove action from queue
 */
export function removeFromQueue(actionId: string): void {
  const queue = getQueue().filter(action => action.id !== actionId);
  saveQueue(queue);
}

/**
 * Clear entire queue
 */
export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

/**
 * Check if there are pending actions
 */
export function hasPendingActions(): boolean {
  return getQueue().length > 0;
}

/**
 * Process queued actions when network returns
 */
export async function processQueue(
  rescueCreateMutation: { mutateAsync: (data: Record<string, unknown>) => Promise<unknown> },
  rescueCancelMutation: { mutateAsync: (data: Record<string, unknown>) => Promise<unknown> }
): Promise<{ processed: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  console.log(`[OFFLINE QUEUE] Processing ${queue.length} queued actions`);
  
  let processed = 0;
  let failed = 0;
  const remainingQueue: QueuedAction[] = [];

  for (const action of queue) {
    try {
      if (action.type === 'RESCUE_CREATE') {
        await rescueCreateMutation.mutateAsync(action.data);
        console.log(`[OFFLINE QUEUE] Successfully processed RESCUE_CREATE:`, action.id);
        processed++;
      } else if (action.type === 'RESCUE_CANCEL') {
        await rescueCancelMutation.mutateAsync(action.data);
        console.log(`[OFFLINE QUEUE] Successfully processed RESCUE_CANCEL:`, action.id);
        processed++;
      }
    } catch (error) {
      console.error(`[OFFLINE QUEUE] Failed to process ${action.type}:`, error);
      
      // Increment retry count
      action.retries++;
      
      // Keep in queue if under retry limit
      if (action.retries < MAX_RETRIES) {
        remainingQueue.push(action);
      } else {
        console.error(`[OFFLINE QUEUE] Max retries exceeded for action:`, action.id);
        failed++;
      }
    }
  }

  // Save remaining queue
  saveQueue(remainingQueue);
  
  return { processed, failed };
}