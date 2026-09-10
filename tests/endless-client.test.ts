import { describe, expect, it } from 'vitest';
import { EndlessLevelService } from '../src/game/endless-client';
import { validateLevel } from '../src/core/validator';

describe('EndlessLevelService', () => {
  it('генерирует валидный уровень без Worker', async () => {
    const level = await new EndlessLevelService().get(0, 123);
    expect(validateLevel(level)).toEqual([]);
  });
});
