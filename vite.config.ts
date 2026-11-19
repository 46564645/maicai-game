import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/* 本仓库未装 @types/node，vite.config 又在 tsc 检查范围内——
   只声明用到的 env 一口，避免为构建戳引入新依赖/node 类型 */
declare const process: { env: Record<string, string | undefined> };

/* 构建戳（ww 网页审核口径）：commit 号在构建时从构建环境注入，
   显示在开始页角落，团队对着网页验收时能核对版本。构建环境
   给 BUILD_COMMIT / VITE_BUILD_COMMIT 就用它，拿不到显示 'dev' */
function buildCommit(): string {
  const fromEnv = process.env.BUILD_COMMIT ?? process.env.VITE_BUILD_COMMIT;
  return fromEnv && fromEnv.trim() ? fromEnv.trim() : 'dev';
}

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(buildCommit()),
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
