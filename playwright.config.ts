import { defineConfig } from '@playwright/test';

// e2e：先 build 再 preview；使用系统 Chrome（PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1）
// 无 GPU 环境下 Chrome ≥128 的软件 WebGL 需要 --enable-unsafe-swiftshader
// （旧写法 --use-gl=swiftshader 留作回退）；对 2D 用例无害。
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    // COPY-ONLY CHANGE (VM has no Google Chrome): use Playwright's bundled
    // Chromium (npx playwright install chromium) instead of channel 'chrome'.
    // channel: 'chrome',
    launchOptions: {
      args: [
        '--no-sandbox',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
