/**
 * AdaptiveConcurrency - Dynamic worker pool manager for file uploads
 * 
 * Automatically adjusts concurrency based on real-time network performance.
 * Monitors upload times, error rates, and network stability to optimize throughput.
 */

export interface AdaptiveConcurrencyConfig {
  min: number;                    // Minimum concurrent workers
  max: number;                    // Maximum concurrent workers
  initial?: number;               // Starting concurrency (defaults to min + (max-min)/4)
  increaseStep?: number;          // Workers to add when improving (default: 2)
  decreaseStep?: number;          // Workers to remove when degrading (default: 4)
  evaluationInterval?: number;    // How often to evaluate (ms, default: 1500)
  
  // Thresholds for adjustment decisions
  performanceThreshold?: number;  // % improvement needed to increase (default: 15)
  degradationThreshold?: number;  // % degradation to trigger decrease (default: 20)
  errorRateThreshold?: number;    // Error rate % to trigger decrease (default: 10)
  stabilityWindow?: number;       // Samples needed for stability (default: 3)
  
  // Timeout and recovery
  baseTimeout?: number;           // Base timeout for chunk uploads in ms (default: 30000)
  maxTimeout?: number;            // Maximum timeout in ms (default: 120000)
  timeoutMultiplier?: number;     // Multiply avg upload time by this for dynamic timeout (default: 5)
}

export interface NetworkMetrics {
  averageUploadTime: number;      // ms per chunk
  successRate: number;            // % (0-100)
  errorRate: number;              // % (0-100)
  retryRate: number;              // % chunks that needed retry (0-100)
  variance: number;               // Upload time variance (instability indicator)
  throughput: number;             // chunks/second
  timestamp: number;
}

export type ConcurrencyEvent = 
  | { type: 'concurrencyChanged'; oldValue: number; newValue: number; reason: string }
  | { type: 'networkDegraded'; metrics: NetworkMetrics }
  | { type: 'networkRecovered'; metrics: NetworkMetrics }
  | { type: 'metricsUpdated'; metrics: NetworkMetrics };

type EventListener = (event: ConcurrencyEvent) => void;

interface ChunkMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  retryCount: number;
  error?: string;
}

export class AdaptiveConcurrency {
  private config: Required<AdaptiveConcurrencyConfig>;
  private currentConcurrency: number;
  private listeners: EventListener[] = [];
  
  // Metrics tracking
  private chunkMetrics: ChunkMetrics[] = [];
  private recentMetrics: NetworkMetrics[] = [];
  private evaluationTimer: NodeJS.Timeout | null = null;
  
  // State tracking
  private isEvaluating = false;
  private consecutiveImprovements = 0;
  private consecutiveDegradations = 0;
  private lastAdjustmentTime = 0;
  private isDegraded = false;
  
  // Performance baseline
  private baselineMetrics: NetworkMetrics | null = null;
  
  constructor(config: AdaptiveConcurrencyConfig) {
    // Validate and set defaults
    if (config.min < 1 || config.max < config.min) {
      throw new Error('Invalid concurrency bounds: min must be >= 1 and max >= min');
    }
    
    this.config = {
      min: config.min,
      max: config.max,
      initial: config.initial ?? Math.ceil(config.min + (config.max - config.min) / 4),
      increaseStep: config.increaseStep ?? 2,
      decreaseStep: config.decreaseStep ?? 4,
      evaluationInterval: config.evaluationInterval ?? 1500,
      performanceThreshold: config.performanceThreshold ?? 15,
      degradationThreshold: config.degradationThreshold ?? 20,
      errorRateThreshold: config.errorRateThreshold ?? 10,
      stabilityWindow: config.stabilityWindow ?? 3,
      baseTimeout: config.baseTimeout ?? 30000,
      maxTimeout: config.maxTimeout ?? 120000,
      timeoutMultiplier: config.timeoutMultiplier ?? 5,
    };
    
    this.currentConcurrency = Math.min(
      Math.max(this.config.initial, this.config.min),
      this.config.max
    );
  }
  
  /**
   * Start the adaptive concurrency manager
   */
  public start(): void {
    if (this.evaluationTimer) return;
    
    this.evaluationTimer = setInterval(() => {
      this.evaluate();
    }, this.config.evaluationInterval);
  }
  
  /**
   * Stop the manager and cleanup
   */
  public stop(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
    }
  }
  
  /**
   * Get current concurrency level (with defensive bounds check)
   */
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
  
  /**
   * Record start of a chunk upload
   */
  public recordChunkStart(chunkId: string): void {
    this.chunkMetrics.push({
      startTime: Date.now(),
      success: false,
      retryCount: 0,
    });
  }
  
  /**
   * Record successful chunk upload
   */
  public recordChunkSuccess(chunkId: string, duration: number, retryCount = 0): void {
    const lastMetric = this.chunkMetrics[this.chunkMetrics.length - 1];
    if (lastMetric) {
      lastMetric.endTime = Date.now();
      lastMetric.duration = duration;
      lastMetric.success = true;
      lastMetric.retryCount = retryCount;
    }
    
    // Keep only recent metrics (last 100 chunks or 5 minutes worth)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    this.chunkMetrics = this.chunkMetrics
      .filter(m => (m.startTime > fiveMinutesAgo))
      .slice(-100);
  }
  
  /**
   * Record failed chunk upload
   */
  public recordChunkError(chunkId: string, error: string, retryCount = 0): void {
    const lastMetric = this.chunkMetrics[this.chunkMetrics.length - 1];
    if (lastMetric) {
      lastMetric.endTime = Date.now();
      lastMetric.duration = Date.now() - lastMetric.startTime;
      lastMetric.success = false;
      lastMetric.error = error;
      lastMetric.retryCount = retryCount;
    }
  }
  
  /**
   * Subscribe to concurrency events
   */
  public on(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Manually trigger evaluation (useful for testing)
   */
  public forceEvaluation(): void {
    this.evaluate();
  }
  
  /**
   * Reset metrics and state
   */
  public reset(): void {
    this.chunkMetrics = [];
    this.recentMetrics = [];
    this.consecutiveImprovements = 0;
    this.consecutiveDegradations = 0;
    this.baselineMetrics = null;
    this.isDegraded = false;
  }
  
  /**
   * Get current network metrics (for monitoring/debugging)
   */
  public getMetrics(): NetworkMetrics | null {
    return this.recentMetrics[this.recentMetrics.length - 1] ?? null;
  }
  
  /**
   * Main evaluation logic - analyzes metrics and adjusts concurrency
   */
  private evaluate(): void {
    if (this.isEvaluating || this.chunkMetrics.length < 5) {
      return; // Need minimum samples
    }
    
    this.isEvaluating = true;
    
    try {
      const metrics = this.calculateMetrics();
      
      if (!metrics) {
        this.isEvaluating = false;
        return;
      }
      
      this.recentMetrics.push(metrics);
      if (this.recentMetrics.length > 10) {
        this.recentMetrics.shift();
      }
      
      this.emit({ type: 'metricsUpdated', metrics });
      
      // Set baseline on first meaningful evaluation
      if (!this.baselineMetrics) {
        this.baselineMetrics = metrics;
        this.isEvaluating = false;
        return;
      }
      
      // Check if we should adjust concurrency
      const decision = this.makeDecision(metrics);
      
      if (decision !== 0) {
        this.adjustConcurrency(decision, metrics);
      }
      
    } finally {
      this.isEvaluating = false;
    }
  }
  
  /**
   * Calculate current network metrics from recent chunk data
   */
  private calculateMetrics(): NetworkMetrics | null {
    const completed = this.chunkMetrics.filter(m => m.endTime);
    
    if (completed.length < 3) {
      return null; // Not enough data
    }
    
    const durations = completed.map(m => m.duration!);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    
    // Calculate variance (instability indicator)
    const variance = durations.reduce((sum, d) => 
      sum + Math.pow(d - avgDuration, 2), 0
    ) / durations.length;
    
    const successCount = completed.filter(m => m.success).length;
    const errorCount = completed.filter(m => !m.success).length;
    const retryCount = completed.filter(m => m.retryCount > 0).length;
    
    const totalTime = Math.max(
      completed[completed.length - 1].endTime! - completed[0].startTime,
      1
    );
    
    return {
      averageUploadTime: avgDuration,
      successRate: (successCount / completed.length) * 100,
      errorRate: (errorCount / completed.length) * 100,
      retryRate: (retryCount / completed.length) * 100,
      variance: Math.sqrt(variance),
      throughput: (completed.length / totalTime) * 1000, // chunks per second
      timestamp: Date.now(),
    };
  }
  
  /**
   * Decide whether to increase, decrease, or maintain concurrency
   * Returns: positive = increase, negative = decrease, 0 = maintain
   */
  private makeDecision(current: NetworkMetrics): number {
    const baseline = this.baselineMetrics!;
    
    // Critical degradation - immediate decrease
    if (
      current.errorRate > this.config.errorRateThreshold ||
      current.retryRate > 25 ||
      current.successRate < 50
    ) {
      this.consecutiveDegradations++;
      this.consecutiveImprovements = 0;
      
      if (!this.isDegraded) {
        this.isDegraded = true;
        this.emit({ type: 'networkDegraded', metrics: current });
      }
      
      return -1;
    }
    
    // Check for improvement vs baseline
    const timeImprovement = 
      ((baseline.averageUploadTime - current.averageUploadTime) / baseline.averageUploadTime) * 100;
    
    const throughputImprovement =
      ((current.throughput - baseline.throughput) / baseline.throughput) * 100;
    
    // Network is unstable (high variance)
    const isUnstable = current.variance > baseline.variance * 1.5;
    
    // RECOVERY MODE: Detect dramatic performance improvement (throttling removed)
    // If we were degraded and now performance is much better, aggressively increase workers
    if (
      this.isDegraded &&
      timeImprovement > 50 && // Upload time improved by >50%
      current.errorRate < 5 &&
      current.successRate > 90 &&
      !isUnstable
    ) {
      console.log(`🚀 Fast recovery detected: ${timeImprovement.toFixed(0)}% improvement, jumping to higher concurrency`);
      this.consecutiveImprovements = this.config.stabilityWindow; // Immediate increase
      this.consecutiveDegradations = 0;
      this.isDegraded = false;
      this.emit({ type: 'networkRecovered', metrics: current });
      
      // Aggressive increase on recovery
      if (this.currentConcurrency < this.config.max) {
        return 1;
      }
    }
    
    // Performance degraded significantly
    if (
      timeImprovement < -this.config.degradationThreshold ||
      throughputImprovement < -this.config.degradationThreshold ||
      isUnstable
    ) {
      this.consecutiveDegradations++;
      this.consecutiveImprovements = 0;
      
      if (!this.isDegraded && this.consecutiveDegradations >= 2) {
        this.isDegraded = true;
        this.emit({ type: 'networkDegraded', metrics: current });
      }
      
      // Only decrease if we have room and we're confident
      if (
        this.currentConcurrency > this.config.min &&
        this.consecutiveDegradations >= 2
      ) {
        return -1;
      }
      
      return 0;
    }
    
    // Performance improved
    if (
      timeImprovement > this.config.performanceThreshold &&
      throughputImprovement > this.config.performanceThreshold / 2 &&
      current.errorRate < 5 &&
      !isUnstable
    ) {
      this.consecutiveImprovements++;
      this.consecutiveDegradations = 0;
      
      if (this.isDegraded) {
        this.isDegraded = false;
        this.emit({ type: 'networkRecovered', metrics: current });
      }
      
      // Only increase if we have room and we're stable
      if (
        this.currentConcurrency < this.config.max &&
        this.consecutiveImprovements >= this.config.stabilityWindow
      ) {
        return 1;
      }
    }
    
    // Network recovered but not enough to increase
    if (this.isDegraded && current.errorRate < 5 && current.successRate > 90) {
      this.consecutiveDegradations = 0;
      this.consecutiveImprovements++;
      
      if (this.consecutiveImprovements >= this.config.stabilityWindow) {
        this.isDegraded = false;
        this.emit({ type: 'networkRecovered', metrics: current });
      }
    }
    
    return 0;
  }
  
  /**
   * Adjust concurrency level
   */
  private adjustConcurrency(direction: number, metrics: NetworkMetrics): void {
    const now = Date.now();
    
    // Rate limit adjustments (min 2x evaluation interval between changes)
    if (now - this.lastAdjustmentTime < this.config.evaluationInterval * 2) {
      return;
    }
    
    const oldValue = this.currentConcurrency;
    let newValue: number;
    let reason: string;
    
    if (direction > 0) {
      // Increase - more aggressive if recently degraded (recovery mode)
      const wasRecentlyDegraded = this.consecutiveDegradations > 0 || 
        (now - this.lastAdjustmentTime < this.config.evaluationInterval * 5);
      
      const increaseAmount = wasRecentlyDegraded 
        ? this.config.increaseStep * 2  // Double increase during recovery
        : this.config.increaseStep;
      
      newValue = Math.min(
        this.currentConcurrency + increaseAmount,
        this.config.max
      );
      reason = wasRecentlyDegraded
        ? `Fast recovery: ${metrics.averageUploadTime.toFixed(0)}ms/chunk, ${metrics.throughput.toFixed(2)} chunks/s`
        : `Performance improved: ${metrics.averageUploadTime.toFixed(0)}ms/chunk, ${metrics.throughput.toFixed(2)} chunks/s`;
      
      // Reset improvement counter after successful increase
      this.consecutiveImprovements = 0;
      
    } else {
      // Decrease
      newValue = Math.max(
        this.currentConcurrency - this.config.decreaseStep,
        this.config.min
      );
      reason = `Performance degraded: errors ${metrics.errorRate.toFixed(1)}%, ` +
               `retries ${metrics.retryRate.toFixed(1)}%`;
      
      // Reset degradation counter after successful decrease
      this.consecutiveDegradations = 0;
    }
    
    // DEFENSIVE: Final bounds check before assignment
    newValue = Math.max(this.config.min, Math.min(newValue, this.config.max));
    
    if (newValue !== oldValue) {
      // DEFENSIVE: Validate newValue is within bounds
      if (newValue < this.config.min || newValue > this.config.max) {
        console.error(`❌ INVALID CONCURRENCY ADJUSTMENT: ${newValue} outside bounds [${this.config.min}, ${this.config.max}]`);
        return;
      }
      
      this.currentConcurrency = newValue;
      this.lastAdjustmentTime = now;
      
      // Update baseline to current performance after adjustment
      this.baselineMetrics = metrics;
      
      console.log(`📊 Concurrency adjusted: ${oldValue} → ${newValue} | Reason: ${reason}`);
      
      this.emit({
        type: 'concurrencyChanged',
        oldValue,
        newValue,
        reason,
      });
    }
  }
  
  /**
   * Emit event to all listeners
   */
  private emit(event: ConcurrencyEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in AdaptiveConcurrency event listener:', error);
      }
    });
  }
  
  /**
   * Calculate dynamic timeout based on recent performance
   */
  public getTimeout(): number {
    const recentMetric = this.recentMetrics[this.recentMetrics.length - 1];
    
    if (!recentMetric || recentMetric.averageUploadTime === 0) {
      return this.config.baseTimeout;
    }
    
    // Dynamic timeout: average upload time * multiplier, clamped to min/max
    const dynamicTimeout = recentMetric.averageUploadTime * this.config.timeoutMultiplier;
    
    return Math.min(
      Math.max(dynamicTimeout, this.config.baseTimeout),
      this.config.maxTimeout
    );
  }
  
  /**
   * Get diagnostic information (for debugging)
   */
  public getDiagnostics() {
    return {
      currentConcurrency: this.currentConcurrency,
      chunkMetricsSamples: this.chunkMetrics.length,
      recentMetrics: this.recentMetrics,
      baselineMetrics: this.baselineMetrics,
      consecutiveImprovements: this.consecutiveImprovements,
      consecutiveDegradations: this.consecutiveDegradations,
      isDegraded: this.isDegraded,
      config: this.config,
    };
  }
}
