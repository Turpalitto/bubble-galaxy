import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudSaveCoalescer } from '../src/platform/yandex';
import { defaultSave, type SaveData } from '../src/game/save';

function saveWith(lastLevel: number): SaveData {
  return { ...defaultSave(), lastLevel };
}

describe('CloudSaveCoalescer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('схлопывает серию изменений в запрос с последним неизменяемым снимком', async () => {
    const sent: SaveData[] = [];
    const coalescer = new CloudSaveCoalescer(async (data) => void sent.push(data), 1000);
    const latest = saveWith(8);
    coalescer.schedule(saveWith(1));
    coalescer.schedule(latest);
    latest.lastLevel = 99;
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent).toHaveLength(1);
    expect(sent[0].lastLevel).toBe(8);
    expect(coalescer.coalesced).toBe(1);
    expect(coalescer.hasPending).toBe(false);
  });

  it('не запускает второй запрос, пока первый в полёте', async () => {
    const sent: SaveData[] = [];
    let release: () => void = () => undefined;
    const coalescer = new CloudSaveCoalescer(
      (data) => new Promise<void>((resolve) => { sent.push(data); release = resolve; }),
      1000
    );
    coalescer.schedule(saveWith(1));
    await vi.advanceTimersByTimeAsync(1000);
    coalescer.schedule(saveWith(2));
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent.map((save) => save.lastLevel)).toEqual([1]);
    release();
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent.map((save) => save.lastLevel)).toEqual([1, 2]);
  });

  it('flush отправляет снимок сразу и ошибка не ломает следующие записи', async () => {
    const sent: number[] = [];
    let fail = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const coalescer = new CloudSaveCoalescer(async (data) => {
      if (fail) throw new Error('quota');
      sent.push(data.lastLevel);
    }, 100);
    coalescer.schedule(saveWith(1));
    await coalescer.flush();
    fail = false;
    coalescer.schedule(saveWith(2));
    await vi.advanceTimersByTimeAsync(100);
    expect(sent).toEqual([2]);
    warn.mockRestore();
  });
});
