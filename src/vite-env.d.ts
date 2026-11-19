/// <reference types="vite/client" />

/** 构建时由 vite.config 的 define 注入的 commit 短号（拿不到时为 'dev'） */
declare const __BUILD_COMMIT__: string;
