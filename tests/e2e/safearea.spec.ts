/**
 * safearea.spec.ts —— M4.5.9：iPhone 横屏安全区验收（马教授 1607237 不通过项）。
 * 用 addStyleTag 覆盖 --safe-* 模拟安全区（左右各 62px、上下各 20px），
 * 874×402 横屏玩一整局并断言：
 *  - 右竖栏里菜市场/小卖部最底下的「Done with this stop」等主按钮
 *    完整落在可视安全区内（底部安全区挂在栏内内容上，不再被屏下沿裁掉）；
 *  - 菜市场选中卡后 Buy 与小卖部一致显示「Buy (N coins)」；
 *  - 开饭页标题「Dinner time」、4 个盘子同一行、底部按钮不滚动可见；
 *  - 感想页 6 个选项 + 标题一屏全显示，按钮高 ≥48px；
 *  - M4.5.9c：感想结果 4 张卡片 2×2 完整可见、「Everyone has shared」
 *    小字在屏内、「Play again」≥48px 且不与任何感想卡片重叠。
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { assertClean, openGame, playToEnd } from './helpers';

test.use({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true });
test.setTimeout(240_000);

const VW = 874;
const VH = 402;
/* 模拟 iPhone 安全区：灵动岛左右 62px、上下 20px（与截图脚本同参数） */
const SAFE = { t: 20, r: 62, b: 20, l: 62 };
const SAFE_CSS = `:root{--safe-t:${SAFE.t}px !important;--safe-r:${SAFE.r}px !important;--safe-b:${SAFE.b}px !important;--safe-l:${SAFE.l}px !important;}`;

/** 断言 locator 命中的每个可见元素完整落在安全区内（1px 取整容忍） */
async function expectInSafeArea(loc: Locator, label: string): Promise<void> {
  const boxes = await loc.evaluateAll((els) =>
    els
      .filter((e) => e.getClientRects().length > 0)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { t: r.top, r: r.right, b: r.bottom, l: r.left };
      }),
  );
  expect(boxes.length, `${label}：至少命中一个可见元素`).toBeGreaterThan(0);
  for (const [i, x] of boxes.entries()) {
    expect(x.t, `${label}[${i}] 上沿越出安全区 ${JSON.stringify(x)}`).toBeGreaterThanOrEqual(
      SAFE.t - 1,
    );
    expect(x.b, `${label}[${i}] 下沿被屏底裁掉 ${JSON.stringify(x)}`).toBeLessThanOrEqual(
      VH - SAFE.b + 1,
    );
    expect(x.l, `${label}[${i}] 左沿越出安全区 ${JSON.stringify(x)}`).toBeGreaterThanOrEqual(
      SAFE.l - 1,
    );
    expect(x.r, `${label}[${i}] 右沿被屏右裁掉 ${JSON.stringify(x)}`).toBeLessThanOrEqual(
      VW - SAFE.r + 1,
    );
  }
}

/**
 * 面板打开/选中卡时竖栏会先短后长、由 Game.tsx 的吸底滚动追底，
 * 量早了会抓到过渡态——断言包在 toPass 里重试到落定（最多 4s）。
 */
async function expectInSafeAreaSoon(loc: Locator, label: string): Promise<void> {
  await expect(() => expectInSafeArea(loc, label)).toPass({ timeout: 4000 });
}

/** 右竖栏里所有可点动作钮（含最底下的 Done with this stop） */
const railButtons = (p: Page) => p.locator('.phone-rail [data-key]:not([disabled])');

/**
 * M4.5.9b 新增断言：主按钮文字不能超出按钮边界——
 * 可见的 [data-primary] 按钮满足 scrollWidth/scrollHeight ≤ client 尺寸
 * （抓「Buy (3 coins)」文字顶出胶囊上下沿这类溢出，1px 取整容忍）。
 */
async function expectPrimaryTextFits(p: Page): Promise<void> {
  const overs = await p.locator('[data-primary="true"]').evaluateAll((els) =>
    els
      .filter((e) => e.getClientRects().length > 0)
      .map((e) => ({
        who: e.getAttribute('data-testid') ?? e.textContent ?? e.className,
        sw: e.scrollWidth,
        sh: e.scrollHeight,
        cw: e.clientWidth,
        ch: e.clientHeight,
      }))
      .filter((x) => x.sw > x.cw + 1 || x.sh > x.ch + 1),
  );
  expect(overs, '主按钮文字超出按钮边界').toEqual([]);
}

test('874×402 + 安全区：整局所有主按钮完整可见', async ({ page }) => {
  const errors = await openGame(page);
  await page.addStyleTag({ content: SAFE_CSS });

  const done = {
    chrome: false, // 左上头像排 + 左下圆钮
    enter: false, // 栏内「Go to this stop」
    marketUnsel: false,
    marketSel: false,
    storeUnsel: false,
    storeSel: false,
    feast: false,
    reflect: false,
  };

  await playToEnd(page, {
    maxSteps: 900,
    onStep: async (p) => {
      // —— M4.5.9b：每一步都查主按钮文字不超出按钮边界 ——
      await expectPrimaryTextFits(p);

      // —— 常驻件：左上小头像排 + 左下钱包/求助圆钮 ——
      if (!done.chrome && (await p.locator('.phone-rail').count()) > 0) {
        done.chrome = true;
        await expectInSafeAreaSoon(p.locator('.phone-quick .phone-fab'), '左下圆钮');
        await expectInSafeAreaSoon(p.locator('.phone-bots .phone-bot'), '左上头像');
      }

      // —— 栏内「Go to this stop」主按钮（introPhase 无弹窗时）——
      if (
        !done.enter &&
        (await p.locator('.phone-turn [data-testid="action-primary"]').count()) > 0
      ) {
        done.enter = true;
        await expectInSafeAreaSoon(
          p.locator('.phone-turn [data-testid="action-primary"]'),
          'Go to this stop',
        );
      }

      // —— 菜市场：未选卡 + 选中卡两种状态的栏内按钮 ——
      if (!done.marketUnsel && (await p.getByTestId('panel-market').count()) > 0) {
        done.marketUnsel = true;
        await expectInSafeAreaSoon(railButtons(p), '菜市场栏内按钮');
        // 选一张卡 → Buy 接管主按钮并显示「Buy (N coins)」（与小卖部一致）
        const card = p
          .locator('.phone-rail [data-testid^="action-stall-"]:not([disabled])')
          .first();
        if ((await card.count()) > 0) {
          done.marketSel = true;
          await card.dispatchEvent('click');
          await expect(p.getByTestId('action-primary')).toContainText(
            /Buy \(\d+ coins?\)/,
          );
          await expectInSafeAreaSoon(railButtons(p), '菜市场选中后栏内按钮');
        }
      }

      // —— 小卖部：同样检查（含「Done with this stop」不被屏下沿裁）——
      if (!done.storeUnsel && (await p.getByTestId('panel-store').count()) > 0) {
        done.storeUnsel = true;
        await expectInSafeAreaSoon(railButtons(p), '小卖部栏内按钮');
        const card = p
          .locator('.phone-rail [data-testid^="action-store-"]:not([disabled])')
          .first();
        if ((await card.count()) > 0) {
          done.storeSel = true;
          await card.dispatchEvent('click');
          await expectInSafeAreaSoon(railButtons(p), '小卖部选中后栏内按钮');
        }
      }

      // —— 开饭页：标题 Dinner time、4 盘一行、按钮不滚动可见 ——
      if (!done.feast && (await p.locator('[data-testid^="plate-"]').count()) === 4) {
        done.feast = true;
        await expect(
          p.locator('[data-testid="screen-feast"] .intro-title'),
        ).toHaveText('Dinner time');
        const plates = p.locator('.plate-card');
        await expect(plates).toHaveCount(4);
        const tops = await plates.evaluateAll((els) =>
          els.map((e) => e.getBoundingClientRect().top),
        );
        for (const t of tops)
          expect(Math.abs(t - tops[0]), '4 个盘子同一行').toBeLessThan(4);
        await expectInSafeAreaSoon(plates, '盘子卡');
        await expectInSafeAreaSoon(p.locator('.feast-actions .btn'), '开饭页按钮');
        await expect(
          p.locator('.plate-note').first(),
          '「Still missing after lap 3」小字不显示',
        ).toBeHidden();
      }

      // —— 感想页：6 个选项 + 标题一屏全显示，按钮 ≥48px ——
      if (!done.reflect && (await p.locator('.reflection-options').count()) > 0) {
        done.reflect = true;
        const opts = p.locator('.reflection-options .btn');
        await expect(opts, '5 个预设 + Write your own… 共 6 个选项').toHaveCount(6);
        await expectInSafeAreaSoon(opts, '感想选项');
        await expectInSafeAreaSoon(p.locator('.intro-title'), '感想页标题');
        for (const h of await opts.evaluateAll((els) =>
          els.map((e) => e.getBoundingClientRect().height),
        )) {
          expect(h, '感想按钮高度 ≥48px').toBeGreaterThanOrEqual(47);
        }
        await expect(
          p.locator('.reflection-options'),
          '「Write your own…」也在屏内',
        ).toContainText('Write your own');
      }
    },
  });

  expect(done.chrome, '出现过右竖栏横屏布局').toBe(true);
  expect(done.marketUnsel, '到过菜市场').toBe(true);
  expect(done.storeUnsel, '到过小卖部').toBe(true);
  expect(done.feast, '到过开饭页（4 盘一行、Dinner time）').toBe(true);
  expect(done.reflect, '到过感想页（6 选项一屏）').toBe(true);

  // —— M4.5.9c：感想结果页 ——
  // 4 张感想卡 2×2 全部完整可见；小字「Everyone has shared」；
  // 「Play again」≥48px 且不与任何感想卡重叠（马教授复验项：
  // 旧版 max-height:72px 把感想锁在小框里、按钮压到 Zip 那行上）。
  const reflectCards = page.locator('.reflection-card');
  await expect(reflectCards, '4 张感想卡片').toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    await expect(reflectCards.nth(i), `感想卡片 ${i} 可见`).toBeVisible();
  }
  await expectInSafeAreaSoon(reflectCards, '感想卡片');
  await expectInSafeAreaSoon(
    page.getByTestId('reflection-done'),
    '「Everyone has shared」小字',
  );

  const replay = page.getByTestId('action-replay');
  await expectInSafeAreaSoon(replay, 'Play again');
  const replayBox = await replay.boundingBox();
  expect(replayBox, 'Play again 有布局盒').not.toBeNull();
  expect(replayBox!.height, 'Play again 高 ≥48px').toBeGreaterThanOrEqual(47);

  const cardBoxes = await reflectCards.evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { t: r.top, r: r.right, b: r.bottom, l: r.left };
    }),
  );
  for (const [i, c] of cardBoxes.entries()) {
    const overlap =
      replayBox!.x < c.r - 1 &&
      replayBox!.x + replayBox!.width > c.l + 1 &&
      replayBox!.y < c.b - 1 &&
      replayBox!.y + replayBox!.height > c.t + 1;
    expect(overlap, `Play again 与感想卡片 ${i} 重叠`).toBe(false);
  }

  const w = await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0);
  expect(w, '无横向滚动').toBeLessThanOrEqual(VW);
  await assertClean(page, errors);
});
