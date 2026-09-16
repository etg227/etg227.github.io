# References and Methodology

Reference snapshot: **2026-09-16**. Intended for Wuthering Waves **v3.6** theorycrafting.

This project is an **unofficial fan-made theory tool**. It distinguishes between community-tested formulas and official in-game descriptions. Kuro Games does not provide a public, complete player-facing damage calculator for every combat mechanic.

## 1. Damage formula / multiplier structure

### Wuthering Tools — Info
https://www.wutheringtools.com/info

Used to cross-check the commonly implemented community formula structure:

```text
total scaler × motion value × amplify × damage bonus × crit × defense × resistance
```

and the attribute formula:

```text
(character base + weapon base) × (1 + percent bonuses) + flat bonuses
```

### 鳴潮 Wiki* — ダメージ計算式
https://wikiwiki.jp/w-w/%E3%83%80%E3%83%A1%E3%83%BC%E3%82%B8%E8%A8%88%E7%AE%97%E5%BC%8F

Last-modified on the cited page: **2026-08-13** at the time of this reference snapshot.

Used to cross-check:

- ATK formula.
- Separation of damage bonus / amplify-like / other multiplier categories.
- Expected Crit relationship and the derivation behind the familiar 1:2 CR : bonus-CD balance.
- Defense and resistance descriptions.

### Open-source implementations used for cross-checking

- https://github.com/chuan-hane/wuwa-damage-calculator
- https://github.com/devyur/Wuwa-rotation-calculator
- https://github.com/k4wai1/un-waves-optimizer

These are **implementation references**, not official Kuro Games specifications.

## 2. Echo substat ranges

### Prydwen — Echoes Stats
https://www.prydwen.gg/wuthering-waves/guides/echo-stats

Used for currently documented Rank 5 Echo substat ranges such as:

- Crit Rate: 6.3% – 10.5%
- Crit DMG: 12.6% – 21.0%
- ATK% / HP%: 6.4% – 11.6%
- DEF%: 8.1% – 14.7%
- Flat ATK: 30 – 60
- Flat HP: 320 – 580
- Flat DEF: 40 – 70
- Basic / Heavy / Resonance Skill / Resonance Liberation DMG Bonus: documented range around 6.4% – 11.6% on this source snapshot.

The calculator does not hard-lock the comparison roll values. Users can change the “standard roll” inputs because boundary analysis should not depend on one arbitrary roll tier.

### 鳴潮 Wiki* — 音骸/厳選と確率
https://wikiwiki.jp/w-w/%E9%9F%B3%E9%AA%B8/%E5%8E%B3%E9%81%B8%E3%81%A8%E7%A2%BA%E7%8E%87

Used to cross-check discrete Echo substat roll tiers and the probability table presented by that community wiki.

## 3. Crit expectation used by this project

The game UI displays Crit DMG including the base 100% hit. Therefore average critical multiplier is modeled as:

```text
E[Crit] = 1 + CR × (CD - 1)
```

where CR and CD are decimal values (75% -> 0.75, 250% -> 2.50), with CR capped at 100% for expected damage.

This is why additional Crit DMG suffers lower marginal returns when a character/team already supplies large Crit DMG buffs, while Crit Rate becomes more valuable until the 100% cap.

## 4. Why the calculator uses rotation windows

A simple uptime average is insufficient when buffs overlap. For example, a 70%-uptime ATK buff and a 60%-uptime Crit DMG buff may overlap almost completely or barely at all; those two cases produce different marginal stat values.

The project therefore asks the user to split the current rotation into **damage windows**. Each window contains:

- Current damage share of the rotation.
- Damage type.
- Scaling attribute (ATK / HP / DEF).
- Whether it can Crit.
- Exact active buff set.

For each window:

```text
window ratio = candidate factor / current factor
```

Then:

```text
overall ratio = Σ(current window damage share × window ratio)
```

Using the current build's actual damage shares means skill motion values, enemy defense/resistance and unrelated independent multipliers are already encoded in the weights. They cancel inside a same-window Candidate/Current comparison unless the Echo itself changes those mechanics.

## 5. Product / UX reference

### wuwacalc.cn — 南边道友TEIO
https://wuwacalc.cn

Bilibili launch / introduction video:
https://www.bilibili.com/video/BV1qTuh63E4c/

This project references **wuwacalc.cn as a product and interaction-design reference only**: low-friction data entry, making theorycrafting accessible outside spreadsheets, and presenting complex character/team data in a web interface.

It is **not treated as the sole source for the damage formulas in this calculator**, and this project does not copy its UI, assets, private data, or implementation. The blog-integrated version deliberately follows the visual language of the owner's AnZhiYu-based blog instead.

## 6. Scope and known limitations

The current model is intended for conventional direct damage whose Echo-relevant changes can be represented by:

- ATK / HP / DEF
- Crit Rate / Crit DMG
- Damage Bonus
- Amplify / Deepen
- Energy Regen threshold warning

Not automatically modeled:

- Character-specific additional motion-value multipliers.
- Negative-status / anomaly damage with a different formula.
- Special final-damage categories unique to a kit.
- Conversions where one stat dynamically converts into another.
- Rotation changes caused by Energy Regen; ER is treated as a threshold and the tool warns rather than inventing a DPS conversion.
- Main-stat, Sonata, weapon or Resonance Chain changes unless the user represents their buff effects in the Buff library / current panel.

For characters with special mechanics, create separate output windows and encode verified buffs where possible. If a mechanic changes the base formula itself, the calculator should be extended rather than forcing it into the generic model.
