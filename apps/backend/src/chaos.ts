import { config } from './config';
import { chaosEventsTotal, podReadinessGauge, cpuSpikeActiveGauge } from './metrics';

class ChaosManager {
  private isReadinessFailing = false;
  private artificialLatencyMs = 0;
  private isCpuSpiking = false;
  private cpuSpikeTimeout: NodeJS.Timeout | null = null;
  private memoryLeakBuffers: Buffer[] = [];

  // Get current status of all chaos injections
  getStatus() {
    return {
      pod: config.podName,
      env: config.envName,
      version: config.appVersion,
      isReadinessFailing: this.isReadinessFailing,
      artificialLatencyMs: this.artificialLatencyMs,
      isCpuSpiking: this.isCpuSpiking,
      leakedMemoryMb: Math.round((this.memoryLeakBuffers.length * 10 * 1024 * 1024) / (1024 * 1024)),
    };
  }

  // Crash pod: exits process with exit code 1
  triggerCrash(delayMs = 200) {
    chaosEventsTotal.inc({ type: 'crash', pod: config.podName, env: config.envName });
    console.error(`💥 [CHAOS] Pod crash triggered on ${config.podName}! Exiting in ${delayMs}ms...`);
    
    setTimeout(() => {
      process.exit(1);
    }, delayMs);

    return {
      success: true,
      pod: config.podName,
      message: `SIGTERM/SIGKILL simulated. Process exiting with code 1 in ${delayMs}ms. Watch Rancher restart count increase!`,
    };
  }

  // Trigger high CPU load for HPA testing
  triggerCpuSpike(durationSeconds = 30) {
    if (this.isCpuSpiking) {
      return {
        success: false,
        message: 'CPU spike is already active on this pod.',
        pod: config.podName,
      };
    }

    this.isCpuSpiking = true;
    cpuSpikeActiveGauge.set({ pod: config.podName }, 1);
    chaosEventsTotal.inc({ type: 'cpu_spike', pod: config.podName, env: config.envName });
    console.warn(`🔥 [CHAOS] CPU spike started on ${config.podName} for ${durationSeconds} seconds.`);

    const endTime = Date.now() + durationSeconds * 1000;

    // Run non-blocking busy loop batches to keep server somewhat responsive while burning CPU
    const burnBatch = () => {
      if (Date.now() >= endTime || !this.isCpuSpiking) {
        this.stopCpuSpike();
        return;
      }

      // Burn CPU for 80ms, yield 5ms
      const batchEnd = Date.now() + 80;
      while (Date.now() < batchEnd) {
        Math.sqrt(Math.random() * 99999999);
      }

      setImmediate(burnBatch);
    };

    burnBatch();

    // Safety timeout
    this.cpuSpikeTimeout = setTimeout(() => {
      this.stopCpuSpike();
    }, durationSeconds * 1000 + 500);

    return {
      success: true,
      pod: config.podName,
      durationSeconds,
      message: `CPU spike initiated on pod ${config.podName} for ${durationSeconds}s. Watch Kubernetes HPA scale replicas!`,
    };
  }

  stopCpuSpike() {
    this.isCpuSpiking = false;
    cpuSpikeActiveGauge.set({ pod: config.podName }, 0);
    if (this.cpuSpikeTimeout) {
      clearTimeout(this.cpuSpikeTimeout);
      this.cpuSpikeTimeout = null;
    }
    console.log(`✅ [CHAOS] CPU spike finished on ${config.podName}.`);
  }

  // Toggle readiness probe failure
  toggleReadiness(forceState?: boolean) {
    if (typeof forceState === 'boolean') {
      this.isReadinessFailing = !forceState;
    } else {
      this.isReadinessFailing = !this.isReadinessFailing;
    }

    const isReady = !this.isReadinessFailing;
    podReadinessGauge.set({ pod: config.podName, env: config.envName }, isReady ? 1 : 0);
    chaosEventsTotal.inc({ type: 'readiness_toggle', pod: config.podName, env: config.envName });

    console.warn(`⚠️ [CHAOS] Readiness probe toggled on ${config.podName}: ${isReady ? 'READY (200)' : 'FAILING (503)'}`);

    return {
      success: true,
      pod: config.podName,
      isReady,
      message: isReady
        ? `Pod ${config.podName} is now reporting READY (HTTP 200). Kubernetes will route traffic here.`
        : `Pod ${config.podName} is now reporting UNREADY (HTTP 503). Kubernetes endpoints will remove this pod!`,
    };
  }

  getIsReadinessFailing() {
    return this.isReadinessFailing;
  }

  // Simulate memory leak
  triggerMemoryLeak(megabytes = 50) {
    try {
      // Allocate buffers in chunks of 10MB
      const chunks = Math.ceil(megabytes / 10);
      for (let i = 0; i < chunks; i++) {
        const buf = Buffer.alloc(10 * 1024 * 1024, 'KUBEPULSE_LEAK_BYTE');
        this.memoryLeakBuffers.push(buf);
      }
      chaosEventsTotal.inc({ type: 'memory_leak', pod: config.podName, env: config.envName });
      console.warn(`💧 [CHAOS] Allocated ${megabytes}MB memory on ${config.podName}. Total allocated: ${this.memoryLeakBuffers.length * 10}MB`);
      return {
        success: true,
        pod: config.podName,
        allocatedMb: megabytes,
        totalLeakedMb: this.memoryLeakBuffers.length * 10,
        message: `Allocated ${megabytes}MB in heap. Current leaked total: ${this.memoryLeakBuffers.length * 10}MB`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
      };
    }
  }

  // Set artificial latency
  setLatency(latencyMs: number) {
    this.artificialLatencyMs = Math.max(0, latencyMs);
    console.log(`⏱️ [CHAOS] Artificial latency set to ${this.artificialLatencyMs}ms on ${config.podName}`);
    return {
      success: true,
      pod: config.podName,
      latencyMs: this.artificialLatencyMs,
    };
  }

  getLatencyMs() {
    return this.artificialLatencyMs;
  }

  // Reset all chaos
  reset() {
    this.isReadinessFailing = false;
    this.artificialLatencyMs = 0;
    this.stopCpuSpike();
    this.memoryLeakBuffers = [];
    podReadinessGauge.set({ pod: config.podName, env: config.envName }, 1);
    console.log(`🧹 [CHAOS] Reset all chaos states to normal on ${config.podName}`);
    return {
      success: true,
      pod: config.podName,
      message: 'All chaos simulations reset. Pod is healthy.',
    };
  }
}

export const chaos = new ChaosManager();
