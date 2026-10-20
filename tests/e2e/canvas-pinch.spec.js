import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

test.use({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });

test('pinça amplia o canvas sem mudar de card nem alterar a exportação', async ({ page, context }) => {
  await mockApi(page, { session:SESSAO_ATIVA });
  await page.addInitScript(() => {
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('pinch'));
    localStorage.setItem('vc_library', JSON.stringify([{ id:'pinch', name:'Teste de gesto', doc:{
      slides:[1, 2].map(i => ({ id:`pinch-${i}`, title:`Título ${i}`, subtitle:'Texto de apoio' })),
    } }]));
  });
  await page.goto('/?app=1');
  const zoom = page.getByLabel('Zoom da área de trabalho');
  await expect(zoom).toHaveText('100%');
  const exportSurface = page.locator('[data-vc-export-tree] [data-vc-card-surface="pinch-1"]');
  const originalExport = await exportSurface.boundingBox();
  const board = await page.locator('#vc-cards-viewport').boundingBox();
  const x = board.x + board.width / 2;
  const y = board.y + 120;
  const cdp = await context.newCDPSession(page);
  const points = gap => [{ id:0, x:x-gap, y }, { id:1, x:x+gap, y }];
  await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:points(30) });
  for (const gap of [35, 45, 55, 65]) {
    await cdp.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:points(gap) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await expect.poll(async () => Number((await zoom.innerText()).replace('%', ''))).toBeGreaterThan(150);
  await expect(page.getByLabel('Ir para o card')).toHaveValue('0');
  expect((await exportSurface.boundingBox()).width).toBe(originalExport.width);
});
