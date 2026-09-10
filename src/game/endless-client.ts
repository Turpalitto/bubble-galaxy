import type { LevelDef } from '../core/types';
import { generateEndless } from './endless';

interface EndlessWorkerResponse {
  id: number;
  level?: LevelDef;
  error?: string;
}

interface PendingRequest {
  streak: number;
  seed: number;
  resolve: (level: LevelDef) => void;
  reject: (error: Error) => void;
}

/** Генерирует Endless вне UI-потока; старые браузеры получают безопасный fallback. */
export class EndlessLevelService {
  private worker: Worker | null = null;
  private nextId = 0;
  private readonly pending = new Map<number, PendingRequest>();

  constructor() {
    if (typeof Worker === 'undefined') return;
    try {
      this.worker = new Worker(new URL('./endless.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<EndlessWorkerResponse>) => {
        const request = this.pending.get(event.data.id);
        if (!request) return;
        this.pending.delete(event.data.id);
        if (event.data.level) request.resolve(event.data.level);
        else request.reject(new Error(event.data.error ?? 'Не удалось сгенерировать бесконечный уровень'));
      };
      this.worker.onerror = () => this.fallbackPending();
    } catch {
      this.worker = null;
    }
  }

  get(streak: number, seed: number): Promise<LevelDef> {
    if (!this.worker) return this.generateFallback(streak, seed);
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { streak, seed, resolve, reject });
      try {
        this.worker!.postMessage({ id, streak, seed });
      } catch {
        this.pending.delete(id);
        void this.generateFallback(streak, seed).then(resolve, reject);
      }
    });
  }

  private fallbackPending(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const [, request] of this.pending)
      void this.generateFallback(request.streak, request.seed).then(request.resolve, request.reject);
    this.pending.clear();
  }

  private generateFallback(streak: number, seed: number): Promise<LevelDef> {
    return new Promise((resolve, reject) => {
      globalThis.setTimeout(() => {
        try {
          resolve(generateEndless(streak, seed));
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }, 0);
    });
  }
}
