# WuWa Echo Marginal Calculator / 鸣潮声骸边际收益计算器

一个纯前端、可直接部署到 GitHub Pages 的《鸣潮》声骸理论工具。它不以固定 CV 或“几有效”作为最终评价，而是根据角色当前战斗状态、队伍 Buff 覆盖和输出窗口，计算声骸副词条的 **实际边际伤害收益**。

## 功能

- **旧声骸 vs 候选声骸**：直接给出整轮理论提升百分比。
- **副词条边际贡献**：把候选声骸的 5 条副词条逐条拿掉，计算每一条实际贡献。
- **队伍 Buff 库**：支持 ATK/HP/DEF%、固定属性、CR、CD、ER、Damage Bonus、Amplify/加深。
- **Buff 覆盖窗口**：把一轮输出拆成多个窗口，每个窗口独立勾选生效 Buff；同一技能跨 Buff 前后时可拆为两个窗口，因此不会用“全程覆盖”粗略近似。
- **混合倍率属性**：每个输出窗口可独立选择 ATK / HP / DEF 作为倍率属性。
- **标准词条边际排序**：在当前队伍环境下比较 CR、CD、大/小攻击、大/小生命、大/小防御、四类伤害副词条。
- **稀释边界**：数值求解“爆伤 vs 大攻”“爆伤 vs 主输出类型伤”“暴击 vs 暴伤”等当前配置下的收益交点。
- **ER 阈值提醒**：ER 被视为阈值属性，不伪造固定伤害换算。
- **跨队伍对比**：记录不同配队下，同一候选声骸的提升幅度。
- **配置保存 / JSON 导入导出**：所有计算在浏览器本地完成。

## 为什么用“输出窗口”而不是简单 Buff 覆盖率？

如果两个 Buff 同时覆盖爆发段，它们之间存在真实的重叠关系。把“Buff A 覆盖 70%、Buff B 覆盖 60%”分别平均到面板，会丢失相关性。

本工具让用户把当前一轮伤害拆成窗口，例如：

- 共鸣技能爆发段：40%，攻击 Buff + 暴伤 Buff + 技能 Amplify 全开
- 共鸣解放段：30%，只有攻击 Buff + 暴伤 Buff
- 普攻收尾：30%，只有攻击 Buff

在每个窗口内，工具计算候选/当前的精确倍率，再用 **当前配装下该窗口伤害占比** 加权：

```text
单窗口换装倍率 = CandidateFactor / CurrentFactor
整轮换装倍率 = Σ(当前窗口伤害占比 × 单窗口换装倍率)
```

这特别适合研究“角色自拐爆伤很高以后，声骸爆伤为什么开始输给大攻/类型伤”以及“换辅助以后同一条副词条为什么价值变化”。

## 核心公式

```text
属性 = 当前总属性 - 旧声骸贡献 + 新声骸贡献 + 基础属性 × Buff% + 固定 Buff

期望暴击乘区 = 1 + min(CR, 100%) × (CD - 100%)

伤害加成乘区 = 1 + 全局/属性伤害加成 + 对应攻击类型伤害加成
Amplify 乘区 = 1 + 全局 Amplify + 对应攻击类型 Amplify

窗口 Factor = 属性 × 伤害加成乘区 × Amplify 乘区 × 期望暴击乘区
```

工具专注 **相对声骸收益**。技能倍率、防御、抗性以及与两件声骸无关的独立乘区，在同一输出窗口中比较候选/当前时会约掉。如果这些因素让某个输出窗口在整轮中占比改变，应把变化反映到“当前伤害占比”里。

## 数据与 Reference

Reference snapshot: **2026-09-16 / game v3.6**。

1. [Wuthering Tools — Info](https://www.wutheringtools.com/info)  
   社区伤害计算口径：属性、MV、Amplify、Damage Bonus、Crit、防御与抗性。

2. [鳴潮 Wiki* — ダメージ計算式](https://wikiwiki.jp/w-w/%E3%83%80%E3%83%A1%E3%83%BC%E3%82%B8%E8%A8%88%E7%AE%97%E5%BC%8F)  
   页面更新于 2026-08-13；用于交叉核对攻击力公式、乘区划分、暴击期望与 1:2 推导、防御/耐性说明。

3. [Prydwen — Echoes Stats](https://www.prydwen.gg/wuthering-waves/guides/echo-stats)  
   声骸副词条范围，例如 CR 6.3–10.5%、CD 12.6–21.0%、ATK%/HP% 6.4–11.6% 等。

4. [鳴潮 Wiki* — 音骸/厳選と確率](https://wikiwiki.jp/w-w/%E9%9F%B3%E9%AA%B8/%E5%8E%B3%E9%81%B8%E3%81%A8%E7%A2%BA%E7%8E%87)  
   副词条离散档位与公开概率整理。

5. 开源实现交叉检查：  
   - [chuan-hane/wuwa-damage-calculator](https://github.com/chuan-hane/wuwa-damage-calculator)  
   - [devyur/Wuwa-rotation-calculator](https://github.com/devyur/Wuwa-rotation-calculator)

### 免责声明

这是非官方 fan-made theory tool。完整伤害机制并非由 Kuro Games 以“官方计算器”的形式公开；本项目区分社区实测与官方游戏内描述，不把社区公式标成官方公式。新角色可能包含特殊倍率、异常效果、独立乘区或特殊属性转换，需要单独建模。

## 本地运行

无需构建：

```bash
python -m http.server 8080
```

然后打开 `http://localhost:8080/`。

也可以直接打开 `index.html`，但使用本地 HTTP server 更接近 GitHub Pages 环境。

## 技术

- HTML5
- CSS3
- Vanilla JavaScript
- 无第三方运行时依赖
- 数据只保存在浏览器 `localStorage`

## License

MIT
