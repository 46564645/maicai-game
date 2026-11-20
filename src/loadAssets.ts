/**
 * loadAssets.ts —— 首次打开缓冲页的「真进度」资源清单与加载器。
 *
 * 进度口径：total = 任务条数；每完成一条（真实网络/解析动作）算一格，
 * 没有任何定时器/假动画成分。条目：
 *   - 卡面插画（cardArt.ts 登记的全部透明 PNG + 牌背）→ new Image()
 *   - 3D 棋盘代码分包（SceneWarmup 入口，与 App 暖机同一 specifier）
 *   - 站点道具 + 棋子 GLB（Scene/StationProps/Piece 用到的整表）→ fetch
 *   - HDRI 环境图 → fetch（预测会开 env 反光才列，见 predictFlags）
 *   - 桌面高档后期链分包（predictFlags().post 才会被 Scene 渲染才列）
 * 走 2D 兜底的设备（?board=2d 或 WebGL 不可用）跳过全部 3D 条目。
 * GLB/HDR 只拉字节做进度与预热（HTTP 缓存命中留给场景内
 * GLTFLoader/RGBELoader 二次取用）；解析/着色器编译由 SceneWarmup
 * 实渲首帧时真正完成。
 */
import { predictFlags } from './board/three/QualityProvider';
import { boardMode, detectWebGL } from './board/three/webgl';
import { CARD_ART_URLS } from './components/cards/cardArt';

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

/** 本局会走 3D 棋盘吗（?board=2d 或无 WebGL → 2D，3D 资源不必预载） */
export function wants3DBoard(): boolean {
  return boardMode() !== '2d' && detectWebGL();
}

interface Task {
  id: string;
  run: () => Promise<unknown>;
}

export interface LoadResult {
  /** 失败条目 id（调试用；孩子侧只给统一英文提示） */
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
  const tasks: Task[] = CARD_ART_URLS.map((url) => ({
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

/**
 * 并发跑全部任务；每条落定（成/败）回报 (done,total)。
 * 不因单条失败中断——失败清单交给 boot 决定亮错误卡。
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
  return { failed };
}
