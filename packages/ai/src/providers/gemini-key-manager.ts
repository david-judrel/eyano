export interface GeminiKey {
  id: string;
  key: string;
  cooldownUntil: number;
  failures: number;
  lastUsed: number;
  requestCount: number;
  successCount: number;
  rateLimitCount: number;
}

export interface KeyStatus {
  id: string;
  isActive: boolean;
  cooldownUntil: number;
  cooldownRemaining: number;
  failures: number;
  requestCount: number;
  successCount: number;
  rateLimitCount: number;
  usagePercent: number;
}

export interface Metrics {
  totalRequests: number;
  totalSuccess: number;
  totalRateLimits: number;
  totalKeySwitches: number;
  keys: KeyStatus[];
}

export class GeminiKeyManager {
  private keys: GeminiKey[] = [];
  private currentIndex = 0;
  private cooldownMs: number;
  private metrics: {
    totalRequests: number;
    totalSuccess: number;
    totalRateLimits: number;
    totalKeySwitches: number;
  } = { totalRequests: 0, totalSuccess: 0, totalRateLimits: 0, totalKeySwitches: 0 };

  constructor(apiKeys: string[], cooldownMs: number = 60_000) {
    if (!apiKeys.length) {
      throw new Error('No Gemini API keys configured');
    }

    this.cooldownMs = cooldownMs;
    this.keys = apiKeys.map((key, index) => ({
      id: `gemini-key-${index + 1}`,
      key,
      cooldownUntil: 0,
      failures: 0,
      lastUsed: 0,
      requestCount: 0,
      successCount: 0,
      rateLimitCount: 0,
    }));

    console.log(`[GeminiKeyManager] Initialized with ${this.keys.length} keys`);
  }

  /**
   * Get the next available key. Returns null if all keys are in cooldown.
   */
  getAvailableKey(): GeminiKey | null {
    const now = Date.now();

    for (let i = 0; i < this.keys.length; i++) {
      const index = (this.currentIndex + i) % this.keys.length;
      const key = this.keys[index];

      if (key.cooldownUntil <= now) {
        this.currentIndex = (index + 1) % this.keys.length;
        key.lastUsed = now;
        key.requestCount++;
        this.metrics.totalRequests++;
        return key;
      }
    }

    return null;
  }

  /**
   * Mark a key as rate-limited (429 error)
   */
  markRateLimited(keyId: string, customCooldownMs?: number): void {
    const key = this.keys.find((k) => k.id === keyId);
    if (!key) return;

    key.failures++;
    key.rateLimitCount++;
    this.metrics.totalRateLimits++;
    this.metrics.totalKeySwitches++;

    const exponentialBackoff = Math.min(
      this.cooldownMs * Math.pow(2, key.failures - 1),
      600_000
    );

    const cooldown = customCooldownMs || exponentialBackoff;
    key.cooldownUntil = Date.now() + cooldown;

    console.warn(
      `[GeminiKeyManager] ${keyId} rate limited. Cooldown: ${cooldown}ms. Failures: ${key.failures}`
    );
  }

  /**
   * Mark a key as successful
   */
  markSuccess(keyId: string): void {
    const key = this.keys.find((k) => k.id === keyId);
    if (!key) return;

    key.successCount++;
    this.metrics.totalSuccess++;

    if (key.failures > 0) {
      key.failures--;
    }

    if (key.failures === 0) {
      key.cooldownUntil = 0;
    }
  }

  /**
   * Get status of all keys (never exposes actual API keys)
   */
  getStatus(): KeyStatus[] {
    const now = Date.now();
    const totalRequests = this.metrics.totalRequests || 1;

    return this.keys.map((key) => ({
      id: key.id,
      isActive: key.cooldownUntil <= now,
      cooldownUntil: key.cooldownUntil,
      cooldownRemaining: Math.max(0, key.cooldownUntil - now),
      failures: key.failures,
      requestCount: key.requestCount,
      successCount: key.successCount,
      rateLimitCount: key.rateLimitCount,
      usagePercent: Math.round((key.requestCount / totalRequests) * 100),
    }));
  }

  /**
   * Get full metrics
   */
  getMetrics(): Metrics {
    return {
      totalRequests: this.metrics.totalRequests,
      totalSuccess: this.metrics.totalSuccess,
      totalRateLimits: this.metrics.totalRateLimits,
      totalKeySwitches: this.metrics.totalKeySwitches,
      keys: this.getStatus(),
    };
  }

  /**
   * Get the number of available keys
   */
  getAvailableCount(): number {
    const now = Date.now();
    return this.keys.filter((key) => key.cooldownUntil <= now).length;
  }

  /**
   * Force reset a specific key
   */
  resetKey(keyId: string): void {
    const key = this.keys.find((k) => k.id === keyId);
    if (!key) return;

    key.failures = 0;
    key.cooldownUntil = 0;
    console.log(`[GeminiKeyManager] ${keyId} manually reset`);
  }

  /**
   * Force reset all keys
   */
  resetAllKeys(): void {
    this.keys.forEach((key) => {
      key.failures = 0;
      key.cooldownUntil = 0;
    });
    console.log('[GeminiKeyManager] All keys reset');
  }
}
