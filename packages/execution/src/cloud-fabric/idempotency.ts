export class IdempotencyStore<T> {
  private readonly records = new Map<string, T>();

  get(key: string): T | undefined { return this.records.get(key); }

  set(key: string, value: T): void {
    if (this.records.has(key)) throw new Error(`idempotency_key_already_exists:${key}`);
    this.records.set(key, value);
  }

  async onceWithStatus(key: string, operation: () => Promise<T>): Promise<{ value: T; reused: boolean }> {
    const existing = this.get(key);
    if (existing !== undefined) return { value: existing, reused: true };
    const value = await operation();
    this.set(key, value);
    return { value, reused: false };
  }

  async once(key: string, operation: () => Promise<T>): Promise<T> {
    return (await this.onceWithStatus(key, operation)).value;
  }
}

export function executionIdempotencyKey(planId: string, taskId: string, baseSha: string, attempt: number, modelProfile?: string): string {
  const base = [planId, taskId, baseSha, attempt].join(':');
  return modelProfile === undefined ? base : `${base}:profile:${encodeURIComponent(modelProfile)}`;
}
