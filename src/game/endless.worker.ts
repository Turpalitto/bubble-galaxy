import { generateEndless } from './endless';

interface EndlessWorkerRequest {
  id: number;
  streak: number;
  seed: number;
}

self.onmessage = (event: MessageEvent<EndlessWorkerRequest>) => {
  const { id, streak, seed } = event.data;
  try {
    self.postMessage({ id, level: generateEndless(streak, seed) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
