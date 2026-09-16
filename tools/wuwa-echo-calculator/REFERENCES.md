# References and Methodology

Reference snapshot: **2026-09-16**. Intended for Wuthering Waves **v3.6** theorycrafting.

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

The calculator does not hard-lock the comparison tier. Users can edit the standard-roll controls because marginal boundaries should not depend on a single arbitrary roll tier.

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

## 7. Individual Echo marginal score

The score is designed to measure contextual substat quality rather than fixed CV.

First, the tool calculates the current marginal gain of representative average rolls and takes the strongest relevant one as the reference gain `Gref`.

For each substat line:

```text
EquivalentRoll_i = ln(1 + Gi) / ln(1 + Gref)
```

where `Gi` is the actual damage loss observed when that substat is removed from the current build.

Then:

```text
EchoMarginalScore = Σ EquivalentRoll_i / 5 × 100
```

Interpretation:

- `100` means five substats approximately equal to five currently-best average rolls.
- The same physical Echo can receive a different score on a different character/build.
- High Crit-DMG self buffs can reduce Crit-DMG line scores.
- A stat that does not affect the modeled damage state, such as excess ER in the current simplified model, can receive little or zero damage score.

The displayed S/SS/SSS-style label is only a presentation layer for this site's own score. It is not an official game grade.

## 8. Resonance Chain handling

The manual version records the selected Resonance Chain level from 0 to 6.

It does **not** claim that all character-specific chain descriptions are already machine-modeled.

Current treatment:

- Permanent chain stats visible in the character panel belong in the current panel values.
- Combat-only ATK%, Crit Rate, Crit DMG, Damage Bonus and Amplify changes can be entered under the self-buff / chain correction section.
- A constant independent multiplier that affects both Current and Candidate identically cancels out of the replacement ratio.
- Chain effects that alter motion values, damage composition, anomaly formulas or stat-conversion rules require character-specific modeling and are not guessed.

A future character-mechanics dataset can populate these corrections automatically from character + chain selection.

## 9. Product / UX reference

### wuwacalc.cn — 南边道友TEIO
https://wuwacalc.cn

Bilibili introduction:
https://www.bilibili.com/video/BV1qTuh63E4c/

Used only as a product / interaction reference for making theorycrafting easier to enter and read in a browser. This project does not treat it as the sole damage-formula source and does not copy its UI, assets or private data.

## 10. Deferred Kuro account synchronization

Automatic login and player-data import are intentionally deferred.

The public Kuro data structures used by existing community tools can expose character level, chain list, weapon, attribute lists and equipped Echoes, but a GitHub Pages-only frontend is not an appropriate place to persist player authentication tokens.

If account sync is added later, it should use a separate backend/session layer and avoid embedding credentials in public frontend source.
