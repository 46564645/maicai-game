/**
 * zh.ts —— 中文字典（R6），与 en.ts 同构（类型 StringsDict 强制对齐）。
 *
 * 译文来源（不生造，优先级从高到低）：
 *  [名] ww 定名表 03-reference-inputs/m45_en_names.txt（专有名词/常用按钮逐字）
 *  [需] docs/REQUIREMENTS.md（G1–G6 线框原文、§5.04、家长站四问原文）
 *  [图] Figma 流程原文 docs/figma/boardgame_flow_493-2.reference.tsx.txt
 *  [填] 无现成出处时由 PM 按同一口吻直译 —— 逐条列在 I18N_R6.md，
 *       等 ww / 业主校订。
 * 禁用词与英文版一致：不出现排名/分数/淘汰类字样。
 */
import type { StringsDict } from './types';

export const zhStrings: StringsDict = {
  title: '一起去买菜',

  board: {
    resetView: '回默认视角',
  },

  tagline: '和伙伴一起去买菜，最后一起做一桌饭',

  intro: {
    startButton: '开始',
    startHint: '点一下就出发！',
    todoHint: '完整玩法马上就来',
    statCards: {
      startCoins: { label: '每人起始', suffix: '币' },
      recipeTotal: { label: '每张菜谱总价', suffix: '币' },
      busFee: { label: '公交费', suffix: '币' },
      freeCoins: { label: '自由安排的钱', suffix: '币' },
    },
    demoOptions: [
      { keyHint: '1', label: '买下' },
      { keyHint: '2', label: '先等等' },
      { keyHint: '3', label: '跳过' },
    ],
  },

  buttons: {
    next: '下一步',
    ok: '好的',
    buy: '买下',
    hold: '先等等',
    skip: '跳过',
    done: '走完这一站',
    agree: '好呀',
    decline: '不用了',
    help: '求助牌',
    replay: '再玩一局',
  },

  hud: {
    lapLabel: '第 {lap} 圈',
    lapOf: '第 {lap} 圈 / 共 {laps} 圈',
    stationLabel: '第 {n} 站 · {name}',
    /* R2-6：市场站浮签站名定稿（stationName 通用名是「菜市场摊位」，浮签用「菜市场」） */
    marketTitle: '菜市场',
    orderLabel: '顺序：',
    wallet: '我的钱包',
    basket: '我的篮子',
    help: '求助牌',
    helpAnytime: '随时可举',
    holdClip: '先等等',
    busDebt: '待付夹',
    empty: '空',
    howTo: '玩法',
    settings: '设置',
    coin: '币',
    lapCompact: '第{lap}/{laps}圈',
    botChip: '{name}，{n} 币 — 点开看详情',
    walletWithCoins: '我的钱包，{n} 币',
    /* R10D：HUD 图形进度簇（圈点 + 站点格）与「下一位」的无障碍名 */
    progressLabel: '第 {lap} 圈，走到第 {n} 站',
    nextUp: '下一位',
    recipeStrip: '菜谱进度',
    /* R10E：角色高光卡（ProfileCard）状态点 / 底行标签 / 物件可点名 */
    spotlightActing: '在行动',
    spotlightWaiting: '等着',
    spotlightBasket: '看看篮子',
    spotlightCoins: '币',
    spotlightMissing: '还差 {n} 样',
    meCard: '我的卡',
    /* R10E：卡夹/代币物件的读屏名（图形只认形状，名字走 aria） */
    holdClipAria: '先等等夹：{item}',
    busDebtAria: '待付夹：{n} 币',
  },

  game: {
    townAlt: '买菜小镇',
    pawnAt: '在「{name}」',
    yourTurn: '轮到你了',
    botTurn: '轮到{name}了',
    thinking: '正在想…',
    enterStation: '进入这一站',
    enterStationKbd: '（Enter / 空格）',
    enterStationHint: '进入这一站（Enter / 空格）',
    myCoins: '我的钱：{n} 币',
    botCoins: '钱：{n} 币',
    bought: '已买',
    walletTitle: '钱包和菜谱',
    walletHint: '菜谱还差 {a} 币 · 车费 {b} 币 · 还能自由花 {c} 币',
    freeCoins: '还能自由花 {n} 币',
    debtLeft: '还欠车费：{n} 币',
  },

  screens: {
    chooseTitle: '选一个你喜欢的角色',
    chooseHint: '其他三个角色会变成你的小伙伴',
    basketTitle: '我的篮子',
    basketNext: '下一圈',
    others: '小伙伴的篮子',
    collected: '我买到的菜',
    extrasLabel: '赠品菜：',
    temptationsLabel: '小玩意：',
    progress: '进度 {a}/{b}',
    feastTitle: '一起开饭',
    feastNext: '说说你的决定',
    reflectionTitle: '说一个你最满意的决定',
    waitingBots: '等小伙伴说完…',
  },

  actions: {
    enter: '进入这一站',
    ok: '好的',
    drawRecipe: '抽一张菜谱卡',
    buy: '买下{item}（{n} 币）',
    hold: '{item}：先等等',
    holdBuy: '按原价买下{item}',
    holdDrop: '不买{item}了',
    endTurn: '走完这一站',
    swap: '拿我的{give}换{name}的{want}',
    yes: '好呀',
    no: '不用了',
    payBus: '投 {n} 币',
    busDebt: '先记在待付夹里',
    busFreeDone: '我已经有车票了',
    sayIt: '说出来',
    storeBuy: '买下{item}（{n} 币）',
    chooseChar: '选{name}',
    restart: '再玩一局',
    demoJump: '跳到某一站',
    demoPersonality: '换电脑性格',
    setFlag: '开关',
    close: '关闭',
    helpTitle: '小提示',
    helpMissing: '还缺：',
    helpCoins: '我的钱：{n} 币',
    helpDebt: '待付夹：{n} 币',
    helpCanDo: '你可以：',
    noRecipe: '还没有菜谱',
  },

  help: {
    title: '小提示',
    /* R6：求助牌里的类别记号图例标题 */
    iconLegend: '卡上的记号',
    gentleAdvice: '先买菜谱上的菜，再看小玩意。',
    stationTips: {
      drawTask: '记住菜谱上要买的菜。',
      market: '先看菜谱缺什么，再买。每次最多买 2 张卡。',
      partner: '把多出来的菜和小伙伴交换。不能送钱。',
      bus: '车费一开始就说过啦，不是惩罚。',
      event: '想一想：花 1 个币，还是等一等？',
      parent: '把币的用处说清楚，就能得到帮助。',
      store: '缺的菜这里都有，每样贵 1 币。',
      cook: '把你的菜放进盘子里。',
    },
  },

  bus: {
    announced: '车费一开始就说过啦，不是惩罚。',
    paidDebt: '先付了车费',
  },

  panel: {
    /* R2-6（ww 定稿）：卡扇下方唯一一句说明（原长句+教练句已撤） */
    stallIntro: '点一张卡，先买菜谱上的菜。',
    /* R10D：第 2 圈起说明收成短句；第 3 圈整句撤掉 */
    stallIntroShort: '点卡，再选怎么做',
    selected: '选中：{item} {n} 币',
    selectedMark: '选中：',
    afterBuy: '买完还剩 {n} 币',
    noCoins: '币不够了',
    buysLeft: '这次还能买 {n} 张',
    /* R2-10：已买卡的角标（不整张变灰） */
    boughtBadge: '已买',
    buyPriced: '买下（{n} 币）',
    skipCard: '跳过',
    endTurn: '走完这一站',
    holdClipLine: '你的先等等夹里：{item}（{n} 币）',
    holdBuyPrice: '按原价买下',
    holdDropBtn: '不要了',
    tagNeeded: '菜谱里有',
    tagIngredient: '食材',
    tagTemptation: '诱惑',
    /* R6：第一次进市场时提示条播一遍类别记号的意思（仅一次） */
    iconsIntro: '卡上的记号：绿勾 = 菜谱里有 · 胡萝卜 = 食材 · 星星 = 诱惑',
    /* R6：锁记号的读屏名（暂时拿不到的卡） */
    lockedLabel: '暂时拿不到',
    keyHelp: '←→ 选卡 · 1/2/3 选操作',
    lookTitle: '看一眼你的菜谱卡',
    recipeMissing: '还缺：{items}',
    recipeDone: '菜谱买齐啦！',
    busTicket: '车票',
    storeIntro: '缺的菜这里都有，每样比菜市场贵 1 币。',
    /* R10D：第 2 圈短句版 */
    storeIntroShort: '缺的菜这都有，贵 1 币',
    storeMissing: '菜谱还缺的',
    storeAll: '全部食材',
    storeHoldLine: '先等等夹：{item}（{n} 币）',
    cookPut: '把你的菜放进盘子',
    /* R10E：弹出时刻——菜谱卡点按提示 + 成品出锅提示 */
    pocketRecipe: '收进篮子',
    dishReady: '菜出锅啦！',
    coachLine: '先找菜谱里的菜：你还缺 {items}',
  },

  /* 后悔窗口（R10C）：钱/答案到账前的撤销片 */
  regret: {
    undo: '等等！收回{item}',
  },

  /* 金币条（新加坡条形图）：菜谱还差 / 车费 / 自由花 三段 */
  coinbar: {
    recipe: '菜谱还差',
    bus: '车费',
    free: '自由花',
    math: '{a} − {b} → {c}',
  },

  /* bot 心里话（R10C：贴着 bot 卡冒出的短理由气泡） */
  think: {
    steady: '先买菜谱里的菜',
    impulsiveHold: '好想要…先放先等等吧',
    impulsiveBuy: '好想要！就买它',
    follower: '我也要！',
    busDebt: '车费先记着，待会还',
    eventSpend: '惊喜要花币…想想再定',
  },

  bubble: {
    swapAsk: '「我的{give}换你的{want}，好吗？」',
    inviteAsk: '「{name}，一起来吗？」',
    note: '这里不能借钱，也不能送钱。',
    fromSuffix: ' · 伙伴站',
    /* 等真人回应提议时浮签卡的完整提议句（团队第 2 轮 ww 定稿）：
       写清谁想用哪件（give=对方的）换你的哪件（want=你的） */
    proposalSwap: '{name}想用{give}换你的{want}，换吗？',
    proposalInvite: '{name}想跟你一起买{item}，一起吗？',
    /* 浮签卡上的两个药丸按钮 */
    proposalYes: '好呀',
    proposalNo: '不用了',
  },

  speech: {
    speak: '朗读',
  },

  partner: {
    inviteCount: '{a}/{b}',
    inviteAvatars: '👦👧',
    inviteEach: '每人付 {n} 币',
    inviteDone: '一起买成功啦！',
    inviteMiss: '自己买也可以',
    myExtras: '我多出来的菜',
    noExtras: '还没有多出来的菜',
    theirExtras: '小伙伴多出来的菜',
    swapHint: '先点我多出来的菜，再点你想换的菜',
    swapPicked: '拿我的{give}换{name}的{want}',
    swapConfirm: '发出交换',
    noSwap: '不能借钱、不能送钱 — 只能交换多出来的菜',
  },

  event: {
    spinLabel: '天气转盘',
    spunTo: '是{name}！',
    choose: '你想怎么做？',
    deckHint: '点一下，翻开看看',
    /* R10D：花钱卡上的余款预告 + 打出后、弹窗关闭前的后果回声 */
    spendPreview: '花 {p} 币 · 还剩 {n} 币',
    echoSpendOk: '花了 {p} 币，买菜的钱还够',
    echoSpendGap: '注意：买菜还差 {n} 币了',
    echoFree: '1 个币也没花，留给后面的车费和买菜',
    /* R10E：天气/故事卡时刻——大卡下面的点按提示与故事卡收卡的无障碍名 */
    cardTap: '点一下，继续',
    storyDone: '看好了',
  },

  parent: {
    alreadyUsed: '这一局已经用过了',
    useNow: '现在用',
    useLater: '这次先不用',
    oncePerGame: '每人每局 1 次',
    questionOf: '问题 {a}/{b}',
    pickHint: '可以直接说，也可以点图选：',
    typePlaceholder: '写下你的回答',
    sendText: '说好了',
    /* R10D：语音钮改诚实「听一听问题」——朗读当前问题并指向图卡 */
    hearQ: '听一听问题',
    clearedMark: '✓ 说清楚了',
    settleGo: '继续回答',
    statusLive: '真对话',
    statusOffline: '离线脚本',
    ruleNote: '说清多少、做什么 → 得 1 币；再说清花到哪、下次怎么做 → 得 2 币',
    /* R10C：对话优先——家长形象名 + 示范对话 + 句首启口片 */
    parentName: 'AI 家长',
    echoLine: '{item} ✓ 说清楚了',
    demoTag: '示范',
    demoTip: '像这样说，就可以',
    demoSkip: '跳过示范',
    starters: ['我想买…', '我还差…', '下次我先…'],
  },

  feast: {
    title: '一起开饭',
    subtitle: '3 圈结束，没有人被淘汰，每个人都有一盘菜上桌',
    plateFull: '完整的菜',
    plateSimple: '简单的菜',
    plateShadow: '下次补上',
    noteFull: '买齐了',
    noteSimple: '差 {n} 样',
    noteShadow: '第 3 圈后还没买齐',
    ledgerBtn: '看看钱花到哪了',
    ledgerBack: '回到桌边',
    toReflection: '说说你的决定',
  },

  ledger: {
    title: '看看钱花到哪了',
    start: '开局 {n} 币',
    left: '还剩 {n} 币',
    debtLeft: '还欠 {n} 币车费',
    groupTotal: '一共 {n} 币',
    lapTag: '第 {n} 圈',
    groups: {
      ingredient: '菜',
      temptation: '诱惑品',
      bus: '车费',
      event: '意外',
      gain: '帮忙和好运',
    },
  },

  demo: {
    title: '演示控制',
    jumpTitle: '跳到某一站',
    lapShort: '第 {n} 圈',
    stationShort: '第 {n} 站',
    jump: '跳转',
    restart: '重新开始',
    fast: '快速模式',
    on: '开',
    off: '关',
    personalityTitle: '电脑性格',
    spendAll: '演示：花掉多余的币',
    spendAllHint: '在菜市场一直买到币不多，再去公交站（演示待付夹）',
    close: '收起演示条',
  },

  rotate: {
    hint: '把手机横过来',
  },

  reflection: {
    prompt: '说一个你最满意的决定',
    placeholder: '写一句话',
    writeOwn: '自己写…',
    waitingBots: '等小伙伴说完…',
    everyoneSaid: '大家都说完啦',
    /* R10C：选项按她今天真做到的事排前 + 小标，提示句引导挑真的那件 */
    personalHint: '挑一件你今天真做过的事说',
    didIt: '做到了',
    /* R10D：第 3 圈菜谱已买齐的孩子——问句换成向前看的一句 */
    forwardPrompt: '下次去买菜，你会先做哪一步？',
  },

  log: {
    drewRecipe: '{name}抽到了菜谱「{item}」',
    lookRecipe: '{name}看了一眼菜谱',
    bought: '{name}买了{item}',
    held: '{name}把{item}放进先等等夹',
    holdBought: '{name}按原价买下{item}',
    holdDropped: '{name}不要{item}了',
    busPaid: '{name}付了 {n} 币车费',
    busDebt: '{name}还差 {n} 币车费 — 记进待付夹',
    busFree: '{name}已经有车票了',
    debtPaid: '{name}先付了 {n} 币车费',
    eventCard: '{name}转到{weather}：「{item}」',
    eventChoice: '{name}：{item}',
    inviteCard: '邀请卡：{item}',
    inviteJoin: '{name}加入了一起买',
    invitePass: '{name}没有参加一起买',
    inviteDone: '一起买成功！大家都拿到了{item}',
    inviteFail: '人数不够 — 币退回来了',
    inviteRefund: '{name}拿回 {n} 币',
    swapDone: '{name}和{item}换了菜',
    swapNo: '{item}没有和{name}交换',
    parentVisit: '{name}去找家长聊了聊',
    parentSkip: '{name}这次先不用',
    parentUsed: '{name}这一局已经用过了',
    storeBought: '{name}在小卖部买了{item}',
    cooked: '{name}把菜放进了盘子',
    reflection: '{name}：{item}',
  },
};
