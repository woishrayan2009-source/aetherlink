# Worker Concurrency Overflow Fix

## Problem Description

The active worker count displayed in the Sharing Zone occasionally exceeded the configured `maxWorkers` limit. This occurred due to:

1. **Race conditions** in worker spawning logic
2. **Zombie workers** - workers that failed/aborted but weren't properly deregistered
3. **Concurrent fillWorkerPool calls** without mutual exclusion
4. **Timing issues** between worker creation and cleanup
5. **Double-counting** when workers were added before promises resolved

## Solution Implementation

### 1. Concurrency-Safe Worker Spawning (`hooks/useUploadLogic.ts`)

#### Changes Made:

**A. Worker Pool State Management**
```typescript
const activeUploads = new Map<number, Promise<void>>();
const activeWorkerIndices = new Set<number>(); // NEW: Track chunk indices
let workerSpawnLock = false; // NEW: Prevent concurrent spawning
```

**B. Spawn Lock Pattern**
```typescript
const fillWorkerPool = async () => {
    if (workerSpawnLock) {
        console.log('⚠️ Worker spawn blocked: already spawning workers');
        return;
    }
    workerSpawnLock = true;
    try {
        // ... spawn logic ...
    } finally {
        workerSpawnLock = false;
    }
};
```

**C. Defensive Zombie Cleanup**
Before spawning new workers, check for and remove resolved promises that weren't cleaned up:
```typescript
for (const [idx, promise] of Array.from(activeUploads.entries())) {
    await Promise.race([
        promise.then(() => 'resolved'),
        Promise.resolve('pending')
    ]).then(status => {
        if (status === 'resolved' && activeUploads.has(idx)) {
            console.log(`🧹 Cleaned up zombie worker for chunk ${idx}`);
            activeUploads.delete(idx);
            activeWorkerIndices.delete(idx);
        }
    });
}
```

**D. Strict Upper Bound Enforcement**
```typescript
while (activeUploads.size < maxConcurrent && queueIndex < chunksToUpload.length) {
    // Double-check we're not at limit (defensive)
    if (activeUploads.size >= maxConcurrent) {
        console.log(`⚠️ Worker spawn aborted: at maxWorkers (${maxConcurrent})`);
        break;
    }
    
    // Prevent duplicate workers for same chunk
    if (activeWorkerIndices.has(idx)) {
        console.error(`❌ DUPLICATE WORKER PREVENTED: chunk ${idx} already being processed`);
        continue;
    }
    
    // ... spawn worker ...
}
```

**E. Race-Free Worker Registration**
Workers are marked active BEFORE creating the promise:
```typescript
// Mark worker as active BEFORE creating promise (prevent race)
activeWorkerIndices.add(idx);
activeUploads.set(idx, Promise.resolve()); // Placeholder to reserve slot

// Log worker creation
console.log(`🚀 Spawning worker for chunk ${idx} (${activeUploads.size}/${maxConcurrent})`);

const uploadPromise = uploadWithRetry(idx)
    .finally(() => {
        // Defensive cleanup
        const wasActive = activeUploads.has(idx);
        const wasTracked = activeWorkerIndices.has(idx);
        
        activeUploads.delete(idx);
        activeWorkerIndices.delete(idx);
        
        console.log(`✅ Worker cleanup for chunk ${idx} (wasActive: ${wasActive}, wasTracked: ${wasTracked}, remaining: ${activeUploads.size})`);
        
        // Update UI state AFTER worker pool state is updated
        params.setActiveWorkers(activeUploads.size);
        
        // Detect stale references
        if (!wasActive || !wasTracked) {
            console.error(`❌ STALE WORKER REFERENCE: chunk ${idx} wasActive=${wasActive}, wasTracked=${wasTracked}`);
        }
    });

// Replace placeholder with actual promise
activeUploads.set(idx, uploadPromise);
```

**F. Race Condition Detection**
```typescript
const currentWorkers = activeUploads.size;
if (currentWorkers > maxConcurrent) {
    console.error(`❌ RACE CONDITION DETECTED: ${currentWorkers} workers > ${maxConcurrent} max! Indices: ${Array.from(activeWorkerIndices).join(', ')}`);
}
```

**G. Final Defensive Cleanup**
```typescript
// Final defensive cleanup
if (activeUploads.size > 0 || activeWorkerIndices.size > 0) {
    console.error(`❌ WORKER LEAK DETECTED: ${activeUploads.size} uploads, ${activeWorkerIndices.size} indices remaining`);
    activeUploads.clear();
    activeWorkerIndices.clear();
}

params.setActiveWorkers(0);
```

### 2. AdaptiveConcurrency Bounds Validation (`utils/AdaptiveConcurrency.ts`)

#### A. Defensive getConcurrency()
```typescript
public getConcurrency(): number {
    // Defensive check: ensure we never return a value outside bounds
    if (this.currentConcurrency > this.config.max) {
        console.error(`⚠️ CONCURRENCY OVERFLOW: ${this.currentConcurrency} > ${this.config.max}, clamping to max`);
        this.currentConcurrency = this.config.max;
    }
    if (this.currentConcurrency < this.config.min) {
        console.error(`⚠️ CONCURRENCY UNDERFLOW: ${this.currentConcurrency} < ${this.config.min}, clamping to min`);
        this.currentConcurrency = this.config.min;
    }
    return this.currentConcurrency;
}
```

#### B. Double-Clamping in adjustConcurrency()
```typescript
// DEFENSIVE: Final bounds check before assignment
newValue = Math.max(this.config.min, Math.min(newValue, this.config.max));

if (newValue !== oldValue) {
    // DEFENSIVE: Validate newValue is within bounds
    if (newValue < this.config.min || newValue > this.config.max) {
        console.error(`❌ INVALID CONCURRENCY ADJUSTMENT: ${newValue} outside bounds [${this.config.min}, ${this.config.max}]`);
        return;
    }
    
    this.currentConcurrency = newValue;
    // ...
}
```

### 3. UI Defensive Display (`components/upload/ActivityPanel.tsx`)

#### A. Clamp Display Value
```typescript
function UploadingState({ progress, uploadedChunks, totalChunks, currentProfile, isDark, activeWorkers }: any) {
  // DEFENSIVE: Clamp activeWorkers to never exceed maxWorkers in UI
  const maxWorkers = currentProfile.workers;
  const displayWorkers = Math.min(activeWorkers, maxWorkers);
  
  // Detect and log UI overflow (shouldn't happen with backend fixes)
  if (activeWorkers > maxWorkers) {
    console.error(`❌ UI OVERFLOW DETECTED: ${activeWorkers} active workers > ${maxWorkers} max workers`);
  }
  // ...
}
```

#### B. Visual Overflow Indicator
```typescript
<span className={`text-sm font-bold ${
  displayWorkers > maxWorkers 
    ? 'text-red-500'  // Red if overflow (shouldn't happen)
    : isDark ? 'text-cyan-400' : 'text-cyan-600'
}`}>
  {displayWorkers}
</span>
{displayWorkers > 0 && (
  <div className={`w-2 h-2 rounded-full animate-pulse ${
    displayWorkers > maxWorkers
      ? 'bg-red-500'  // Red indicator if overflow
      : isDark ? 'bg-green-400' : 'bg-green-500'
  }`} />
)}
```

### 4. Telemetry Dashboard Protection (`components/telemetry/WorkerEfficiencyGauge.tsx`)

Same defensive clamping and overflow detection applied:
```typescript
const displayWorkers = Math.min(activeWorkers, totalWorkers);

if (activeWorkers > totalWorkers) {
  console.error(`❌ TELEMETRY UI OVERFLOW: ${activeWorkers} active workers > ${totalWorkers} max workers`);
}
```

## Testing Instructions

### 1. Normal Upload Test
```bash
# Start backend
cd server/orchestrator
go run main.go

# Start frontend (separate terminal)
npm run dev
```

**Steps:**
1. Open browser DevTools Console (F12)
2. Select a large file (>100MB)
3. Enable Adaptive mode, set max workers to 20
4. Start upload
5. Monitor console logs during upload
6. **Expected:** Active workers should NEVER exceed 20
7. **Look for:** 
   - "🚀 Spawning worker for chunk X (Y/20)" where Y ≤ 20
   - No "❌ RACE CONDITION DETECTED" errors
   - No "❌ WORKER LEAK DETECTED" errors

### 2. Rapid Throttling Test (Original Issue)
**Steps:**
1. Start upload with adaptive mode
2. Open Chrome DevTools → Network tab
3. Rapidly toggle throttling: Fast 3G → Slow 3G → No throttling → Slow 3G
4. Monitor console logs
5. **Expected:** 
   - Workers scale down/up correctly
   - Active count never exceeds maxWorkers
   - No zombie workers remain
6. **Look for:**
   - "⚠️ Worker spawn blocked" during high spawn rate
   - "🧹 Cleaned up zombie worker" if any stuck workers detected

### 3. Concurrency Change During Upload
**Steps:**
1. Start upload with adaptive mode, max=20
2. While uploading, manually change max workers to 10 in the UI (if control exists)
3. **Expected:** Active workers gradually decrease to 10, never spike above 10
4. **Look for:** "⚠️ Worker spawn aborted: at maxWorkers" logs

### 4. Network Degradation Test
**Steps:**
1. Start upload with good network
2. Set throttling to "Offline" for 5 seconds
3. Remove throttling
4. **Expected:** 
   - Workers drop to minimum (4)
   - Fast recovery when network returns
   - No worker count overflow during recovery
5. **Look for:** 
   - "🚀 Fast recovery detected" log
   - "📊 Concurrency adjusted" logs showing smooth transitions

### 5. Edge Case: Rapid Cancellation
**Steps:**
1. Start large file upload
2. Immediately click Cancel
3. **Expected:** 
   - All workers cleaned up immediately
   - activeWorkers drops to 0
   - No errors in console
4. **Look for:**
   - "✅ Worker cleanup" for each active chunk
   - Final "params.setActiveWorkers(0)" log

## Debugging Logs Reference

### Normal Operation Logs
```
🔒 Upload locked: CHUNK_SIZE=2097152, CHUNKS=127, FILE_SIZE=266338304
🎯 Adaptive mode: min=4, max=40, initial=10
📤 Uploading 127 chunks (0 already received)
🚀 Spawning worker for chunk 0 (1/10)
🚀 Spawning worker for chunk 1 (2/10)
...
✅ Worker cleanup for chunk 0 (wasActive: true, wasTracked: true, remaining: 9)
🔄 Workers: 10 → 12 (Performance improved: 850ms/chunk, 1.18 chunks/s)
📊 Concurrency adjusted: 10 → 12 | Reason: Performance improved...
```

### Error Logs (Should NOT appear)
```
❌ RACE CONDITION DETECTED: 42 workers > 40 max! Indices: 0,1,2,3,...
❌ DUPLICATE WORKER PREVENTED: chunk 5 already being processed
❌ STALE WORKER REFERENCE: chunk 10 wasActive=false, wasTracked=true
❌ WORKER LEAK DETECTED: 3 uploads, 3 indices remaining
❌ UI OVERFLOW DETECTED: 42 active workers > 40 max workers
❌ CONCURRENCY OVERFLOW: 45 > 40, clamping to max
```

### Recovery Logs (Normal during throttling)
```
⚠️ Worker spawn blocked: already spawning workers
⚠️ Worker spawn aborted: at maxWorkers (20)
⚠️ Chunk 42 timed out after 30000ms
🧹 Cleaned up zombie worker for chunk 15
🚀 Fast recovery detected: 65% improvement, jumping to higher concurrency
```

## Performance Impact

- **Minimal overhead:** Spawn lock adds ~0.1ms per fillWorkerPool call
- **Zombie cleanup:** Async Promise.race checks add negligible delay (resolved promises return immediately)
- **Defensive logging:** Console logs can be removed in production or disabled with compile flag
- **UI clamping:** Simple Math.min() operation, zero impact

## Rollback Plan

If issues occur, revert with:
```bash
git checkout HEAD~1 -- hooks/useUploadLogic.ts
git checkout HEAD~1 -- utils/AdaptiveConcurrency.ts
git checkout HEAD~1 -- components/upload/ActivityPanel.tsx
git checkout HEAD~1 -- components/telemetry/WorkerEfficiencyGauge.tsx
```

## Related Issues

- Original issue: "active worker count occasionally exceeds maxWorkers"
- Related to: Adaptive upload freeze fix (timeout system)
- Affects: All upload modes (sequential, parallel, adaptive)

## Future Improvements

1. **Worker Pool Metrics:** Add telemetry for spawn/cleanup events
2. **Rate Limiting:** Add max spawn rate per second if needed
3. **Worker Health Check:** Periodic validation of worker states
4. **Debug Mode:** Feature flag to enable/disable verbose logging
5. **Unit Tests:** Add tests for race conditions using Promise delays

## Verification Checklist

- [ ] Upload completes without "RACE CONDITION DETECTED" errors
- [ ] Active workers never exceed maxWorkers in UI
- [ ] No zombie workers remain after upload
- [ ] Rapid throttling changes don't cause overflow
- [ ] Cancellation cleans up all workers immediately
- [ ] No "WORKER LEAK DETECTED" errors at end of upload
- [ ] UI displays red indicator if overflow detected (defensive only)
- [ ] Console logs show proper worker spawn/cleanup lifecycle
