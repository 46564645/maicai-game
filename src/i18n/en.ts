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
  tagline: 'Shop with friends, then cook a meal together',

  /* 开场 */
  intro: {
    startButton: 'Start',
    startHint: 'Tap to go!',
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
    done: 'Done with this stop',
    agree: 'Yes',
    decline: 'No thanks',
    help: 'Hint',
    replay: 'Play again',
  },

  /* 常驻元素 */
  hud: {
    lapLabel: 'Lap {lap}',
    lapOf: 'Lap {lap} of {laps}',
    stationLabel: 'Stop {n} · {name}',
    orderLabel: 'Order: ',
    wallet: 'My wallet',
    basket: 'My basket',
    help: 'Hint',
    helpAnytime: 'anytime',
    holdClip: 'Maybe later',
    busDebt: 'To pay later',
    empty: 'empty',
    howTo: 'How to play',
    settings: 'Settings',
    coin: 'coins',
    lapCompact: 'Lap {lap}/{laps}',
    botChip: '{name}, {n} coins — tap for details',
    walletWithCoins: 'My wallet, {n} coins',
  },

  /* 棋盘与游戏主界面 */
  game: {
    townAlt: 'Shopping town',
    pawnAt: 'at "{name}"',
    yourTurn: 'Your turn',
    botTurn: "{name}'s turn",
    thinking: 'Thinking…',
    enterStation: 'Go to this stop',
    enterStationKbd: ' (Enter / Space)',
    enterStationHint: 'Go to this stop (Enter / Space)',
    myCoins: 'My coins: {n}',
    botCoins: 'Coins: {n}',
    bought: 'Got',
    walletTitle: 'Wallet & recipe',
    walletHint: 'Recipe needs {a} more coins · bus fare {b} · {c} free to use',
    freeCoins: '{n} coins free to use',
    debtLeft: 'Bus fare still owed: {n}',
  },

  /* 屏幕 */
  screens: {
    chooseTitle: 'Pick a character you like',
    chooseHint: 'The other three will be your friends',
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
    drawRecipe: 'Draw a recipe card',
    buy: 'Buy {item} ({n} coins)',
    hold: '{item}: maybe later',
    holdBuy: 'Buy {item} at the old price',
    holdDrop: 'Skip {item}',
    endTurn: 'Done with this stop',
    swap: 'Trade my {give} for {name}\'s {want}',
    yes: 'Yes',
    no: 'No thanks',
    payBus: 'Put in {n} coins',
    busDebt: 'Put it in "to pay later"',
    busFreeDone: 'I already have my ticket',
    sayIt: 'Say it',
    storeBuy: 'Buy {item} ({n} coins)',
    chooseChar: 'Pick {name}',
    restart: 'Play again',
    demoJump: 'Jump to a stop',
    demoPersonality: 'Change bot style',
    setFlag: 'Toggle',
    close: 'Close',
    helpTitle: 'Little hint',
    helpMissing: 'Still missing: ',
    helpCoins: 'My coins: {n}',
    helpDebt: 'To pay later: {n}',
    helpCanDo: 'You can: ',
    noRecipe: 'No recipe yet',
  },

  /* 求助牌 */
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

  /* 公交站 */
  bus: {
    announced: 'We said the fare at the start. It is not a punishment.',
    paidDebt: 'Paid the bus fare first',
  },

  /* 站点面板（M3.2 正式面板） */
  panel: {
    stallIntro: '6 cards: food and fun stuff mixed together. Tap one, then pick what to do.',
    selected: 'Picked: {item} {n} coins',
    selectedMark: 'Picked: ',
    afterBuy: 'After you buy: {n} coins',
    noCoins: 'Not enough coins',
    buysLeft: 'You can buy {n} more this visit',
    buyPriced: 'Buy ({n} coins)',
    skipCard: 'Skip',
    endTurn: 'Done with this stop',
    holdClipLine: 'In your "maybe later" clip: {item} ({n} coins)',
    holdBuyPrice: 'Buy at old price',
    holdDropBtn: 'Let it go',
    tagNeeded: 'On my list',
    tagIngredient: 'Food',
    tagTemptation: 'Fun stuff',
    keyHelp: '←→ pick a card · 1/2/3 pick an action',
    lookTitle: 'Look at your recipe card',
    recipeMissing: 'Still need: {items}',
    recipeDone: 'Your recipe is all set!',
    busTicket: 'Bus ticket',
    storeIntro: 'Missing food is all here. Each costs 1 more coin than the market.',
    storeMissing: 'Recipe still needs',
    storeAll: 'All food',
    storeHoldLine: '"Maybe later" clip: {item} ({n} coins)',
    cookPut: 'Put your food on the plate',
  },

  /* bot 提议气泡（G4） */
  bubble: {
    swapAsk: '"My {give} for your {want}?"',
    inviteAsk: '"{name} — want to join?"',
    note: 'No lending or giving coins here.',
    fromSuffix: ' · Friends Stop',
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
    noSwap: 'No lending or giving coins — only trade extra food',
  },

  /* 随机事件站（05） */
  event: {
    spinLabel: 'Weather wheel',
    spunTo: 'It is {name}!',
    choose: 'What will you do?',
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
    voiceBtn: 'Voice',
    clearedMark: '✓ Clear!',
    settleGo: 'Keep answering',
    ruleNote:
      'Say how many coins and what for → get 1 coin. Also say where coins went and your plan → get 2 coins',
  },

  /* 结局：开饭 + 流水 + 反思 */
  feast: {
    title: 'Dinner time',
    subtitle: '3 laps done. Everyone gets a plate on the table.',
    plateFull: 'Full plate',
    plateSimple: 'Simple plate',
    plateShadow: 'Next time',
    noteFull: 'All food bought',
    noteSimple: '{n} still missing',
    noteShadow: 'Still missing after lap 3',
    ledgerBtn: 'See where my coins went',
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
