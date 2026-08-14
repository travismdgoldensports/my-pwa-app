const { test, expect } = require('@playwright/test');

const mobileWidths = [320, 375, 430];

async function openBlackjack(page, width){
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(() => {
    let seed = 20260814;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
  });
  await page.goto('/');
  await page.evaluate(() => {
    document.querySelector('#splashOverlay').style.display = 'none';
    window.activateGame('blackjack');
    document.querySelector('#bjSurrenderRule').value = 'no';
    document.querySelector('#bjStartSession').click();
  });
  await expect(page.locator('#blackjackScreen')).toHaveClass(/session-started/);
  await page.addStyleTag({ content: `
    *, *::before, *::after {
      animation-delay: 0s !important;
      animation-duration: 0s !important;
      caret-color: transparent !important;
      transition-delay: 0s !important;
      transition-duration: 0s !important;
    }
  ` });
}

async function expectPlaySurface(page, name){
  const clip = await page.evaluate(() => {
    const table = document.querySelector('.bj-table');
    const actions = document.querySelector('.bj-play-actions');
    const top = table.getBoundingClientRect();
    const bottom = actions.getBoundingClientRect();
    return {
      x: Math.floor(Math.min(top.left, bottom.left)),
      y: Math.floor(top.top),
      width: Math.ceil(Math.max(top.right, bottom.right) - Math.min(top.left, bottom.left)),
      height: Math.ceil(bottom.bottom - top.top)
    };
  });
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    clip,
    maxDiffPixelRatio: 0.002
  });
}

async function showSplitFixture(page){
  await page.evaluate(() => {
    const hands = document.querySelector('#bjPlayerHands');
    const original = hands.querySelector('.bj-hand');
    if(!original) throw new Error('Expected an active Blackjack hand');

    const makeRailHand = (label, result) => {
      const hand = original.cloneNode(true);
      hand.className = 'bj-hand compact done';
      const number = hand.querySelector('.bj-hand-number');
      const status = hand.querySelector('.bj-hand-meta span:last-child');
      if(number) number.textContent = label;
      if(status) status.textContent = result;
      return hand;
    };

    const active = original.cloneNode(true);
    active.className = 'bj-hand active';
    const activeNumber = active.querySelector('.bj-hand-number');
    if(activeNumber) activeNumber.textContent = 'Hand 2';

    const leftRail = document.createElement('div');
    leftRail.className = 'bj-hand-rail left';
    leftRail.appendChild(makeRailHand('Hand 1', 'Stand'));

    const rightRail = document.createElement('div');
    rightRail.className = 'bj-hand-rail right';
    rightRail.appendChild(makeRailHand('Hand 3', 'Waiting'));

    hands.replaceChildren(leftRail, active, rightRail);
    hands.classList.add('has-split');
    document.querySelector('#bjConditionalActions').classList.add('has-actions');
    document.querySelector('#bjSplit').hidden = false;
  });
}

async function showActionPaletteFixture(page){
  await page.evaluate(() => {
    const actions = document.querySelector('#bjConditionalActions');
    const doubleButton = document.querySelector('#bjDouble');
    const split = document.querySelector('#bjSplit');
    const surrenderSlot = document.querySelector('#bjSurrenderSlot');
    const surrender = document.querySelector('#bjSurrender');
    actions.classList.add('has-actions', 'allows-surrender');
    doubleButton.hidden = false;
    doubleButton.disabled = false;
    split.hidden = false;
    split.disabled = false;
    surrenderSlot.hidden = false;
    surrender.hidden = false;
    surrender.disabled = false;
  });
}

for(const width of mobileWidths){
  test.describe(`${width}px Blackjack layout`, () => {
    test(`captures deal, active, split, and settlement states`, async ({ page }) => {
      await openBlackjack(page, width);
      await expectPlaySurface(page, `blackjack-${width}-deal.png`);

      await page.locator('#bjDeal').click();
      await expect(page.locator('#bjHit')).toBeVisible();
      await page.waitForTimeout(250);
      await expect(page.locator('#bjTableBetLabel')).toBeVisible();
      await expectPlaySurface(page, `blackjack-${width}-active.png`);

      await showSplitFixture(page);
      await expect(page.locator('#bjPlayerHands .bj-hand-rail')).toHaveCount(2);
      await expect(page.locator('#bjSplit')).toBeVisible();
      await expectPlaySurface(page, `blackjack-${width}-split.png`);

      if(width === 375){
        await showActionPaletteFixture(page);
        await expect(page.locator('#bjSurrender')).toBeVisible();
        await expectPlaySurface(page, 'blackjack-375-action-palette.png');
      }

      await page.evaluate(() => document.querySelector('#bjStand').click());
      await expect(page.locator('#bjDeal')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('#bjResultFlash')).toBeVisible();
      await expect(page.locator('#bjResultFlash')).toHaveText(/^(?:WIN \+\$|LOSS −\$|PUSH \$0)/);
      await expectPlaySurface(page, `blackjack-${width}-settlement.png`);
    });
  });
}
