/**
 * en.ts —— 英文字典（R6 中英文切换的源字典）。
 * 内容与 M4.5.8 全英文化后的 strings.ts 逐字一致（ww 定名见
 * 03-reference-inputs/m45_en_names.txt）；英文模式下渲染结果必须与
 * R5 及之前版本逐字相同。中文字典 zh.ts 与此同构。
 */

export const enStrings = {
  title: "Let's Go Shopping",

  /* 棋盘浮层（Board3D 的「回默认视角」钮，R6 前是组件内硬编码） */
  board: {
    resetView: 'Reset view',
  },
  /* 开场（消息减负审计 A4/A6：tagline 与 startHint 已删——开场只剩
     标题 + 开始钮，玩法说明统一进新手指南） */
  intro: {
    startButton: 'Start',
    todoHint: 'Full play comes later',
    statCards: {
      startCoins: { label: 'Coins you start with', suffix: 'coins' },
      recipeTotal: { label: 'Your dish costs', suffix: 'coins' },
      busFee: { label: 'The bus costs', suffix: 'coins' },
      freeCoins: { label: 'Yours to choose', suffix: 'coins' },
    },
    /* 带数字键提示的次按钮样式示范（G2 线框三个操作；M1 纯展示无逻辑） */
    demoOptions: [
      { keyHint: '1', label: 'Buy' },
      { keyHint: '2', label: 'Maybe later' },
      { keyHint: '3', label: 'Skip' },
    ],
  },

  /* 通用按钮 */
  buttons: {
    next: 'Next',
    ok: 'OK',
    buy: 'Buy',
    hold: 'Maybe later',
    skip: 'Skip',
    done: 'All done',
    agree: 'Yes',
    decline: 'No thanks',
    help: 'Hint',
    replay: 'Play again',
  },

  /* 常驻元素 */
  hud: {
    /* lapLabel 已删（审计 B3：状态行删除后无引用） */
    lapOf: 'Lap {lap} of {laps}',
    /* stationLabel 已删（审计 B3） */
    /* R2-6：市场站浮签站名定稿（与 stationName 的通用名分开，只用于浮签） */
    marketTitle: 'The Market',
    orderLabel: 'Order: ',
    wallet: 'My wallet',
    basket: 'My basket',
    holdClip: 'Maybe later',
    busDebt: 'To pay later',
    empty: 'empty',
    coin: 'coins',
    /* lapCompact 已删（审计 B5） */
    botChip: '{name}, {n} coins — tap for details',
    walletWithCoins: 'My wallet, {n} coins',
    /* R10D: a11y names for the pictorial progress cluster + "next up" */
    progressLabel: 'Lap {lap}, at stop {n}',
    nextUp: 'Next up',
    recipeStrip: 'Recipe progress',
    /* R10E: ProfileCard spotlight — status dot / footer label / object names */
    spotlightActing: 'On a turn',
    spotlightWaiting: 'Waiting',
    spotlightBasket: 'See my basket',
    spotlightCoins: 'coins',
    spotlightMissing: '{n} to go',
    meCard: 'My card',
    /* R10E: object-name aria labels for the clip tokens (icons only) */
    holdClipAria: 'Maybe later clip: {item}',
    busDebtAria: 'To pay later: {n} coins',
  },

  /* 棋盘与游戏主界面 */
  game: {
    /* townAlt 已删（审计 B2）；botTurn 已删（审计 B3） */
    pawnAt: 'at "{name}"',
    yourTurn: 'Your turn',
    thinking: 'Thinking…',
    enterStation: 'Go to this stop',
    /* enterStationKbd 已删（审计 C6） */
    enterStationHint: 'Go to this stop (Enter / Space)',
    myCoins: 'My coins: {n}',
    botCoins: 'Coins: {n}',
    bought: 'Got',
    walletTitle: 'Wallet & recipe',
    /* walletHint 已删（审计 E5） */
    freeCoins: '{n} coins free to use',
    debtLeft: 'Bus fare still owed: {n}',
  },

  /* 屏幕 */
  screens: {
    chooseTitle: 'Pick a character you like',
    basketTitle: 'My basket',
    basketNext: 'Next lap',
    others: "Friends' baskets",
    collected: 'Food I got',
    extrasLabel: 'Extra food: ',
    temptationsLabel: 'Fun stuff: ',
    progress: 'Got {a} of {b}',
    feastTitle: 'Dinner time',
    feastNext: 'Tell us a choice',
    reflectionTitle: 'Tell us one choice you feel good about',
    waitingBots: 'Waiting for friends…',
  },

  /* AutoPanel 按钮文案（{item}/{name}/{n}/{give}/{want} 为占位符） */
  actions: {
    enter: 'Go to this stop',
    ok: 'OK',
    drawRecipe: 'Draw a card',
    buy: 'Buy {item}',
    hold: '{item}: maybe later',
    holdBuy: 'Buy {item}',
    holdDrop: 'Skip {item}',
    endTurn: 'All done',
    swap: 'Trade my {give} for {name}\'s {want}',
    yes: 'Yes',
    no: 'No thanks',
    payBus: 'Pay {n} coins',
    busDebt: 'Pay later',
    busFreeDone: 'Got my ticket',
    sayIt: 'Say it',
    storeBuy: 'Buy {item}',
    chooseChar: 'Pick {name}',
    restart: 'Play again',
    demoJump: 'Jump to a stop',
    demoPersonality: 'Change bot style',
    setFlag: 'Toggle',
    close: 'Close',
    noRecipe: 'No recipe yet',
  },

  /* 求助牌（HelpCard 已被新手指南取代并删除，审计 §4；title 仍供
     describeCommand 的 TOGGLE_HELP 描述用，stationTips/gentleAdvice
     仍供引擎 helpHints 用——三者保留；图例标题随卡删除） */
  help: {
    title: 'Little hint',
    gentleAdvice: 'Buy your recipe food first. Then look at fun stuff.',
    /* 各站一句话提示（helpHints 用） */
    stationTips: {
      drawTask: 'Remember the food on your recipe.',
      market: 'Check what your recipe needs, then buy. At most 2 cards each visit.',
      partner: 'Trade extra food with friends. No giving coins.',
      bus: 'We knew the fare at the start. It is not a punishment.',
      event: 'Think: spend a coin, or wait?',
      parent: 'Say clearly what the coins are for. Then you get help.',
      store: 'Missing food is here. Each one costs 1 more coin.',
      cook: 'Put your food on the plate.',
    },
  },

  /* 新手指南（消息减负审计 §4：开局弹一次 + 右上角重开，共 4 页；
     每页一个大视觉 + 最多一句短句；步点不带文字标签） */
  guide: {
    open: 'Guide',
    title: 'Guide',
    back: 'Back',
    next: 'Next',
    done: "Let's go",
    jobTitle: 'Your job',
    jobLine: 'Follow your recipe and buy all its food.',
    buyTitle: 'Tap and buy',
    buyLine: 'Tap a card, then tap Buy.',
    coinsTitle: 'Watch coins',
    coinsLine: 'The bar does the math; clips can help.',
    marksTitle: 'Card marks',
    marksLine: 'Marks tell you what each card is.',
  },

  /* 公交站 */
  bus: {
    /* announced 已删（审计 D4） */
    paidDebt: 'Paid the bus fare first',
  },

  /* 站点面板（M3.2 正式面板） */
  panel: {
    /* R2-6（ww 定稿）：卡扇下方唯一一句说明（原长句+教练句已撤） */
    /* stallIntro 已删（审计 C7） */
    /* R10D: lap-2 short form; the line is gone entirely on lap 3 */
    stallIntroShort: 'Tap a card, then pick',
    selected: 'Picked: {item} {n} coins',
    selectedMark: 'Picked: ',
    afterBuy: 'After you buy: {n} coins',
    noCoins: 'Not enough coins',
    buysLeft: 'You can buy {n} more this visit',
    /* R2-10：已买卡的角标（不整张变灰） */
    boughtBadge: 'Bought',
    buyPriced: 'Buy ({n} coins)',
    skipCard: 'Skip',
    endTurn: 'All done',
    holdClipLine: 'In your "maybe later" clip: {item} ({n} coins)',
    holdBuyPrice: 'Buy it',
    holdDropBtn: 'Let it go',
    tagNeeded: 'On my list',
    tagIngredient: 'Food',
    tagTemptation: 'Fun stuff',
    /* R6：第一次进市场时提示条播一遍类别记号的意思（仅一次） */
    /* iconsIntro 已删（审计 B10：记号图例迁入指南第 4 页） */
    /* R6：锁记号的读屏名（暂时拿不到的卡） */
    lockedLabel: "Can't get this yet",
    /* keyHelp 已删（审计 C5）；lookTitle 已删（审计 D7） */
    recipeMissing: 'Still need: {items}',
    recipeDone: 'Your recipe is all set!',
    busTicket: 'Bus ticket',
    storeIntro: 'Missing food is all here. Each costs 1 more coin than the market.',
    /* R10D: lap-2 short form */
    storeIntroShort: 'Missing food is here — 1 coin more each',
    storeMissing: 'Recipe still needs',
    storeAll: 'All food',
    storeHoldLine: '"Maybe later" clip: {item} ({n} coins)',
    /* cookPut 已删（审计 D13） */
    /* R10E: pop moments — recipe card tap aria + dish pop hint */
    pocketRecipe: 'Pocket it',
    dishReady: 'Fresh out of the pot!',
    coachLine: 'Find recipe food first — you still need {items}',
  },

  /* 后悔窗口（R10C）：钱/答案到账前的撤销片 */
  regret: {
    undo: 'Wait! Take back {item}',
  },

  /* 金币条（新加坡条形图）：菜谱还差 / 车费 / 自由花 三段 */
  coinbar: {
    recipe: 'for recipe',
    bus: 'bus fare',
    free: 'free to spend',
    math: '{a} − {b} → {c}',
  },

  /* bot 心里话字符串已删（消息减负审计 B11：气泡与 botThink 一并退役） */

  /* bot 提议气泡（G4） */
  bubble: {
    swapAsk: '"My {give} for your {want}?"',
    inviteAsk: '"{name} — want to join?"',
    /* note 已删（审计 C3） */
    fromSuffix: ' · Friends Stop',
    /* 等真人回应提议时浮签卡的完整提议句（团队第 2 轮 ww 定稿）：
       写清谁想用哪件（give=对方的）换你的哪件（want=你的） */
    proposalSwap: '{name} wants your {want} for its {give}. Yes or No?',
    proposalInvite: '{name} wants to buy {item} together. Yes or No?',
    /* 浮签卡上的两个药丸按钮（与文案的 Yes or No? 同词） */
    proposalYes: 'Yes',
    proposalNo: 'No',
  },

  /* 朗读按钮（speechSynthesis 不可用时隐藏） */
  speech: {
    speak: 'Read aloud',
  },

  /* 伙伴站（03） */
  partner: {
    /* 邀请卡（ww M4 已定）：卡片只显示买的是什么（图标 + 一个词）与头像计数 */
    inviteCount: '{a}/{b}',
    inviteAvatars: '👦👧',
    inviteEach: 'each pays {n} coins',
    inviteDone: 'You bought it together!',
    inviteMiss: 'Buying alone is OK too',
    myExtras: 'My extra food',
    noExtras: 'No extra food yet',
    theirExtras: "Friends' extra food",
    swapHint: 'Tap my food, then tap the food you want',
    swapPicked: 'Trade my {give} for {name}\'s {want}',
    swapConfirm: 'Offer a trade',
    /* noSwap 已删（审计 D3） */
  },

  /* 随机事件站（05） */
  event: {
    spinLabel: 'Weather wheel',
    spunTo: 'It is {name}!',
    choose: 'What will you do?',
    deckHint: 'Tap to flip it over',
    /* R10D: remainder preview on the spend card + consequence echo
       shown in the regret window before the panel closes */
    spendPreview: 'Spend {p} · {n} left',
    echoSpendOk: 'Spent {p} — food money is still enough',
    echoSpendGap: 'Careful: food money is {n} coins short now',
    echoFree: 'Not a coin spent — saved for the bus and food',
    /* R10E: weather/story card moments — tap hint under the big card
       and the story card's dismiss a11y name */
    cardTap: 'Tap to go on',
    storyDone: 'Got it',
  },

  /* AI 家长站（06） */
  parent: {
    alreadyUsed: 'Already used this game',
    useNow: 'Use it now',
    useLater: 'Not this time',
    oncePerGame: 'Once per game',
    questionOf: 'Question {a}/{b}',
    pickHint: 'Say it, or tap a picture:',
    typePlaceholder: 'Type your answer',
    sendText: 'Done',
    /* R10D: honest voice button — reads the question aloud, points at the cards */
    hearQ: 'Hear the question',
    clearedMark: '✓ Clear!',
    settleGo: 'Keep answering',
    /* 交互审 U7：结算钮只留命令本身（≤3 词），+1 币的事实挪到钮上方
       一行平铺文字（settleFact）。卡面原文含「(get 1 coin)」在
       cards.json（红线区）里不动，朗读仍用卡面全句 */
    settleBtn: "That's all",
    settleFact: 'You get 1 coin.',
    statusLive: 'Live chat',
    statusOffline: 'Offline script',
    ruleNote:
      'Say how many coins and what for → get 1 coin. Also say where coins went and your plan → get 2 coins',
    /* R10C：对话优先——家长形象名 + 示范对话 + 句首启口片 */
    parentName: 'Grown-up',
    echoLine: '{item} ✓ Clear!',
    /* demoTag/demoTip/demoSkip 已删（审计 E2） */
    starters: ['I want to buy…', 'I still need…', 'Next time I will…'],
  },

  /* 结局：开饭 + 流水 + 反思 */
  feast: {
    title: 'Dinner time',
    /* subtitle 已删（审计 E8） */
    plateFull: 'Full plate',
    plateSimple: 'Simple plate',
    plateShadow: 'Next time',
    noteFull: 'All food bought',
    noteSimple: '{n} still missing',
    noteShadow: 'Still missing after lap 3',
    ledgerBtn: 'My coins',
    ledgerBack: 'Back to the table',
    toReflection: 'Tell us a choice',
  },

  /* 「看看钱花到哪了」（只看自己，不比较） */
  ledger: {
    title: 'Where my coins went',
    start: 'Started with {n} coins',
    left: '{n} coins left',
    debtLeft: 'Still owe {n} coins of bus fare',
    groupTotal: 'Total {n} coins',
    lapTag: 'Lap {n}',
    groups: {
      ingredient: 'Food',
      temptation: 'Fun stuff',
      bus: 'Bus fare',
      event: 'Surprises',
      gain: 'Help and good luck',
    },
  },

  /* 演示控制条（REQUIREMENTS §8，老师现场演示用，对孩子隐藏） */
  demo: {
    title: 'Demo controls',
    jumpTitle: 'Jump to a stop',
    lapShort: 'Lap {n}',
    stationShort: 'Stop {n}',
    jump: 'Jump',
    restart: 'Restart',
    fast: 'No bot delay',
    on: 'on',
    off: 'off',
    personalityTitle: 'Bot style',
    spendAll: 'Demo: spend all spare coins',
    spendAllHint:
      'Auto-buys at the market until coins run low, then walks to the Bus Stop (shows "to pay later")',
    close: 'Hide demo bar',
  },

  /* 手机竖屏提示（M4.5.6：手机只支持横屏，看图就懂） */
  rotate: {
    hint: 'Turn your phone sideways',
  },

  reflection: {
    prompt: 'Tell us one choice you feel good about',
    placeholder: 'Type one line',
    writeOwn: 'Write your own…',
    waitingBots: 'Waiting for friends…',
    everyoneSaid: 'Everyone has shared',
    /* R10C: options she actually did sort first + get a small badge */
    /* personalHint 已删（审计 E12） */
    didIt: 'You did it',
    /* R10D: lap-3 forward-looking stem — only for a child who finished the recipe */
    forwardPrompt: 'Next time you shop, what will you do first?',
  },

  /* 动作日志（引擎写入 state.log，{name}/{item}/{n} 为占位符） */
  log: {
    drewRecipe: '{name} got the recipe "{item}"',
    lookRecipe: '{name} looked at the recipe',
    bought: '{name} bought {item}',
    held: '{name} put {item} in "maybe later"',
    holdBought: '{name} bought {item} at the old price',
    holdDropped: '{name} let {item} go',
    busPaid: '{name} paid {n} coins of bus fare',
    busDebt: '{name} is {n} coins short — into "to pay later"',
    busFree: '{name} already has a ticket',
    debtPaid: '{name} paid {n} coins of bus fare first',
    eventCard: '{name} spun {weather}: "{item}"',
    eventChoice: '{name}: {item}',
    inviteCard: 'Invite card: {item}',
    inviteJoin: '{name} joined the buy-together',
    invitePass: '{name} skipped the buy-together',
    inviteDone: 'Buy-together worked! Everyone got {item}',
    inviteFail: 'Not enough friends — coins came back',
    inviteRefund: '{name} got {n} coins back',
    swapDone: '{name} traded food with {item}',
    swapNo: '{item} did not trade with {name}',
    parentVisit: '{name} went to talk with their parent',
    parentSkip: '{name} skipped it this time',
    parentUsed: '{name} already used it this game',
    storeBought: '{name} bought {item} at the shop',
    cooked: '{name} put food on the plate',
    reflection: '{name}: {item}',
  },
} as const;
