import { expect, test, type Page } from '@playwright/test';

async function seedCampaignLevelFour(page: Page, hintTokens: number): Promise<void> {
  await page.addInitScript((tokens) => {
    localStorage.setItem(
      'parkovka.save.v1',
      JSON.stringify({
        v: 1,
        stars: { '1': 3, '2': 3, '3': 3 },
        sound: false,
        music: false,
        lang: 'ru',
        lastLevel: 4,
        targetSkin: 0,
        hintTokens: tokens
      })
    );
  }, hintTokens);
}

async function restart(page: Page, times: number): Promise<void> {
  for (let i = 0; i < times; i++) await page.getByTestId('btn-restart').click();
}

async function savedState(page: Page): Promise<{ hintTokens?: number; stars?: Record<string, number>; v?: number }> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('parkovka.save.v1') ?? '{}'));
}

test.describe('retention и безопасный пропуск', () => {
  test('меню показывает три задания дня', async ({ page }) => {
    await page.goto('/?mock=1&lang=ru&daytime=day');
    await expect(page.getByTestId('menu-quests')).toBeVisible();
    await expect(page.getByTestId('menu-quests')).toContainText('/3');
    await page.getByTestId('menu-quests').click();
    await expect(page.getByTestId('quests-overlay')).toBeVisible();
    await expect(page.getByTestId('quests-overlay').locator('.weekly-quest')).toHaveCount(3);
  });

  test('без rewarded пропускает за две накопленные подсказки', async ({ page }) => {
    await seedCampaignLevelFour(page, 2);
    await page.goto('/?mock=1&lang=ru&rewardedSkip=1');
    await page.getByTestId('menu-play').click();
    await restart(page, 3);
    await expect(page.getByTestId('btn-skip')).toBeVisible();
    await page.getByTestId('btn-skip').click();
    await expect.poll(async () => savedState(page)).toMatchObject({ hintTokens: 0, stars: { '4': 1 }, v: 2 });
  });

  test('после шести рестартов пропускает бесплатно, если rewarded недоступен', async ({ page }) => {
    await seedCampaignLevelFour(page, 0);
    await page.goto('/?mock=1&lang=ru&rewardedSkip=1');
    await page.getByTestId('menu-play').click();
    await restart(page, 6);
    await page.getByTestId('btn-skip').click();
    await expect.poll(async () => savedState(page)).toMatchObject({ stars: { '4': 1 }, v: 2 });
    expect((await savedState(page)).hintTokens ?? 0).toBe(0);
  });

  test('после долгого перерыва дед встречает игрока и дарит одну подсказку', async ({ page }) => {
    await page.addInitScript(() => {
      const key = (date: Date) => {
        const pad = (value: number) => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      };
      const now = new Date();
      const first = new Date(now);
      first.setDate(first.getDate() - 10);
      const last = new Date(now);
      last.setDate(last.getDate() - 4);
      localStorage.setItem(
        'parkovka.save.v1',
        JSON.stringify({
          v: 1,
          stars: {},
          sound: false,
          music: false,
          lang: 'ru',
          lastLevel: 1,
          targetSkin: 0,
          hintTokens: 0,
          firstLaunch: key(first),
          lastSeen: key(last),
          sessions: 1
        })
      );
    });
    await page.goto('/?mock=1&lang=ru');
    await expect(page.getByTestId('system-toast')).toContainText('Дед соскучился');
    await expect.poll(async () => savedState(page)).toMatchObject({ hintTokens: 1, sessions: 2, v: 2 });
  });
});
