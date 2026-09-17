# References and Methodology

Reference snapshot: **2026-09-17**. Intended for Wuthering Waves **v3.6** theorycrafting.

This project is an **unofficial fan-made theory tool**. It distinguishes community-tested formulas from official in-game descriptions. Kuro Games does not publish one complete player-facing formula reference covering every character-specific mechanic.

## 1. Damage formula / multiplier structure

### Wuthering Tools — Info
https://www.wutheringtools.com/info

Used to cross-check the commonly implemented community structure:

```text
scaling stat × motion value × amplify × damage bonus × crit × defense × resistance
```

and the basic attribute relationship:

```text
base stat × (1 + percent bonuses) + flat bonuses
```

### 鳴潮 Wiki* — ダメージ計算式
https://wikiwiki.jp/w-w/%E3%83%80%E3%83%A1%E3%83%BC%E3%82%B8%E8%A8%88%E7%AE%97%E5%BC%8F

Used to cross-check:

- ATK / multiplier structure.
- Damage Bonus and Amplify-like categories.
- Expected Crit relationship.
- Defense and resistance descriptions.

### Open-source implementation cross-checks

- https://github.com/chuan-hane/wuwa-damage-calculator
- https://github.com/devyur/Wuwa-rotation-calculator
- https://github.com/k4wai1/un-waves-optimizer

These are implementation references, not official Kuro Games specifications.

## 2. Character catalogue data

### 库街区《鸣潮》WIKI
https://wiki.kurobbs.com/mc/home

The blog keeps a periodically refreshed local snapshot of the public Resonator catalogue for character names and portrait images. No player account login is required for this catalogue data.

## 3. Echo substat ranges

### Prydwen — Echoes Stats
https://www.prydwen.gg/wuthering-waves/guides/echo-stats

Used to cross-check Rank 5 Echo substat ranges, including examples such as:

- Crit Rate: 6.3% – 10.5%
- Crit DMG: 12.6% – 21.0%
- ATK% / HP%: 6.4% – 11.6%
- DEF%: 8.1% – 14.7%
- Flat ATK: 30 – 60
- Flat HP: 320 – 580
- Flat DEF: 40 – 70

Substat values in the UI are hard-locked to the real in-game roll tiers (dropdowns), so impossible values cannot be entered. Duplicate substat types on one Echo are rejected, matching the in-game rule.

### 鳴潮 Wiki* — 音骸/厳選と確率
https://wikiwiki.jp/w-w/%E9%9F%B3%E9%AA%B8/%E5%8E%B3%E9%81%B8%E3%81%A8%E7%A2%BA%E7%8E%87

Used to cross-check discrete Echo substat tiers presented by that community wiki.

## 4. Crit expectation

The UI displays Crit DMG including the normal 100% hit. Expected critical multiplier is modeled as:

```text
E[Crit] = 1 + CR × (CD - 1)
```

where CR and CD are decimals and CR is capped at 100% for expected damage.

This directly produces the marginal effect discussed in the tool: large self Crit-DMG buffs reduce the value of adding more Echo Crit DMG, while Crit Rate becomes more valuable until the cap.

## 5. Single-character damage weighting

The current version deliberately removes team Buff windows. A character is represented by:

- Main scaling stat: ATK / HP / DEF.
- Current static panel.
- Combat-only self buffs / Resonance Chain corrections.
- Main damage type.
- Share of total damage belonging to that type.

For the selected main type with share `q`:

```text
TotalFactor = q × MainTypeFactor + (1 - q) × OtherDamageFactor
```

This lets type-specific Echo substats receive partial value without requiring the player to model a full rotation.

## 6. Echo replacement model

The user-entered current panel is assumed to contain all five currently equipped Echoes.

For replacement slot `n`:

```text
CandidatePanel = CurrentPanel - OldEcho[n] + CandidateEcho
ReplacementGain = CandidateFactor / CurrentFactor - 1
```

Both main stats and substats can therefore affect replacement gain.

## 7. Individual Echo score and build graduation (static)

Since 2026-09-17 the per-Echo score is a **static, character-scoped score** adapted from the open-source [WuwaEchoTool](https://github.com/GQin404/WuwaEchoTool) coefficient scheme. It replaced the earlier marginal-equivalent-roll formula.

Each substat type has a character-dependent coefficient:

```text
Crit Rate 1.8 · Crit DMG 0.9 · scaler% 1 (DEF-scaler 1.2)
flat scaler stat: small coefficient (ATK 0.1 / HP 0.01 / DEF 0.09)
type-damage substat = 0.9 × that character's damage-composition share
Energy Regen 0.5 · off-scaler substats 0

LineScore   = value × coefficient
EchoScore   = Σ LineScore / (theoretical best 5 distinct max-roll lines) × 100
BuildScore  = Σ(main + fixed main + substats) / theoretical full loadout × 100
```

Graduation tiers on BuildScore (WuwaEchoTool convention): `>90 完美毕业 · >80 大毕业 · >70 中毕业 · >60 小毕业 · >50 接近毕业 · else 咸鱼一条`.

Properties and limits of this score — stated deliberately so players know what it can and cannot claim:

- `100` = five distinct best-effective substats all at max roll.
- The score depends only on the character (and its per-chain damage composition), **not** on the entered panel or the other four Echoes. Editing Echo B never changes Echo A's score.
- Because it ignores the live panel, **a high-scoring Echo is not automatically the better swap for the current build** (e.g. Crit Rate lines near the 100% cap). The replacement gain and the actionable-upgrade ranking are the panel-aware, fully recomputed numbers to use for that decision. The two systems intentionally coexist: static score = "how good is this Echo's substat budget for this character", marginal calculations = "what should I change next on this build".
- The S/SS/SSS label is a presentation layer for this site's own score, not an official game grade.

The actionable-upgrade ranking does **not** use ratio approximations: every candidate action (raise an existing line to max roll, or replace one existing line with an average roll of the target type) is evaluated by cloning the full 5-Echo loadout and recomputing the damage factor, so crit-cap clamping and conditional set thresholds (e.g. ER ≥ 250%) are honored per scenario.

## 8. Resonance Chain handling

The character-mechanics dataset now carries, per character:

- `chains[].effects`: combat-only stat buffs per chain level (ATK%, Crit, type/element damage bonus, Amplify), applied automatically when the chain level is selected. Permanent panel-visible chain stats are marked `apply: "panel"` and excluded, since they are already inside the user-entered panel.
- `chain_type_weights`: per-chain damage-composition tables ("1"–"6"), used when a chain changes motion multipliers, adds new tagged damage or converts tags. Legacy characters reuse WuwaEchoTool's `mzProperty` tables; post-陆·赫斯 characters were derived from 2026-09 community guides with per-character sources recorded in the data.
- Chain buffs that only raise crit damage of a single skill cannot be honestly encoded as flat type-damage bonuses; they are kept as text notes and (approximately) reflected via the composition tables instead.

A constant multiplier affecting Current and Candidate identically still cancels out of the replacement ratio.

## 9. Product / UX reference

### wuwacalc.cn — 南边道友TEIO
https://wuwacalc.cn

Bilibili introduction:
https://www.bilibili.com/video/BV1qTuh63E4c/

Used only as a product / interaction reference for making theorycrafting easier to enter and read in a browser. This project does not treat it as the sole damage-formula source and does not copy its UI, assets or private data.

## 10. Kuro account import

`kuro-sync.js` implements optional client-side import, mirroring WuwaEchoTool's flow: the player pastes their own Kuro BBS token, which is stored only in that browser's localStorage and sent directly to the official `api.kurobbs.com` endpoints (requestToken → refreshData → roleData → getRoleDetail). This site never receives, proxies or logs the token; an unbind button deletes the local copy. Imported substat values are snapped to the nearest legal roll tier. Panel stats are not provided by the API and must still be copied from the in-game character page.
