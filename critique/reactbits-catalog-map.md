# React Bits Catalog Map — 《一起去买菜》 overhaul reference

- Date: 2026-11-21. Sources: shallow sparse clone of
  [github.com/DavidHDev/react-bits](https://github.com/DavidHDev/react-bits)
  (`src/content/`, read-only scan of every component's imports/flags) cross-checked
  against the category listings on reactbits.dev (crawled 2026-11-21).
- **Library model:** React Bits is **copy-paste source, not a package**. Each
  component is a self-contained `.jsx` (+ optional `.css`) you vendor into your
  repo (JS or TS, CSS or Tailwind variants via the site/CLI). License:
  **MIT + Commons Clause** (usable in this free classroom game; the components
  themselves may not be sold). Every vendored component must be registered in
  `THIRD_PARTY_NOTICES.md` — the pattern the project already follows.
- **Counts:** the task brief named four categories; the library now has **five**
  (Micro Interactions was added — and it is the most button-heavy category, so it
  is mapped in full as a bonus section).

## Summary

| Category | Components | STRONG FIT (new) | POSSIBLE | NO FIT | Already used |
|---|---|---|---|---|---|
| Text Animations | 33 | 6 | 7 | 20 | 0 |
| Animations | 38 | 4 | 7 | 25 | 2 |
| Components | 48 | 7 | 14 | 21 | 6 |
| Backgrounds | 65 | 0 | 5 | 60 | 0 |
| Micro Interactions (bonus) | 35 | 5 | 13 | 17 | 0 |
| **Total** | **219** | **22** | **46** | **143** | **8** |

Fit standard (Thong's brief + project red lines): children 6–12, grades 1–3
floor — one thing at a time, buttons ≥48px, text ≥14px, **no rapid flashing /
no shake / no hit-stop**, `prefers-reduced-motion` must gate every animation,
English UI, touch-first (hover/pointer-only effects are marked down — classroom
tablets have no cursor), and performance-sensitive (dist already optimised to
~9.8 MB; the DOM layer must not fight the 3D board for GPU).

### STRONG FIT shortlist (component → exact game surface)

Surface IDs refer to `critique/ui-effects-inventory.md`.

| Component | Category | Deps | → Game surface |
|---|---|---|---|
| Specular Button | Components | self-contained (WebGL2 shader) | **A1** primary button + **A8** board-enter pill — glass edge-light CTA; one hero button per screen (shader canvas per instance — do not spray on every button) |
| Star Border | Animations | self-contained (canvas) | **F37** selected/emphasis state + **A1/A8** frames — THE owner-ordered replacement for the orange outline: a travelling glow on the border, tuned slow and warm |
| Border Glow | Components | self-contained | Already vendored as PlayableGlow (F2); extend as the basis for **F37** selected-card glow (owner ruling: outline → glow + lift) |
| Pill Nav | Components | self-contained | **E7** language toggle + **E3** topbar nav + **A14** phone quick slots (sliding active dot) |
| Rubber Segment | Micro | motion | **E7** language toggle (alternative basis to Pill Nav — rubber thumb 中/EN switch) |
| Stepper | Components | hugeicons (swap icons) | **B13** CookPanel step flow, **B20** How-to-play pages, **C9** progress pips replacement basis |
| Animated List | Components | hugeicons (swap icons) | **C20** reflection ledger, **B23** BasketReview lists, **B19** WalletDrawer card list (spring rows + gliding selection, arrow-key support) |
| Bubble Menu | Components | gsap | **A12/A13** phone FABs — floating circular expanding menu is exactly the phone-rail FAB pattern |
| Spotlight Card | Components | self-contained | **B8** BotCard + **B22** intro stat cards (soft pointer/press spotlight; same family as the vendored ProfileCard) |
| Stack | Components | motion | **B5** Deck — flick/drag-through card pile for the draw deck |
| Swipe Toast | Micro | motion + hugeicons (swap) | **D1** toast stack — swipe-down dismiss + a burning fuse that shows the remaining dwell; pairs with the owner ruling that the dark toast renders above cards |
| Spring Check | Micro | motion + hugeicons (swap) | **A17** reflection choice rows — spring-filled checkbox with drawn tick |
| Jelly Radio | Micro | motion | **A17** pick-one choices / **B21** character pick — chosen chip swells, neighbours budge |
| Squish Switch | Micro | motion | **A5** settings toggles (e.g. the pending sound on/off gate) |
| Count Up | Text Animations | motion | **C4** coin readout, **C7** lap-gain badges, **C20** ledger totals — animated number for big single totals (digit-rolling stays with the vendored Counter, C1) |
| Split Text | Text Animations | gsap | **C15** headings / popup titles / intro title — per-character staggered entrance |
| Blur Text | Text Animations | motion | **C15** screen headings + **D14** weather-moment title — soft-focus resolve reveal |
| Shiny Text | Text Animations | self-contained | **A8** pill label + **C17** weather result label — a light sheen sweep; text-level emphasis without any outline |
| Gradient Text | Text Animations | self-contained (CSS) | **E1/C15** intro title only — slow living gradient inside the display type |
| Rotating Text | Text Animations | motion | **D4** hint bar — cycles guidance phrases slowly (≥3 s per phrase keeps one-thing-at-a-time) |
| Glare Hover | Animations | self-contained (CSS) | **F37** card/button sheen + **A1/A2** buttons — extends the TiltCard glare language to flat controls; fires on press on touch |
| Animated Content | Animations | gsap | **F22** popup/panel entrances — the generic reveal wrapper (slide/blur/wipe variants) |
| Fade Content | Animations | gsap | **F22/D3** overlay & screen fades — fade/blur-in wrapper for veils and screens |

Already-used components (8) are listed in their own section below and are NOT
counted in the STRONG FIT numbers above.

## Already used from React Bits (do not double-count)

Registered in `THIRD_PARTY_NOTICES.md` (R10, 2026-11-17; Slice E, 2026-11-18).
The project vendors **adapted/rewritten** versions, not verbatim copies:

| React Bits source | Vendored as | Inventory item |
|---|---|---|
| BounceCards | `src/components/cards/Hand.tsx` (hand fan) | B2 |
| TiltedCard | `src/components/cards/TiltCard.tsx` (tilt + glare + flip) | B1 |
| BorderGlow | `src/components/cards/PlayableGlow.tsx` (playable sweep) | F2 |
| Magnet | spring params inside `src/components/cards/useDragPlay.ts` | F3 |
| Counter | `src/components/cards/CoinCounter.tsx` (trimmed to integers 0–99) | C1 |
| ClickSpark | `src/components/cards/PlaySpark.tsx` (rewritten DOM+CSS, no canvas rAF) | F1 |
| ProfileCard | concept in `src/components/cards/ProfileCard.tsx` (rewritten in-house) | B3 |
| ReflectiveCard | ID-card layout skeleton in `src/components/cards/ProfileCard.tsx` (rewritten; WebGL shader + camera deliberately NOT ported) | B3 |

## Dependency warnings (read before adopting anything)

The game's runtime deps today are only `react`, `three` + the R3F stack
(`package.json` @ 1d50ad5). **All DOM animation is hand-written CSS.** Every
library below is a NEW dependency decision:

1. **`motion` (`motion/react`, the framer-motion successor) — highest leverage,
   moderate cost.** 28 catalog components import it, including almost all of
   Micro Interactions and several STRONG fits (Swipe Toast, Spring Check,
   Jelly Radio, Rubber Segment, Squish Switch, Count Up, Blur Text, Rotating
   Text, Stack). Adopting this one package unlocks the button/micro-interaction
   layer Thong asked for first. It is tree-shakeable; budget it as the one
   sanctioned DOM animation runtime.
2. **`gsap` — second unlock, but a policy change.** 18 components import it,
   including STRONG fits Split Text, Animated Content, Fade Content and
   Bubble Menu. The project has *deliberately avoided gsap so far*
   (THIRD_PARTY_NOTICES records hand-written `useFrame` interpolation "未用
   gsap——按项目约定"). Adopting gsap reverses that convention — or the four
   components above get the PlaySpark treatment (rewrite the behaviour in
   CSS/motion and vendor the *design*, not the code). PM decision needed.
3. **`@hugeicons/*` — do NOT adopt; swap the icons.** 28 components import
   hugeicons for their glyphs. Standing project practice (Slice E ruling) is
   to replace them with hand-written inline SVGs — every hugeicons component
   below is marked "(swap icons)" and carries that adaptation cost. (The
   earlier hugeicons→inline-SVG substitution is still formally unratified by
   the team — flag it again in the delivery, as before.)
4. **`ogl` — avoid.** 10 components import ogl (a second, minimal WebGL
   runtime). Running ogl shader toys next to the three.js board means two WebGL
   stacks and GPU contention on low-end tablets. Every ogl component is marked
   NO FIT or heavily caveated below.
5. **`matter-js` — avoid.** Only Falling Text and Folder Float need it; both
   are NO FIT on audience grounds anyway.
6. **"Self-contained" ≠ cheap.** ~90 components import nothing but React yet
   run raw canvas/WebGL shader loops (nearly all Backgrounds, many
   Animations). Per-instance shader buttons (Specular Button = one WebGL2
   canvas per button) and canvas borders (Star Border, Electric Border) are
   fine on ONE hero surface, wrong on every row of a list. All Backgrounds
   additionally compete with the live 3D board canvas — see the category note.
7. **Copy-paste means maintenance is ours.** No upstream updates arrive; the
   vendored file is the product. This matches how the project already treats
   the R10 components.

## How this map serves Thong's two rulings (2026-11-21)

- **Dark toast always above cards/panels** → Swipe Toast (D1) is a STRONG fit
  and is designed as a top-layer element; nothing in the map reintroduces a
  below-cards toast.
- **Orange emphasis outline removed → glow + lift** → the glow family is:
  Star Border (travelling border glow), Border Glow (already vendored,
  cursor-tracked mesh glow), Electric Border (feast-only, see POSSIBLE),
  Spotlight Card (surface glow), Glare Hover (sheen). Selection state should
  standardise on **Border Glow / Star Border + the existing 2–4px lift**;
  keyboard focus must stay clearly visible in glow form.

---

## Text Animations (33)

Deps key: `—` = self-contained (React + own CSS/canvas only). "Pointer" in a
reason means the effect is driven by cursor position/hover and has no touch
equivalent worth having.

| Component | What it does | Deps | Fit | Target surface / reason |
|---|---|---|---|---|
| Split Text | Splits text into chars/words for a staggered entrance | gsap | **STRONG** | C15 headings, popup titles, intro title — the default heading entrance |
| Blur Text | Text starts blurred, crisply resolves | motion | **STRONG** | C15 screen headings, D14 moment-card title; keep it fast, gate on reduced-motion |
| Shiny Text | A sheen of light sweeps across the text | — | **STRONG** | A8 pill label, C17 weather result label — emphasis with zero outline |
| Gradient Text | Living gradient sliding/drifting inside the text | — (CSS) | **STRONG** | E1 intro title only; slow speed, project palette (cream/orange/navy family) |
| Rotating Text | Cycles phrases with 3D rotate/flip transitions | motion | **STRONG** | D4 hint bar — rotate guidance phrases at ≥3 s intervals |
| Count Up | Animated number counter with formatting/decimals | motion | **STRONG** | C4 coin readout, C7 lap gains, C20 ledger totals (big numbers; digit-roll stays Counter/C1) |
| Text Type | Typewriter effect with blinking cursor | gsap | POSSIBLE | D11 SpeechBubble / B16 parent chat replies — paced reading; risk: slow readers wait on it, so cap length and allow tap-to-complete |
| Circular Text | Characters laid around a circle, optional rotation | motion | POSSIBLE | B27 weather wheel rim label or a feast badge; rotation must be slow and reduced-motion-off |
| Split Flap Text | Mechanical split-flap board clacking to each new phrase | — | POSSIBLE | B9 popup station title / market price board — charming transit-board feel; the "clack" cycling must settle fast, never loop |
| Shuffle | Characters shuffle randomly before settling | gsap | POSSIBLE | C17 weather result word only (short, playful); never on instructional text — random glyphs fight early reading |
| Stroke Text | Outlined letters draw on, then flood with fill | gsap | POSSIBLE | E1 intro logo one-shot draw-on; nowhere in gameplay |
| Fold Text | Lines unfold like creased paper opening flat | gsap | POSSIBLE | C15 panel headings; gentle one-shot, reduced-motion gate |
| True Focus | Words take turns being in focus, others blurred | motion | POSSIBLE | B20 HelpCard reading guide for pre-readers; auto-advance may fight one-thing-at-a-time — trial before adopting |
| Tech Text | Wordmark letters turn into dashed vector paths under the cursor | — (canvas) | NO FIT | Pointer-only, 35 KB, wordmark toy — no surface |
| Text Loop | Seamless marquee flowing along curved SVG paths | gsap | NO FIT | Moving text cannot be read by grade 1–3; constant motion |
| Masked Heading | Headline with a drifting colour mesh showing through, word-by-word reveal | gsap | NO FIT | Mesh-through-type hurts legibility and palette discipline |
| Particle Text | Text assembles from drifting particles, scatters on demand | — (canvas) | NO FIT | 28 KB particle system for a heading; overwhelms, pointer-driven |
| Warp Text | WebGL warp bending/refracting text around the pointer | ogl | NO FIT | ogl + pointer + distorted reading text — triple fail |
| Depth Text | Layered extruded type with pointer parallax | — | NO FIT | Pointer parallax 3D type; heavy, desktop-only |
| Echo Text | Ghosted copies trail behind the text and settle | — | NO FIT | Ghost trails = deliberate illegibility during motion |
| Text Pressure | Characters scale/warp by pointer pressure zone | — | NO FIT | Pointer-only; warps letterforms children are learning |
| Curved Loop | Looping text flowing along a custom curve, drag interaction | — | NO FIT | Marquee + drag toy; unreadable in motion |
| Fuzzy Text | Vibrating fuzzy text with hover intensity | — (canvas) | NO FIT | Vibration is a flashing-adjacent readability killer |
| Falling Text | Text breaks apart, tumbles into a draggable physics pile | matter-js | NO FIT | Physics chaos with letters; new heavy dep; off-task |
| Text Cursor | Text/emoji trails stamped behind the cursor | — | NO FIT | Cursor trail; no cursor on classroom tablets |
| Decrypted Text | Hacker-style glyph cycling until text resolves | motion | NO FIT | "Hacker" glyphs are off-audience and read as errors |
| Scroll Float | Text floats/parallaxes on scroll | gsap | NO FIT | The game has no scroll-driven pages |
| Scroll Reveal | Text unblurs/reveals on scroll | gsap | NO FIT | No scroll surface (Reflection is a fixed screen) |
| ASCII Text | Waving ASCII text, tilts to pointer, scrambles on hover | — (canvas/WebGL) | NO FIT | ASCII aesthetic is off-audience; pointer toy |
| Scrambled Text | Distortion field follows the cursor over text | gsap | NO FIT | Pointer distortion of reading text |
| Glitch Text | RGB-split glitch with jitter | — (CSS) | NO FIT | Glitch/jitter is exactly the flashing class the brief bans |
| Scroll Velocity | Marquee whose speed/distortion follows scroll velocity | motion | NO FIT | No scroll; marquee motion |
| Variable Proximity | Letter styling varies continuously with pointer distance | — | NO FIT | Pointer-only typographic toy |

## Animations (38)

Most of this category is cursor/WebGL toys built for desktop portfolio sites.
The transferable pieces are the **border/glow family** and the two generic
reveal wrappers.

| Component | What it does | Deps | Fit | Target surface / reason |
|---|---|---|---|---|
| Click Spark | Spark bursts at every click (dashes/comets/dots/stars) | — (canvas) | ALREADY USED | Vendored as PlaySpark (F1), rewritten DOM+CSS |
| Magnet | Element eases toward the cursor, settles back with spring physics | — | ALREADY USED | Spring params vendored in useDragPlay (F3) |
| Star Border | A twinkling star travels the element's exact outline, trailing light | — (canvas) | **STRONG** | F37 selected/emphasis + A1/A8 — the owner-ordered glow-not-outline; retune: slow, warm dot instead of star sparkle, one instance at a time |
| Glare Hover | Glossy light streak sweeps an element along cursor direction | — (CSS) | **STRONG** | F37 transitions, A1/A2 buttons, B4 card face — same glare language as TiltCard; on touch it fires on press-drag |
| Animated Content | Wrapper revealing content on view: slides, blur, 3D tilts, wipes, stagger | gsap | **STRONG** | F22 popup/panel entrances (use slide/blur variants only — no 3D tilt on panels) |
| Fade Content | Wrapper fading content in (plain, blur, gray-wash, grain/mist variants) | gsap | **STRONG** | F22/D3 overlay and screen fades (plain/blur variants only) |
| Electric Border | Crackling electric strands wrap an element, surging near the cursor | — (canvas/WebGL) | POSSIBLE | B24 feast dish-reveal frame ONLY — "electric" reads as energy/danger, wrong for selection state; Star Border owns emphasis |
| Gradual Blur | Progressive edge blur for headers/footers/carousels, hides at scroll ends | — | POSSIBLE | G3 popup backdrop edges / G5 phone-rail end fades — softens layer boundaries |
| Pixel Transition | Pixel dissolve covers a card, swaps content, clears | — (canvas) | POSSIBLE | B5 deck draw reveal / F23 flip alternative — playful; keep blocks large and duration ≥400 ms so it never reads as flicker |
| Pixel Swap | New content builds in pixel-by-pixel in a springy wave | — | POSSIBLE | C9 pips / weather icon change — small-surface transitions only |
| Noise | Film-grain overlay (fine grain → dust/paper/static) | — (canvas) | POSSIBLE | B4 card face / G1 backdrop print texture at low opacity, STATIC frame only (matches the risograph card art); animated grain = shimmer, banned |
| Orbit Images | Images orbit along a customisable SVG path | — | POSSIBLE | B21 character select showcase ring; slow, pauses on interaction, reduced-motion-off |
| Sticker Peel | Die-cut sticker you can peel, drag, throw (gloss/matte/holo) | — | POSSIBLE | The literal sticker card in B11 StorePanel detail view; peel is a hard fine-motor gesture for grade 1–3 — tap-to-peel simplification required |
| Crystalized Ball | Glass ball with crackling electric rim and swirling glowing dust | ogl | NO FIT | ogl shader toy, pointer-driven |
| Electric Logo | Logo becomes a living lightning outline with leaping arcs | ogl | NO FIT | Lightning arcs = danger cue for kids; ogl |
| Dither Veil | 1-bit dithered photo the cursor burns through to colour | ogl | NO FIT | Pointer burn-through; no photo surface |
| Glow Cursor | Light pours from the cursor and fades as it cools | — (canvas/WebGL) | NO FIT | Cursor light; no cursor on tablets, GPU cost |
| Scroll Expand | Media frame grows to full bleed while scrolling | — | NO FIT | Scroll-driven; no scroll surface |
| Ripple Distortion | Pointer water-displacement warping content with a wake | ogl | NO FIT | Warps reading content; ogl |
| Elastic Mesh | Text/logo becomes a puffy jelly you can poke and stretch | — (canvas/WebGL) | NO FIT | 49 KB jelly physics toy; distorts type |
| Swarm Cursor | Liquid particle swarm flowing after the cursor | — (canvas/WebGL) | NO FIT | Cursor swarm; GPU + distraction |
| Halftone Reveal | Halftone print whose dots swell into the real photo under the cursor | — (canvas/WebGL) | NO FIT | Pointer reveal of photos; no surface |
| Cursor Grid | Grid cells light up and fade behind the cursor, click pulses | — (canvas/WebGL) | NO FIT | Cursor wallpaper behind gameplay = distraction |
| Logo Loop | Seamless looping marquee of logos, hover-pause | — | NO FIT | Brand marquee; constant motion, no logos in game |
| Target Cursor | Reticle cursor whose brackets snap around targets | — | NO FIT | Desktop cursor replacement |
| Laser Flow | Beam of light splashes onto content and pours over corners | — (canvas/WebGL) | NO FIT | Pointer beam shader; overwhelming |
| Ghost Cursor | Glowing smoke ghost floats after the cursor | — (canvas/WebGL) | NO FIT | Cursor follower; smoky = murky for kids |
| Image Trail | Images trail behind the cursor (several variants) | gsap | NO FIT | Cursor trail; visual clutter |
| Pixel Trail | Glossy pixels melt into a goo trail behind the cursor | — (canvas/WebGL) | NO FIT | Cursor trail |
| Cubes | Grid of outlined 3D cubes turning to face the cursor, click ripples | — (canvas/WebGL) | NO FIT | Cursor grid toy |
| Metallic Paint | Liquid chrome flows over logo/text (shader) | — (canvas/WebGL) | NO FIT | Chrome shader over type; legibility + GPU |
| Shape Blur | Logo/shape drifts out of focus under the pointer | — (canvas/WebGL) | NO FIT | Deliberate blur of content; pointer |
| Crosshair | Crosshair cursor with live coordinates locking onto links | — (canvas) | NO FIT | Desktop inspection cursor |
| Ribbons | Springy ribbons trail the cursor | — (canvas/WebGL) | NO FIT | Cursor trail |
| Splash Cursor | Fluid simulation trailing the cursor, splashes on click | — (canvas/WebGL) | NO FIT | Full-screen fluid sim; heavy and chaotic |
| Meta Balls | Liquid metaballs merge/stretch, cursor blob pushes through | — (canvas/WebGL) | NO FIT | Pointer fluid toy |
| Blob Cursor | Liquid-metal blob cursor, stretches and bursts into droplets | three | NO FIT | Cursor replacement; three.js for a cursor |
| Strands | Spectral strands twist inside a frosted orb (Siri-like) | — (canvas/WebGL) | NO FIT | Ambient orb toy; no surface |

## Components (48)

"(swap icons)" = the component imports `@hugeicons/*`; per project practice the
glyphs are replaced with hand-written inline SVGs during vendoring.

| Component | What it does | Deps | Fit | Target surface / reason |
|---|---|---|---|---|
| Tilted Card | 3D card tilting to cursor, glare, soft shadow, flip side | — | ALREADY USED | Vendored as TiltCard (B1) |
| Bounce Cards | Fan of cards bouncing in, spreading, hovered one straightens | — | ALREADY USED | Vendored as Hand (B2) |
| Counter | Odometer digits rolling to each new value, currency/locales | — | ALREADY USED | Vendored as CoinCounter (C1), trimmed to 0–99 integers |
| Profile Card | Framed profile card tilting to cursor with holo foil | hugeicons | ALREADY USED | Concept vendored as ProfileCard (B3), rewritten in-house |
| Reflective Card | Metal ID card reflecting camera/video, catching light as it tilts | hugeicons | ALREADY USED | Layout skeleton vendored in ProfileCard (B3); shader/camera deliberately not ported |
| Border Glow | Glowing mesh-gradient border following cursor, intensifying at edges | — | ALREADY USED | Vendored as PlayableGlow (F2); also the basis candidate for F37 selected glow |
| Specular Button | Glass button whose edge catches light, highlight glides to cursor | — (WebGL2 shader) | **STRONG** | A1 primary button + A8 board-enter pill — the hero CTA. One shader canvas per instance: hero surfaces only, keep the ≥56px hit area and label static |
| Pill Nav | Pill nav bar: fill rises through each link, label rolls, sliding active dot | — | **STRONG** | E7 language toggle, E3 topbar nav, A14 phone quick slots |
| Stepper | Multi-step flow with gliding step indicator, spring transitions, H/V layouts | hugeicons (swap icons) | **STRONG** | B13 CookPanel steps, B20 How-to-play paging, C9 progress — replaces pip dots with a readable step track |
| Animated List | Scrolling list, rows spring in, gliding selection, arrow keys | hugeicons (swap icons) | **STRONG** | C20 reflection ledger, B23 BasketReview, B19 wallet list |
| Bubble Menu | Floating circular menu expanding with staggered item reveal | gsap | **STRONG** | A12/A13 phone FABs — this IS the FAB pattern, touch-native |
| Spotlight Card | Card lit by a soft spotlight following the pointer, catching its edge | — | **STRONG** | B8 BotCard, B22 stat cards — gentle; on touch it lights on press |
| Stack | Pile of cards you drag, flick or click through; thrown cards tuck under | motion | **STRONG** | B5 Deck — the draw pile as a flickable stack (tap-to-draw must remain as the accessible path) |
| Holo Card | Trading card with real holographic foil + glitter as it tilts | — (canvas/WebGL foil) | POSSIBLE | B6 recipe-completion reward card / B3 upgrade — one hero card only; foil shader cost and glitter density need toning for the audience |
| Depth Carousel | Cards recede into depth on a 3D rail; drag, keyboard, auto-advance | gsap | POSSIBLE | B21 CharacterSelect — depth rail may fight the flat UI language; prototype before committing |
| Card Nav | Nav bar springing open into a row of link cards | hugeicons (swap icons) | POSSIBLE | E1 intro nav (in-game topbar E3 should stay calm) |
| Scroll Stack | Cards pin and stack while scrolling, settle into a dimmed deck | — | POSSIBLE | B25 reflection cards on tall tablets; scroll-dependent, verify at 667×375 |
| Magic Bento | Bento grid of feature cards, cursor edge-light, click wave | hugeicons (swap icons) | POSSIBLE | B22 intro stat cards / B20 help sections — edge-light is pointer-led; keep the grid static-calm |
| Carousel | Swipeable cards with five transitions + autoplay timer | hugeicons (swap icons) | POSSIBLE | B21 character select / B20 help pages — disable autoplay (motion must be child-led) |
| Dock | macOS-style dock with magnification, launch bounce, badges | — | POSSIBLE | E5 phone rail / bottom action dock — magnification is hover-centric; on touch it must work at fixed size |
| Gooey Nav | Nav whose active pill breaks into goo flowing to the picked item | — | POSSIBLE | E7 alternative to Pill Nav/Rubber Segment — goo may read messy; Pill Nav is the safer primary |
| Pixel Card | Card filling with twinkling pixels on hover, rippling from centre/cursor | — (canvas) | POSSIBLE | B11 temptation cards' sparkle — hover-only, so treat as decoration on press; twinkle rate must stay slow |
| Elastic Slider | Slider growing under cursor, stretching like rubber past the ends | hugeicons (swap icons) | POSSIBLE | A5 settings sliders (future sound/speed) — settings barely exist yet |
| Option Wheel | Curved option picker spinning with scroll/drag/arrow keys | — | POSSIBLE | B27 DOM weather wheel interaction — only if the result-first ceremony contract (result decided, wheel performs it) is preserved exactly |
| Line Sidebar | List navigation with cursor-proximity shift/highlight | — | POSSIBLE | B20 HelpCard section nav — proximity is pointer-led; tap state must be equally clear |
| Staggered Menu | Menu with staggered item animations on open/close | gsap | POSSIBLE | A5/A6 settings & help menu (E4 layer stack) |
| Card Swap | 3D stack sending the front card to the back on a timer or fling | hugeicons (swap icons) | POSSIBLE | B24 feast plate showcase — timer mode must be off or very slow; fling only |
| Circular Carousel | 3D ring of images, bendable cards, momentum drag, snap, click-to-focus | — | NO FIT | 3D image ring; no photo-ring surface, disorienting |
| Flex Carousel | Infinite image row flowing through "liquid glass" edges | ogl | NO FIT | ogl + infinite motion |
| Infinite Spiral | Endlessly looping 3D helix of images | — | NO FIT | Perpetual 3D motion; no surface |
| Morph Slider | WebGL slider melting between images via displacement | gsap + ogl | NO FIT | Two heavy deps for an image slider the game doesn't have |
| Drift Wall | Endless perspective wall of tiles drifting past | — | NO FIT | Ambient drift behind gameplay = distraction |
| Accordion Gallery | Panels expanding on hover/focus revealing parallax imagery | gsap | NO FIT | Hover-expand photo panels; no surface |
| Curved Input | Arc-bent input bar, text/caret/submit following the curve | — | NO FIT | Bent text input hurts early readers; chat input stays straight |
| Circular Gallery | Curved gallery, drag/scroll/tab, cards open to full image | — (ogl-style WebGL) | NO FIT | WebGL gallery; no surface |
| Fluid Glass | 3D glass object refracting content, following cursor, melting shapes | — (canvas/WebGL) | NO FIT | 48 KB refraction toy; GPU + legibility |
| Masonry | Masonry gallery springing into place, lightbox | hugeicons (swap icons) | NO FIT | Photo gallery; no surface |
| Glass Surface | Apple-style liquid glass bending what's behind it | — (canvas/WebGL) | NO FIT | Refraction panels over a busy 3D board = unreadable |
| Dome Gallery | Immersive 3D dome of projected images | — | NO FIT | Immersive dome; no surface, disorienting |
| Chroma Grid | Grayscale photo cards, spotlight restores colour | — | NO FIT | Pointer spotlight on photos; no photo grid |
| Folder | Folder opening like a book, pages you can pick | — (canvas/WebGL) | NO FIT | 67 KB — the single heaviest component in the library; wallet is a drawer, not a folder |
| Model Viewer | Product-style 3D model viewer with soft shadow | r3f + three | NO FIT | The 3D board already presents models in-scene |
| Lanyard | Swinging 3D badge on a stretchy band, drag/throw/flip | three | NO FIT | Physics badge toy; heavy, no surface |
| Flying Posters | 3D posters twisting/flipping through an endless scroll column | — (canvas/WebGL) | NO FIT | Scroll + 3D posters; no surface |
| Glass Icons | Liquid-glass icons bending the colour behind them | — (canvas/WebGL) | NO FIT | Refraction icons; category icons must stay flat and shape-distinct (ww rule) |
| Decay Card | Image card tearing/melting as the pointer moves, then healing | — (canvas/WebGL) | NO FIT | Destruction effect on cards — wrong tone for this audience |
| Flowing Menu | Full-height menu, liquid band gliding between rows + marquee | hugeicons (swap icons) | NO FIT | Full-screen liquid menu is far too much motion for in-game nav |
| Infinite Menu | Draggable sphere of image tiles snapping the nearest forward | — (canvas/WebGL) | NO FIT | 3D tile sphere; disorienting, no surface |

## Backgrounds (65)

**Category verdict: effectively out of scope for gameplay screens.** Every
entry is a full-screen canvas/WebGL shader loop. The game already runs a live
three.js canvas; a second always-on shader layer behind it would (a) compete
for the same low-end-tablet GPU, (b) put constant motion behind reading and
money-counting, breaking one-thing-at-a-time, and (c) most are pointer-steered.
Five entries earn a POSSIBLE strictly for screens where the 3D board is absent
(intro shell, feast) or as a bounded weather accent — each with a hard caveat:
render slow or near-static, pause when off-screen, honour reduced-motion with
a static frame, and prototype the frame cost on the weakest target tablet
before adopting. Everything else is NO FIT; to keep this map usable, NO FIT
backgrounds are grouped by reason rather than repeated row by row.

### POSSIBLE (5)

| Component | What it does | Deps | Fit | Target surface / caveat |
|---|---|---|---|---|
| Aurora | Soft calm aurora flowing across the top of the page | — (canvas/WebGL) | POSSIBLE | G6 intro shell backdrop — intro only, slow drift, reduced-motion = static gradient; board screens excluded |
| Soft Aurora | Aurora shader with 3D Perlin noise + cosine palettes | — (canvas/WebGL) | POSSIBLE | G6 intro shell alternative to Aurora — pick at most ONE aurora |
| Silk | Flowing satin folds with glossy highlights | — (canvas/WebGL) | POSSIBLE | G6 intro shell alternative — calmest of the shader set; same one-only rule |
| Pixel Snow | Pixel-art snowflakes drifting down in depth layers | — (canvas/WebGL) | POSSIBLE | D14 weather-moment accent if a snow/rain moment needs DOM weather — low flake count, reduced-motion off; the 3D scene already does weather, so this is a fallback nicety, not a need |
| Light Rays | Volumetric light rays from an edge with source glow and haze | — (canvas/WebGL) | POSSIBLE | B24 feast backdrop — a warm celebration glow behind the DOM feast screen; keep opacity low, no cursor steering |

### NO FIT (60) — grouped by disqualifying reason

- **Pointer-steered shader fields (also GPU-heavy):** Acid Squares, Aero Shards
  (84 KB — heaviest file in the library), Antigravity, Balatro, Beams,
  Color Bends (three), Dark Veil, Dither, Dot Field, Dot Grid, Evil Eye (ogl;
  a giant eye following the child is also tonally wrong), Faulty Terminal,
  Ferrofluid, Floating Lines, Flux Lines, Galaxy, Ghost Fibers, Gradient ASCII,
  Gradient Blinds, Gradient Waves, Grainient, Grid Distortion, Grid Motion,
  Grid Scan, Holo Mosaic, Hyperspeed (three), Iridescence, Letter Glitch,
  Light Pillar, Light Tunnel, Lightfall, Liquid Chrome, Liquid Ether,
  Magic Rings, Magnet Lines, Micro Slats (ogl), Molten Metal, Orb, Particles,
  Line Waves,
  Pattern Waves (ogl), Pixel Blast, Plasma, Plasma Wave, Prism,
  Prismatic Burst, Radar, Ripple Grid, Scanner, Shape Grid, Shape Waves,
  Side Rays, Sliced Waves, Threads, Topography (57 KB), Waves, Web Threads.
- **Aggressive/flashing content regardless of input:** Lightning (branching
  lightning strikes — flashing + danger cue), CRT Warp and Faulty Terminal
  (flickering CRT — flicker is banned outright; Faulty Terminal counted above),
  Letter Glitch (glitching letters; counted above).
- **Physics/playground fields:** Ballpit (41 KB physics ball pit — a toy
  background that would upstage the board).

Count check: 5 POSSIBLE + 60 NO FIT, every one of the 65 named above
(Faulty Terminal and Letter Glitch appear in the pointer group and are
cross-noted in the flashing group). If a future round wants a per-row table
for this category, generate it from the repo scan; the verdicts will not
change without a change in the game's GPU budget.

## Micro Interactions (35) — bonus category

Not in the original four-category brief; the library added it and it is the
single most relevant category for Thong's "尤其是 ui 和 button" instruction —
small, touch-friendly controls rather than page furniture. Most entries import
`motion`, which is why the `motion` adoption decision gates this whole layer.

| Component | What it does | Deps | Fit | Target surface / reason |
|---|---|---|---|---|
| Swipe Toast | Toast swiping down to dismiss, with a burning fuse showing remaining time | motion + hugeicons (swap icons) | **STRONG** | D1 toast stack — the fuse makes the 4s dwell visible and honest; swipe + existing tap-dismiss both kept; renders above cards per owner ruling |
| Spring Check | Checkbox row: spring fills the box, draws the tick, strikes the label | motion + hugeicons (swap icons) | **STRONG** | A17 reflection choice rows; also any future checklist in B20 |
| Jelly Radio | Radio chips where the chosen one swells and barges neighbours outward | motion | **STRONG** | A17 pick-one choices, B21 character pick feedback |
| Rubber Segment | Segmented control whose rubber thumb stretches across the gap and squashes into place | motion | **STRONG** | E7 language toggle — the 中/EN switch as a physical rubber thumb; alternative basis to Pill Nav |
| Squish Switch | Switch whose thumb stretches with speed and squashes at the end when flicked | motion | **STRONG** | A5 settings toggles — incl. the pending sound on/off gate decision |
| Hold Button | Hold-to-confirm button, liquid fill rises while pressed, snaps back on release | — | POSSIBLE | A16 board retry / A3 stop-exit — hold prevents accidental taps, but sustained press is a real motor demand at grade 1–3; keep hold time short if used |
| Slide Commit | Slide-to-confirm handle spinning while the action runs, unfurling into a done pill | motion + hugeicons (swap icons) | POSSIBLE | A3 "Done with this stop" — a big-motor slide is hard to fire accidentally; verify a tap-only path remains |
| Fuse Button | Action button whose done state carries an undo on a burning fuse | hugeicons (swap icons) | POSSIBLE | C12 PendingChip actions — the fuse matches the pay-later drain (F11) language; only if an undo action is ever added to the flow |
| Wake Slider | Thumbless range slider of thin bars; drag speed raises a wake behind the handle | motion | POSSIBLE | A5 settings sliders (with Elastic Slider) — bars are abstract for young kids; low priority |
| Glide Select | Select chip whose menu pops from its corner, highlight glides between rows | hugeicons (swap icons) | POSSIBLE | A15 DemoBar chips / future settings selects — demo and adult-facing surfaces only |
| Swipe Row | List row swiping open to reveal actions; full swipe deletes | motion + hugeicons (swap icons) | POSSIBLE | B19 WalletDrawer rows — reveal-action half only; the game has NO delete semantics and must not grow any |
| Status Mark | Status glyph morphing idle ring → progress arc → check | motion | POSSIBLE | D10 bot thinking/done indicator — a calm ring-to-check morph fits bot turns |
| Lattice Loader | Status row with a lattice of cells brightening in a wave beside a live stopwatch | — | POSSIBLE | D6 splash visual ONLY as decoration beside the real progress % — the splash must keep tracking real loading (owner rule), never a timer |
| Voice Pill | Mic button swelling into a capsule of live EQ bars + timer while recording | hugeicons (swap icons) | POSSIBLE | B16/A18 parent chat voice input — only if voice input is ever added; classroom mic permissions make this speculative |
| Tear Ticket | Ticket whose perforated stub tears off by hand, fibre by fibre | motion | POSSIBLE | B12 Bus Stop ticket moment — thematically perfect; tearing is a fine-motor drag, so a tap-to-tear simplification is required |
| Flip Card | Two-faced card flipping in 3D on click/drag/flick, settling on a spring | motion | POSSIBLE | Basis candidate for F23 card flip / B5 deck flip (the game's current flip is hand CSS) |
| Warm Tooltip | Tooltip group: first label waits, siblings then open instantly while "warm" | motion | POSSIBLE | C11 meta-icon hints — ww requires tap-to-show-name for the three card icons; warm-group behaviour fits a row of icons |
| Branched Menu | Collapsible menu branching each section from a trunk, tracing a line to your pick | hugeicons (swap icons) | POSSIBLE | B20 HelpCard contents tree — the branch tracing is decorative; the tree itself is the value |
| Shredder | List with a paper shredder cutting dragged rows into curling strips | — (canvas) | NO FIT | Destruction metaphor for list items; no surface |
| Paper Crumple | Image crumpling into a textured 3D sheet while held and dragged | three | NO FIT | three.js crumple toy; destructive, heavy |
| Refine Frame | Media frame stepping an image through "generation stages" | hugeicons (swap icons) | NO FIT | AI-generation UI pattern; meaningless in this game |
| Thought Line | AI reasoning-trace header with live clock folding steps into one line | motion + hugeicons (swap icons) | NO FIT | AI-dev UI pattern; off-audience |
| Prompt Bar | Chat composer with @ sources, / commands, model picker, dictation, attachments | motion + hugeicons (swap icons) | NO FIT | Adult AI-chat composer; the parent chat (A18) must stay one-button simple |
| Sling Button | Send button you pull back like a slingshot and release to fire | motion + hugeicons (swap icons) | NO FIT | Pull-back gesture is undiscoverable at grade 1–3 |
| Bell Toggle | Pill toggle ringing a bell, crossfading its label | motion + hugeicons (swap icons) | NO FIT | Notification bell; the game has no notifications |
| Call Chip | Tool-call chip whose fill wipes as a timer ticks, ending green or shaking red | hugeicons (swap icons) | NO FIT | AI-agent dev UI; also ends in a shake, which is banned |
| Code Slots | One-time-code input, digits springing into slots, SMS autofill | motion + hugeicons (swap icons) | NO FIT | Login/OTP — login is a project red line |
| Dodge Field | Wrapper making any child dodge the pointer until it "relents" | motion | NO FIT | A UI that runs away from the child is a hostile pattern, full stop |
| Comet Dial | Tick-ring dial flicked by angle, comet streaking behind the lit head | motion | NO FIT | Flick dial; the weather wheel is a 3D ceremony, not a dial input |
| Scrub Field | Number chip you drag to scrub, rubber-band limits, click to type | motion | NO FIT | Numbers must stay static and readable for money learning; hidden drag gestures |
| Pulse Heart | Like button contracting to a dot, flipping colour, count ticking | hugeicons (swap icons) | NO FIT | Likes/social counts — outside the game's values frame |
| Peek Rating | Star rating lifting a wave of stars to the pointer, pop on commit | hugeicons (swap icons) | NO FIT | Ratings — the game has no scoring of children or content |
| Slosh Gauge | Tank gauge whose liquid chases the value, splashing when full | — | NO FIT | Coins are deliberately discrete physical dots beside numerals (E4 pedagogy); a liquid gauge contradicts it |
| Folder Float | Folder whose notes spring into a floating cloud on hover/press | matter-js | NO FIT | matter-js physics cloud; hover-led |
| Flying Button | Button with physics-launch behaviour and shader trail effects | — (canvas/WebGL) | NO FIT | 67 KB — tied heaviest in the library — for one button; gimmick over clarity |

## Method & confidence notes

- Enumeration is from the repo source tree (`src/content/<Category>/<Name>/`),
  not marketing copy: 33 + 38 + 48 + 65 + 35 = **219 components**. The site
  category pages list 217 — the repo additionally contains **Evil Eye**
  (Backgrounds) and **Flying Button** (Micro), both mapped above as NO FIT.
- Dependencies were extracted mechanically from each component's imports
  (scan of all 219 `.jsx` files), then spot-verified by hand for the priority
  items (Specular Button = raw WebGL2 shader; Star Border / Electric Border /
  Border Glow = React-only self-contained; Swipe Toast = motion + hugeicons;
  Count Up = motion).
- "Self-contained" in the Deps column means no library import beyond React —
  it does NOT mean lightweight: flags for canvas/WebGL internals are called
  out in the Fit column wherever they change the verdict.
- Every STRONG fit still needs the standard vendoring treatment: retune to
  project tokens (cream/orange/navy), ≥48px targets, text ≥14px,
  reduced-motion gate, touch-first interaction path, registration in
  `THIRD_PARTY_NOTICES.md`, and the five-size screenshot evidence the team
  already requires.
