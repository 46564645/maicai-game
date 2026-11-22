/**
 * loadAssets.ts —— 首次打开缓冲页的「真进度」资源清单与加载器。
 *
 * 进度口径：total = 闸门任务条数；每完成一条（真实网络/解析动作）算一格，
 * 没有任何定时器/假动画成分。条目：
 *   - 卡面插画「首局必见集」（CARD_ART_URLS_BOOT：天气+菜谱+食材/诱惑
 *     +牌背）→ new Image()；其余卡图（事件图，最早第 5 站才翻开）不进
 *     闸门，闸门跑完后由 startBackgroundCards 后台续载（性能优化轮
 *     杠杆 2）——进度与失败口径都只算闸门集，续载失败仅记日志，
 *     CardView 的 emoji 回退兜底
 *   - 3D 棋盘代码分包（SceneWarmup 入口，与 App 暖机同一 specifier）
 *   - 站点道具 + 棋子 GLB（Scene/StationProps/Piece 用到的整表）→ fetch
 *   - HDRI 环境图 → fetch（预测会开 env 反光才列，见 predictFlags）
 *   - 桌面高档后期链分包（predictFlags().post 才会被 Scene 渲染才列）
 * WebGL 探不到的设备跳过全部 3D 条目（棋盘侧显示错误卡，不走 2D）。
 * GLB/HDR 只拉字节做进度与预热（HTTP 缓存命中留给场景内
 * GLTFLoader/RGBELoader 二次取用）；解析/着色器编译由 SceneWarmup
 * 实渲首帧时真正完成。
 */
import { predictFlags } from './board/three/QualityProvider';
import { detectWebGL } from './board/three/webgl';
import { CARD_ART_URLS, CARD_ART_URLS_BOOT } from './components/cards/cardArt';

/** 后台续载集 = 全部卡图（CARD_ART_URLS）− 首局必见集（目前只有事件图） */
const bootArtSet = new Set<string>(CARD_ART_URLS_BOOT);
const LAZY_CARD_URLS: readonly string[] = CARD_ART_URLS.filter(
  (url) => !bootArtSet.has(url),
);

/** 站点道具 + 棋子 GLB 清单（与 Scene 树里的 useGLTF/Model 一一对应） */
const MODEL_FILES = [
  // Piece.tsx：4 枚棋子（按玩家色选模）
  'character-female-a.glb',
  'character-male-a.glb',
  'character-female-c.glb',
  'character-male-b.glb',
  // StationProps.tsx：市场/超市/玩具店/厨房摊位道具
  'display-fruit.glb',
  'display-bread.glb',
  'display-small.glb',
  'tomato.glb',
  'carrot.glb',
  'fish.glb',
  'cash-register.glb',
  'shopping-basket.glb',
  'popsicle.glb',
  'ice-cream.glb',
  'gacha-machine.glb',
  'shelf-boxes.glb',
  'cash-register-self.glb',
  'bag.glb',
  'pot.glb',
  'plate-dinner.glb',
  'cup.glb',
];

const ENV_URL = './env/spruit_sunrise_512.hdr';
const CONCURRENCY = 6;

/** 本局会走 3D 棋盘吗（棋盘永远走 3D；仅 WebGL 探不到时不预载 3D 资源，
 *  棋盘侧的失败呈现是错误卡 + Try again，见 BoardMount） */
export function wants3DBoard(): boolean {
  return detectWebGL();
}

interface Task {
  id: string;
  run: () => Promise<unknown>;
}

export interface LoadResult {
  /** 闸门集的失败条目 id（调试用；孩子侧只给统一英文提示）。
   *  后台续载的失败不进此清单（不亮错误卡，emoji 回退兜底） */
  failed: string[];
}

function loadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`image failed: ${url}`));
    img.src = url;
  });
}

async function fetchBytes(url: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`);
  await res.arrayBuffer(); // 真正收完字节才算一条（HTTP 缓存同步暖好）
}

function manifest(): Task[] {
  const tasks: Task[] = CARD_ART_URLS_BOOT.map((url) => ({
    id: `card:${url}`,
    run: () => loadImage(url),
  }));
  if (!wants3DBoard()) return tasks;

  const flags = predictFlags();
  tasks.push(
    {
      id: 'chunk:scene',
      // 与 App 暖机的 React.lazy 同 specifier——这里拉过分包，
      // 那边挂载即解，零二次等待
      run: () => import('./board/three/SceneWarmup'),
    },
    {
      id: 'chunk:board3d',
      // 正式棋盘的 lazy 入口（BoardMount）——同一批依赖图，
      // 入口文件本身也预拉
      run: () => import('./board/three/Board3D'),
    },
  );
  for (const f of MODEL_FILES) {
    const url = `./models/${f}`;
    tasks.push({ id: `glb:${f}`, run: () => fetchBytes(url) });
  }
  if (flags.env) tasks.push({ id: 'env:hdr', run: () => fetchBytes(ENV_URL) });
  if (flags.post) {
    tasks.push({
      id: 'chunk:fx',
      run: () => import('./board/three/Effects'),
    });
  }
  return tasks;
}

/* —— 后台续载（闸门外）：闸门集跑完后启动，把其余卡图（事件图）在
 * 首局进行中拉完。不回报进度、不进失败清单：单张失败仅记日志，
 * CardView 渲染时 <img> 会再试一次，再不行落 emoji 回退。模块级
 * started 标记保证 boot 的 Try again 重跑闸门时不重复启动续载
 * （已拉的图走 HTTP 缓存，本来也近乎零成本）。 */
let backgroundStarted = false;

function startBackgroundCards(): void {
  if (backgroundStarted || LAZY_CARD_URLS.length === 0) return;
  backgroundStarted = true;
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < LAZY_CARD_URLS.length) {
      const url = LAZY_CARD_URLS[cursor++];
      try {
        await loadImage(url);
      } catch (e) {
        console.warn('后台卡图续载失败（emoji 回退兜底）：', url, e);
      }
    }
  };
  void Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, LAZY_CARD_URLS.length) }, () => worker()),
  );
}

/**
 * 并发跑全部闸门任务；每条落定（成/败）回报 (done,total)。
 * 不因单条失败中断——失败清单交给 boot 决定亮错误卡。
 * 闸门集落定后顺带启动后台续载（不等待它完成）。
 */
export async function loadGameAssets(
  onProgress: (done: number, total: number) => void,
): Promise<LoadResult> {
  const tasks = manifest();
  const total = tasks.length;
  const failed: string[] = [];
  let done = 0;
  let cursor = 0;
  onProgress(0, total);
  const worker = async (): Promise<void> => {
    while (cursor < tasks.length) {
      const t = tasks[cursor++];
      try {
        await t.run();
      } catch (e) {
        failed.push(t.id);
        console.warn('资源加载失败：', t.id, e);
      }
      done += 1;
      onProgress(done, total);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => worker()),
  );
  startBackgroundCards();
  return { failed };
}
