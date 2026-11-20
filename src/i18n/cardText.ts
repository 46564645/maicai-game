/**
 * cardText.ts —— R6 卡牌/配置显示文案解析器（UI 层，不改 cards.json 与 src/game）。
 *
 * cards.json 与 gameConfig 里的显示字段（卡名、事件正文、家长站问话、
 * 反思台词、站点名等）都带稳定 id；本模块按 id 提供当前语言的显示文本：
 * 英文模式逐字返回数据源原文，中文模式查下面的 zh 表（来源见 I18N_R6.md：
 * ww 定名表 / REQUIREMENTS / Figma 流程原文，无出处者为 PM 直译并已列明）。
 *
 * 注意：引擎在行动时写进 state.log / state.reflections 的文本大多按数据源
 * 原文生成、不经本模块（见 I18N_R6.md「已知边界」）；R9 起家长站三条
 * AI 台词（approveLine / fallbackLine / voiceHint）改经本模块
 * parentApproveLine / parentFallbackLine / parentVoiceHint 随语言走。
 */
import { cards } from '../data/cards';
import type {
  BotCard,
  EventCard,
  InviteCard,
  ParentOption,
  ParentQuestion,
} from '../data/cards';
import { gameConfig } from '../config/gameConfig';
import { getLang } from './store';
import { enStrings } from './en';
import { zhStrings } from './zh';

/* ================= 中文表（按 id） ================= */

/** 卡名（食材/菜谱/诱惑/天气/事件/邀请/角色/电脑伙伴） */
const zhCardName: Record<string, string> = {
  // 食材（ww 定名表）
  'ing-tomato': '番茄',
  'ing-egg': '鸡蛋',
  'ing-scallion': '葱',
  'ing-greens': '青菜',
  'ing-cucumber': '黄瓜',
  'ing-potato': '土豆',
  'ing-carrot': '胡萝卜',
  'ing-tofu': '豆腐',
  'ing-mushroom': '蘑菇',
  'ing-pork': '猪肉',
  'ing-fish': '鱼',
  'ing-ginger': '姜',
  'ing-garlic': '蒜',
  // 菜谱（ww 定名表）
  'rec-tomato-egg': '番茄炒蛋',
  'rec-tomato-egg-2': '番茄炒蛋',
  'rec-veggie-stirfry': '清炒时蔬',
  'rec-potato-pork': '土豆烧肉',
  'rec-tofu-soup': '青菜豆腐汤',
  'rec-braised-fish': '红烧鱼',
  // 诱惑品（ww 定名表）
  'tmp-sticker': '贴纸',
  'tmp-marshmallow': '棉花糖',
  'tmp-popsicle': '冰棍',
  'tmp-toy': '玩具',
  // 天气（ww 定名表）
  'wth-sunny': '晴天',
  'wth-rainy': '下雨',
  'wth-windy': '刮风',
  // 角色（ww 定名表）
  'chr-xiaohe': '小禾',
  'chr-xiaoan': '小安',
  'chr-ale': '阿乐',
  'chr-doudou': '豆豆',
  // 电脑伙伴（ww 定名表）
  'bot-xiaowen': '小稳',
  'bot-xiaochong': '小冲',
  'bot-xiaogen': '小跟',
  // 邀请卡（ww 定名表）
  'inv-popsicle': '一起买冰棍',
  'inv-sticker': '一起买贴纸',
  // 事件卡名（PM 直译，见 I18N_R6.md）
  'evt-neighbor-greens': '邻居奶奶送青菜',
  'evt-help-vendor': '在摊位帮忙',
  'evt-extra-egg': '多送一个鸡蛋',
  'evt-thirsty': '衣服湿了',
  'evt-bag-broken': '袋子破了',
  'evt-rain-umbrella': '大雨',
  'evt-muddy-shoes': '鞋子脏了',
  'evt-windy-hat': '帽子被风吹走',
  'evt-hungry': '肚子咕咕叫',
};

/** 事件卡正文与两个选项（PM 直译，见 I18N_R6.md） */
const zhEvent: Record<string, { text: string; spend: string; free: string }> = {
  'evt-neighbor-greens': {
    text: '隔壁的奶奶认识你，送你一些青菜。',
    spend: '花 1 币给奶奶买冰棍',
    free: '收下青菜，说声谢谢',
  },
  'evt-help-vendor': {
    text: '菜市场很忙。摊主掉了几个袋子，你帮忙捡起来。他送你一根葱。',
    spend: '收下葱，再花 1 币买青菜',
    free: '收下葱，挥手道谢',
  },
  'evt-extra-egg': {
    text: '太阳快落山了。摊主多送你一个鸡蛋。',
    spend: '花 1 币买碗热汤',
    free: '收下鸡蛋，说声再见',
  },
  'evt-thirsty': {
    text: '雨淋在你身上。衣服湿了，有点冷。',
    spend: '花 1 币买杯热饮',
    free: '快跑几步暖和起来',
  },
  'evt-bag-broken': {
    text: '刮起大风。你的袋子破了个洞。',
    spend: '花 1 币买个新袋子',
    free: '把菜抱在怀里',
  },
  'evt-rain-umbrella': {
    text: '雨越下越大。你的衣服要湿了。',
    spend: '花 2 币买把伞',
    free: '在屋檐下等雨停',
  },
  'evt-muddy-shoes': {
    text: '一个水坑把你的鞋弄脏了。',
    spend: '花 1 币买纸巾擦一擦',
    free: '回家再洗',
  },
  'evt-windy-hat': {
    text: '风把你的帽子吹到了树上。',
    spend: '花 1 币请人帮忙',
    free: '等风把帽子摇下来',
  },
  'evt-hungry': {
    text: '你走了好远的路。肚子咕咕叫了。',
    spend: '花 1 币买个包子',
    free: '再等等，回家就有饭吃了',
  },
};

/** 邀请卡正文/分钱说明（PM 直译） */
const zhInvite: Record<string, { text: string; splitNote: string }> = {
  'inv-popsicle': { text: '2 个小伙伴一起买冰棍 — 每人 1 币', splitNote: '一起买，每人各付各的' },
  'inv-sticker': { text: '2 个小伙伴一起买贴纸 — 每人 2 币', splitNote: '一起买，每人各付各的' },
};

/** 电脑伙伴性格名（ww 定名表） */
const zhPersonality: Record<string, string> = {
  'bot-xiaowen': '稳妥型',
  'bot-xiaochong': '冲动型',
  'bot-xiaogen': '跟风型',
};

/** 家长站（问题原文 = REQUIREMENTS §5.06/G5；其余 PM 直译，注明于 I18N_R6.md） */
const zhParent = {
  intro: '需要更多币的时候，我可以帮忙。',
  voiceHint: '语音还没准备好 — 点一张图卡吧。',
  settleLabel: '就这样吧（得 1 币）',
  approveLine: '好，说清楚了，给你 {n} 个币。',
  fallbackLine: '没关系。我们一起选一张图卡。',
  questions: {
    'pq-1': '你想要几个币？',
    'pq-2': '这些钱想买什么？',
    'pq-3': '刚才的钱用在哪里了？',
    'pq-4': '下次去买菜想怎么安排？',
  } as Record<string, string>,
  options: {
    'pq1-opt-1': '1 个币',
    'pq1-opt-2': '2 个币',
    'pq1-opt-3': '还不知道',
    'pq2-opt-1': '菜谱上的菜',
    'pq2-opt-2': '贴纸或小零食',
    'pq2-opt-3': '付车费',
    'pq2-opt-4': '还不确定',
    'pq3-opt-1': '我买了菜',
    'pq3-opt-2': '我买了贴纸或零食',
    'pq3-opt-3': '我付了车费',
    'pq3-opt-4': '我和小伙伴一起买了东西',
    'pq4-opt-1': '先买菜，再买贴纸',
    'pq4-opt-2': '先列个小清单',
    'pq4-opt-3': '留一些币备用',
    'pq4-opt-4': '还不确定',
  } as Record<string, string>,
};

/** 反思页（prompt = ww 定名表；台词/选项 PM 直译） */
const zhReflections = {
  prompt: '说一个你最满意的决定',
  botLines: {
    'rfl-steady-1': '我先买了菜谱上的菜。我的币刚刚好。',
    'rfl-steady-2': '我没有买贴纸。菜都买齐啦！',
    'rfl-imp-1': '我买了贴纸，很开心。下次我先买菜。',
    'rfl-imp-2': '我的币用完了，就请家长帮忙。',
    'rfl-fol-1': '我和小伙伴一起买菜，还换到了需要的菜。',
    'rfl-fol-2': '我们一起买了冰棍。每人只要 1 币！',
  } as Record<string, string>,
  humanOptions: {
    'rho-1': '我买齐了菜谱上的菜',
    'rho-2': '我没有买贴纸',
    'rho-3': '我换到了需要的菜',
    'rho-4': '我先付了车费',
    'rho-5': '我把计划告诉了家长',
    'rho-6': '自己写…',
  } as Record<string, string>,
};

/** 站点名（ww 定名表）与学习目标（Figma 流程原文「练 · …」） */
const zhStations: Record<string, { name: string; goal: string }> = {
  drawTask: { name: '抽任务卡', goal: '练 · 记住目标' },
  market: { name: '菜市场摊位', goal: '练 · 觉察消费冲动' },
  partner: { name: '伙伴站', goal: '练 · 交换与分享信息' },
  bus: { name: '公交站', goal: '练 · 区分必要与可选' },
  event: { name: '随机事件站', goal: '练 · 为不确定留余地' },
  parent: { name: 'AI 家长站', goal: '练 · 表达需求与反思' },
  store: { name: '小卖部补买', goal: '练 · 体验计划不周的代价' },
  cook: { name: '回家一起做饭', goal: '练 · 看见自己决定的结果' },
};

/**
 * 求助牌「你可以：」的动作短句：引擎 selectors.CMD_LABELS 是写死英文
 * （src/game 不可改），这里在 UI 层按英文原文整句映射（PM 直译）。
 */
const zhCanDo: Record<string, string> = {
  'Start the game': '开始游戏',
  'Pick a character': '选角色',
  Next: '下一步',
  'Draw a recipe card': '抽一张菜谱卡',
  'Buy a card': '买一张卡',
  'Put in "maybe later"': '放进先等等夹',
  'Done with this stop': '走完这一站',
  'Trade food with a friend': '和小伙伴换菜',
  'Answer a trade': '回应交换',
  'Answer a buy-together': '回应一起买',
  'Pay the bus fare': '付车费',
  'Pick what to do': '选怎么做',
  'Talk to your parent': '和家长聊聊',
  'Not this time': '这次先不用',
  'Answer a question': '回答问题',
  "That's all": '就这样',
  'Buy one ingredient': '买一样食材',
  'Handle "maybe later"': '处理先等等夹',
  'Tell us one choice': '说一个决定',
  'Play again': '再玩一局',
  Hint: '求助牌',
  'Jump to a stop': '跳到某一站',
  'Change bot style': '换电脑性格',
  Toggle: '开关',
};

/* ================= 解析器（英文 = 数据源原文） ================= */

const zh = () => getLang() === 'zh';

const anyCardById = new Map<string, { name: string }>();
for (const c of [
  ...cards.ingredients,
  ...cards.recipes,
  ...cards.temptations,
  ...cards.weather,
  ...cards.events,
  ...cards.invites,
  ...cards.characters,
  ...cards.bots,
]) {
  anyCardById.set(c.id, c);
}

/** 按卡 id 取显示名（食材/菜谱/诱惑/天气/事件/邀请/角色/伙伴通用） */
export function cardName(id: string): string {
  if (zh() && zhCardName[id]) return zhCardName[id];
  return anyCardById.get(id)?.name ?? id;
}

/** 玩家显示名：按 characterId（角色卡/电脑卡 id）解析，回退引擎名 */
export function playerDisplayName(p: {
  characterId: string | null;
  name: string;
}): string {
  if (p.characterId && anyCardById.has(p.characterId)) return cardName(p.characterId);
  return p.name;
}

/** 卡名列表拼接（R2-7）：英文用 ", "、中文用 "、"——英文语境不得出现中文顿号 */
export function joinCardNames(ids: readonly string[]): string {
  return ids.map((id) => cardName(id)).join(zh() ? '、' : ', ');
}

/* ================= 引擎日志条目的显示本地化（R2-7） =================
 * state.log 的 text 是引擎在行动时烘焙的整句：模板按当时语言取，
 * 但 {name}/{item}/{weather} 槽位一律填数据源原文名（英文，如
 * p.name="Sprout"、cardName="Fish"），于是中文界面出现
 * 「Sprout买了Fish」这类夹生提示条。引擎不可改，这里在显示层按
 * 模板反解槽位：把槽位里的原文名反查卡 id、换成当前语言显示名，
 * 再用当前语言的同键模板重渲染。匹配不上任何日志模板的条目
 * （家长台词、自由文本等）原样返回。 */

type LogDict = typeof enStrings.log;
const enLog: LogDict = enStrings.log;
const zhLog: LogDict = zhStrings.log as unknown as LogDict;

/** 数据源原文名 → 卡 id（角色/伙伴名也在卡表里，一并覆盖） */
const sourceNameToId = new Map<string, string>();
for (const [id, c] of anyCardById) {
  if (!sourceNameToId.has(c.name)) sourceNameToId.set(c.name, id);
}

function localizeSlotValue(v: string): string {
  const id = sourceNameToId.get(v);
  return id ? cardName(id) : v;
}

type LogSlot = 'name' | 'item' | 'weather' | 'n';
interface LogMatcher {
  key: keyof LogDict;
  slots: LogSlot[];
  re: RegExp;
  literalLen: number;
}

function templateToMatcher(key: keyof LogDict, tpl: string): LogMatcher {
  const slots: LogSlot[] = [];
  let pattern = '^';
  tpl.split(/\{(name|item|weather|n)\}/g).forEach((part, i) => {
    if (i % 2 === 1) {
      slots.push(part as LogSlot);
      pattern += '([\\s\\S]+?)';
    } else {
      /* 字面段转义；另容忍引擎 fmt 的单数化（"{n} coins" 写成 "1 coin"） */
      pattern += part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/coins/g, 'coins?');
    }
  });
  pattern += '$';
  return {
    key,
    slots,
    re: new RegExp(pattern),
    literalLen: tpl.replace(/\{(name|item|weather|n)\}/g, '').length,
  };
}

/* 两套字典的全部日志模板都编成匹配器，按字面长度降序试匹配——
   先匹配更具体的模板（如 holdBought 先于 bought），避免被短模板截胡 */
const logMatchers: LogMatcher[] = (Object.keys(enLog) as (keyof LogDict)[])
  .flatMap((key) => [
    templateToMatcher(key, enLog[key]),
    templateToMatcher(key, zhLog[key]),
  ])
  .sort((a, b) => b.literalLen - a.literalLen);

function renderLogTemplate(tpl: string, values: Partial<Record<LogSlot, string>>): string {
  const out = tpl.replace(/\{(name|item|weather|n)\}/g, (_, k: string) => values[k as LogSlot] ?? '');
  /* 与引擎 fmt 一致：英文 1 币写单数 */
  return out.replace(/\b1 coins\b/g, '1 coin');
}

/** 把一条引擎日志文本按当前语言重渲染（名字/物品/天气换当前语言显示名） */
export function localizeLogText(text: string): string {
  for (const m of logMatchers) {
    const hit = m.re.exec(text);
    if (!hit) continue;
    const values: Partial<Record<LogSlot, string>> = {};
    m.slots.forEach((slot, i) => {
      const raw = hit[i + 1];
      values[slot] = slot === 'n' ? raw : localizeSlotValue(raw);
    });
    return renderLogTemplate(zh() ? zhLog[m.key] : enLog[m.key], values);
  }
  return text;
}

export function botPersonalityLabel(bot: BotCard): string {
  if (zh() && zhPersonality[bot.id]) return zhPersonality[bot.id];
  return bot.personalityLabel;
}

export function eventText(card: EventCard): string {
  return zh() && zhEvent[card.id] ? zhEvent[card.id].text : card.text;
}
export function eventSpendLabel(card: EventCard): string {
  return zh() && zhEvent[card.id] ? zhEvent[card.id].spend : card.spendOption.label;
}
export function eventFreeLabel(card: EventCard): string {
  return zh() && zhEvent[card.id] ? zhEvent[card.id].free : card.freeOption.label;
}

export function inviteText(card: InviteCard): string {
  return zh() && zhInvite[card.id] ? zhInvite[card.id].text : card.text;
}
export function inviteSplitNote(card: InviteCard): string {
  return zh() && zhInvite[card.id] ? zhInvite[card.id].splitNote : card.splitNote;
}
/** R6 邀请卡面短签（ww 必改）：卡面只留分摊说明的第一段
 *  （EN "Buy together" / 中文「一起买」），完整规则（everyone pays
 *  their own）移进点开后的邀请台说明行（PartnerPanel 邀请台）。
 *  从数据原文切分，不新造文案 */
export function inviteFaceTag(card: InviteCard): string {
  return inviteSplitNote(card).split(/ — |，/)[0].trim();
}

export function parentIntro(): string {
  return zh() ? zhParent.intro : cards.parentStation.intro;
}
export function parentVoiceHint(): string {
  return zh() ? zhParent.voiceHint : cards.parentStation.voiceHint;
}
export function parentSettleLabel(): string {
  return zh() ? zhParent.settleLabel : cards.parentStation.settleLabel;
}
/** R9：以下两条也被引擎（stations/parent.ts）写进 state.log 的 AI 台词使用 */
export function parentApproveLine(): string {
  return zh() ? zhParent.approveLine : cards.parentStation.approveLine;
}
export function parentFallbackLine(): string {
  return zh() ? zhParent.fallbackLine : cards.parentStation.fallbackLine;
}
export function parentQuestionText(q: ParentQuestion): string {
  return zh() && zhParent.questions[q.id] ? zhParent.questions[q.id] : q.text;
}
export function parentOptionLabel(o: ParentOption): string {
  return zh() && zhParent.options[o.id] ? zhParent.options[o.id] : o.label;
}

export function reflectionPrompt(): string {
  return zh() ? zhReflections.prompt : cards.reflections.prompt;
}
export function reflectionOptionLabel(id: string, fallback: string): string {
  return zh() && zhReflections.humanOptions[id] ? zhReflections.humanOptions[id] : fallback;
}
export function reflectionLineText(id: string, fallback: string): string {
  return zh() && zhReflections.botLines[id] ? zhReflections.botLines[id] : fallback;
}
/**
 * 反思列表一条的显示文本：state.reflections 存了 optionId + 引擎原文。
 * 预设选项/电脑台词按 id 重新解析；自写项（rho-6 带 freeText）保留原文。
 */
export function reflectionEntryText(r: { optionId: string; text: string }): string {
  if (r.optionId === 'rho-6') return r.text;
  const opt = cards.reflections.humanOptions.find((o) => o.id === r.optionId);
  if (opt) return reflectionOptionLabel(opt.id, opt.label);
  return reflectionLineText(r.optionId, r.text);
}

export function stationName(id: string): string {
  if (zh() && zhStations[id]) return zhStations[id].name;
  return gameConfig.stations.find((s) => s.id === id)?.name ?? id;
}
export function stationGoal(id: string): string {
  if (zh() && zhStations[id]) return zhStations[id].goal;
  return gameConfig.stations.find((s) => s.id === id)?.goal ?? '';
}

/** 求助牌动作短句（引擎英文原文 → 当前语言） */
export function canDoLabel(englishLabel: string): string {
  return zh() && zhCanDo[englishLabel] ? zhCanDo[englishLabel] : englishLabel;
}
