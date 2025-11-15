# Adaptive Concurrency Integration Guide

## Overview
This guide shows how to integrate `AdaptiveConcurrency` into your existing upload pipeline without breaking any current functionality.

## Step 1: Import the Manager

```typescript
import { AdaptiveConcurrency } from '@/utils/AdaptiveConcurrency';
```

## Step 2: Initialize in Your Upload Hook

Add to your `useUploadLogic.ts` or wherever you manage the upload state:

```typescript
// Add to your hook's state
const [adaptiveManager] = useState(() => 
  new AdaptiveConcurrency({
    min: 4,                    // Minimum workers (for poor connections)
    max: 40,                   // Maximum workers (your current limit)
    initial: 10,               // Start conservatively
    increaseStep: 2,           // Add 2 workers when improving
    decreaseStep: 4,           // Remove 4 when degrading (faster reaction)
    evaluationInterval: 1500,  // Evaluate every 1.5 seconds
    performanceThreshold: 15,  // Need 15% improvement to increase
    degradationThreshold: 20,  // 20% worse triggers decrease
    errorRateThreshold: 10,    // 10% errors triggers decrease
    stabilityWindow: 3,        // Need 3 consecutive good samples
  })
);
```

## Step 3: Start/Stop the Manager

```typescript
// In your upload start logic
useEffect(() => {
  if (isUploading) {
    adaptiveManager.start();
    
    // Listen to events
    const unsubscribe = adaptiveManager.on((event) => {
      if (event.type === 'concurrencyChanged') {
        console.log(`🔄 Concurrency: ${event.oldValue} → ${event.newValue}`);
        console.log(`   Reason: ${event.reason}`);
      } else if (event.type === 'networkDegraded') {
        console.log('⚠️ Network degraded, reducing workers');
      } else if (event.type === 'networkRecovered') {
        console.log('✅ Network recovered, optimizing workers');
      }
    });
    
    return () => {
      adaptiveManager.stop();
      unsubscribe();
    };
  }
}, [isUploading]);
```

## Step 4: Integrate with Worker Pool

### Option A: Modify Your Existing Worker Pool

Find where you create/manage your worker pool. Instead of a fixed count, use:

```typescript
// BEFORE:
const MAX_CONCURRENT = 40;

// AFTER:
const getMaxConcurrent = () => adaptiveManager.getConcurrency();

// In your upload loop:
while (uploadQueue.length > 0) {
  const maxConcurrent = getMaxConcurrent(); // Dynamic!
  
  // Launch workers up to current concurrency
  while (activeWorkers < maxConcurrent && uploadQueue.length > 0) {
    const chunk = uploadQueue.shift();
    launchWorker(chunk);
  }
  
  await Promise.race(activeWorkerPromises);
}
```

### Option B: Reactive Worker Pool

```typescript
// Listen to concurrency changes and adjust workers dynamically
adaptiveManager.on((event) => {
  if (event.type === 'concurrencyChanged') {
    if (event.newValue > event.oldValue) {
      // Spawn more workers
      const toAdd = event.newValue - event.oldValue;
      for (let i = 0; i < toAdd && uploadQueue.length > 0; i++) {
        const chunk = uploadQueue.shift();
        launchWorker(chunk);
      }
    }
    // If decreased, workers will naturally finish and not be replaced
  }
});
```

## Step 5: Record Metrics in Your Upload Function

Modify your chunk upload function to record metrics:

```typescript
async function uploadChunk(chunk: ChunkData, retryCount = 0): Promise<void> {
  const chunkId = `${chunk.uploadId}-${chunk.index}`;
  
  // 1. Record start
  adaptiveManager.recordChunkStart(chunkId);
  
  const startTime = Date.now();
  
  try {
    // Your existing upload logic
    await fetch(`/api/upload/${chunk.uploadId}/${chunk.index}`, {
      method: 'PUT',
      body: chunk.data,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    
    const duration = Date.now() - startTime;
    
    // 2. Record success
    adaptiveManager.recordChunkSuccess(chunkId, duration, retryCount);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // 3. Record error
    adaptiveManager.recordChunkError(chunkId, error.message, retryCount);
    
    // Your existing retry logic
    if (retryCount < MAX_RETRIES) {
      await delay(Math.pow(2, retryCount) * 1000);
      return uploadChunk(chunk, retryCount + 1);
    }
    
    throw error;
  }
}
```

## Step 6: Integration Example (Full Pattern)

Here's a complete integration example:

```typescript
export function useUploadLogic() {
  // ... your existing state ...
  const [adaptiveManager] = useState(() => 
    new AdaptiveConcurrency({
      min: 4,
      max: 40,
      initial: 10,
      increaseStep: 2,
      decreaseStep: 4,
      evaluationInterval: 1500,
    })
  );
  
  // Start manager when upload begins
  useEffect(() => {
    if (isUploading) {
      adaptiveManager.start();
      
      const unsubscribe = adaptiveManager.on((event) => {
        if (event.type === 'concurrencyChanged') {
          // Optional: Update UI or metrics
          setCurrentConcurrency(event.newValue);
        }
      });
      
      return () => {
        adaptiveManager.stop();
        unsubscribe();
      };
    }
  }, [isUploading]);
  
  const uploadFile = async (file: File) => {
    // ... your existing chunk preparation ...
    
    const chunks = /* your chunk creation logic */;
    const queue = [...chunks];
    const activeUploads: Promise<void>[] = [];
    
    // Main upload loop with adaptive concurrency
    while (queue.length > 0 || activeUploads.length > 0) {
      const maxConcurrent = adaptiveManager.getConcurrency();
      
      // Fill up to current concurrency limit
      while (activeUploads.length < maxConcurrent && queue.length > 0) {
        const chunk = queue.shift()!;
        
        const uploadPromise = uploadChunkWithMetrics(chunk, adaptiveManager)
          .finally(() => {
            // Remove from active list when done
            const index = activeUploads.indexOf(uploadPromise);
            if (index > -1) activeUploads.splice(index, 1);
          });
        
        activeUploads.push(uploadPromise);
      }
      
      // Wait for at least one to complete
      if (activeUploads.length > 0) {
        await Promise.race(activeUploads);
      }
    }
    
    adaptiveManager.stop();
  };
  
  return { uploadFile, /* ... */ };
}

// Helper function that wraps your existing upload logic
async function uploadChunkWithMetrics(
  chunk: ChunkData,
  manager: AdaptiveConcurrency,
  retryCount = 0
): Promise<void> {
  const chunkId = `${chunk.uploadId}-${chunk.index}`;
  manager.recordChunkStart(chunkId);
  
  const startTime = Date.now();
  
  try {
    // YOUR EXISTING UPLOAD LOGIC HERE
    await yourExistingUploadFunction(chunk);
    
    const duration = Date.now() - startTime;
    manager.recordChunkSuccess(chunkId, duration, retryCount);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    manager.recordChunkError(chunkId, error.message, retryCount);
    
    // YOUR EXISTING RETRY LOGIC
    if (retryCount < MAX_RETRIES) {
      await exponentialBackoff(retryCount);
      return uploadChunkWithMetrics(chunk, manager, retryCount + 1);
    }
    
    throw error;
  }
}
```

## Monitoring & Debugging

### Get Current State
```typescript
const concurrency = adaptiveManager.getConcurrency();
const metrics = adaptiveManager.getMetrics();
const diagnostics = adaptiveManager.getDiagnostics();

console.log(`Current workers: ${concurrency}`);
console.log(`Avg upload time: ${metrics?.averageUploadTime}ms`);
console.log(`Error rate: ${metrics?.errorRate}%`);
```

### React Component Example
```typescript
const [concurrency, setConcurrency] = useState(10);
const [networkStatus, setNetworkStatus] = useState<'good' | 'degraded'>('good');

useEffect(() => {
  const unsubscribe = adaptiveManager.on((event) => {
    switch (event.type) {
      case 'concurrencyChanged':
        setConcurrency(event.newValue);
        break;
      case 'networkDegraded':
        setNetworkStatus('degraded');
        break;
      case 'networkRecovered':
        setNetworkStatus('good');
        break;
    }
  });
  
  return unsubscribe;
}, []);

// Display in UI
<div>
  Workers: {concurrency}
  {networkStatus === 'degraded' && <span>⚠️ Slow network</span>}
</div>
```

## Testing

### Test with Poor Network
```typescript
// Simulate poor network in development
const manager = new AdaptiveConcurrency({
  min: 2,
  max: 10,
  evaluationInterval: 500, // Faster evaluation for testing
});

// Throttle your upload function to simulate slow network
async function slowUpload(chunk) {
  await delay(Math.random() * 5000); // Random 0-5s delay
  if (Math.random() < 0.2) throw new Error('Network error'); // 20% error rate
  return actualUpload(chunk);
}
```

### Unit Tests
```typescript
import { AdaptiveConcurrency } from '@/utils/AdaptiveConcurrency';

test('decreases concurrency on high error rate', () => {
  const manager = new AdaptiveConcurrency({ min: 2, max: 10, initial: 8 });
  manager.start();
  
  // Simulate errors
  for (let i = 0; i < 10; i++) {
    manager.recordChunkStart(`chunk-${i}`);
    manager.recordChunkError(`chunk-${i}`, 'Network error');
  }
  
  manager.forceEvaluation();
  
  expect(manager.getConcurrency()).toBeLessThan(8);
});
```

## Performance Tips

1. **Start Conservative**: Begin with `initial: 10` rather than max
2. **Faster Decrease**: Use `decreaseStep > increaseStep` to react quickly to problems
3. **Longer Intervals**: Use 1500-2000ms evaluation intervals for stability
4. **Monitor Metrics**: Log events to understand behavior in production

## Fallback Strategy

If metrics fail or aren't reliable:

```typescript
const fallbackConcurrency = 10;

try {
  const concurrency = adaptiveManager.getConcurrency();
  return concurrency;
} catch (error) {
  console.error('Adaptive manager failed, using fallback');
  return fallbackConcurrency;
}
```

## Migration Checklist

- [ ] Import `AdaptiveConcurrency` class
- [ ] Initialize manager with your config
- [ ] Start/stop manager with upload lifecycle
- [ ] Replace fixed `MAX_CONCURRENT` with `getConcurrency()`
- [ ] Add `recordChunkStart/Success/Error` calls
- [ ] Add event listeners for monitoring
- [ ] Test with good and poor network conditions
- [ ] Add UI indicators (optional)
- [ ] Deploy and monitor real-world behavior

## Benefits

- ✅ Automatic optimization for varying network conditions
- ✅ Faster uploads on good networks (scales up)
- ✅ Stable uploads on poor networks (scales down)
- ✅ Reduces server load when client is struggling
- ✅ Self-healing (recovers automatically)
- ✅ Zero breaking changes to existing code
- ✅ Fully testable and configurable
