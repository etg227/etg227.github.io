(() => {
  const TOOL_PATH = '/tools/wuwa-echo-calculator/?embed=blog';
  const ROOT_ID = 'wuwa-toolbox-root';
  const FRAME_ID = 'wuwa-calculator-frame';

  const isWuwaPage = () => /^\/wuwa\/?$/.test(window.location.pathname);

  const getThemeValue = (name, fallback) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  };

  const frameThemeCss = () => {
    const main = getThemeValue('--anzhiyu-main', '#425AEF');
    const card = getThemeValue('--anzhiyu-card-bg', document.documentElement.dataset.theme === 'dark' ? '#1d1e20' : '#ffffff');
    const soft = getThemeValue('--anzhiyu-secondbg', document.documentElement.dataset.theme === 'dark' ? '#242629' : '#f7f9fe');
    const text = getThemeValue('--anzhiyu-fontcolor', document.documentElement.dataset.theme === 'dark' ? '#f1f1f1' : '#363636');
    const muted = getThemeValue('--anzhiyu-secondtext', document.documentElement.dataset.theme === 'dark' ? '#a8a8a8' : '#858585');
    const border = getThemeValue('--anzhiyu-card-border', document.documentElement.dataset.theme === 'dark' ? 'rgba(255,255,255,.10)' : 'rgba(60,60,67,.12)');
    const isDark = document.documentElement.dataset.theme === 'dark';

    return `
      :root {
        --bg: transparent !important;
        --panel: ${card} !important;
        --panel2: ${soft} !important;
        --line: ${border} !important;
        --text: ${text} !important;
        --muted: ${muted} !important;
        --accent: ${main} !important;
        --accent2: ${main} !important;
        --shadow: none !important;
        color-scheme: ${isDark ? 'dark' : 'light'};
      }
      html, body { background: transparent !important; }
      body { color: ${text} !important; }
      .site-header, .site-footer { display: none !important; }
      .wrap { width: 100% !important; max-width: none !important; }
      .main-grid { padding: 16px !important; gap: 14px !important; }
      .panel {
        background: ${card} !important;
        border-color: ${border} !important;
        border-radius: 14px !important;
        box-shadow: none !important;
      }
      .intro-panel { background: ${soft} !important; }
      .step {
        background: color-mix(in srgb, ${main} 12%, transparent) !important;
        color: ${main} !important;
      }
      h1, h2, h3, strong, .stat-row > span, summary, .bar-label { color: ${text} !important; }
      .micro, .hint, .status-pill, label, .metric-card span, .coverage-item, .boundary-card span { color: ${muted} !important; }
      input, select, .metric-card, .boundary-card, .segment-card, .formula-strip span, .stat-head, .data-table th, pre {
        background: ${soft} !important;
        color: ${text} !important;
        border-color: ${border} !important;
      }
      .stat-table, .table-scroll, details, .stat-row, .data-table td, .data-table th { border-color: ${border} !important; }
      button {
        background: ${soft} !important;
        color: ${text} !important;
        border-color: ${border} !important;
      }
      button.primary {
        background: ${main} !important;
        border-color: ${main} !important;
        color: #fff !important;
      }
      .callout, .callout.subtle, .callout.warning, .metric-card.accent {
        background: color-mix(in srgb, ${main} ${isDark ? '10%' : '7%'}, ${card}) !important;
        color: ${text} !important;
        border-color: ${main} !important;
      }
      .bar-track { background: ${soft} !important; border-color: ${border} !important; }
      .bar-fill { background: ${main} !important; }
      .buff-chip { background: ${soft} !important; color: ${muted} !important; border-color: ${border} !important; }
      .buff-chip.active { background: color-mix(in srgb, ${main} 12%, ${card}) !important; color: ${main} !important; border-color: ${main} !important; }
      a, .bar-value, .formula-strip b, .coverage-item b { color: ${main} !important; }
      @media (max-width: 620px) {
        .main-grid { padding: 10px !important; }
        .panel { border-radius: 12px !important; }
      }
    `;
  };

  const syncFrameTheme = frame => {
    try {
      const doc = frame.contentDocument;
      if (!doc || !doc.head) return;
      let style = doc.getElementById('wuwa-blog-embed-theme');
      if (!style) {
        style = doc.createElement('style');
        style.id = 'wuwa-blog-embed-theme';
        doc.head.appendChild(style);
      }
      style.textContent = frameThemeCss();
    } catch (err) {
      console.warn('[WuWa toolbox] unable to sync iframe theme', err);
    }
  };

  const setupAutoHeight = frame => {
    let raf = 0;
    const resize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          const doc = frame.contentDocument;
          if (!doc) return;
          const height = Math.max(
            doc.body?.scrollHeight || 0,
            doc.documentElement?.scrollHeight || 0,
            720
          );
          frame.style.height = `${height + 4}px`;
        } catch (err) {
          frame.style.height = '5200px';
        }
      });
    };

    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      const observer = new ResizeObserver(resize);
      observer.observe(doc.documentElement);
      doc.body && observer.observe(doc.body);
      const mutation = new MutationObserver(resize);
      mutation.observe(doc.body || doc.documentElement, { childList: true, subtree: true, attributes: true });
      frame.__wuwaResizeObserver = observer;
      frame.__wuwaMutationObserver = mutation;
      resize();
      setTimeout(resize, 200);
      setTimeout(resize, 800);
    } catch (err) {
      frame.style.height = '5200px';
    }
  };

  const toolboxHtml = () => `
    <div class="wuwa-toolbox-hero">
      <div class="wuwa-toolbox-kicker">鸣潮工具箱 · Theory Lab</div>
      <h2>声骸边际收益计算器</h2>
      <p>不再只看 CV 或“几有效”。把角色战斗态、队友 Buff、输出窗口与副词条稀释一起放进模型，直接比较一只声骸在你当前配队里究竟能提升多少。</p>
      <div class="wuwa-toolbox-tags" aria-label="功能标签">
        <span class="wuwa-toolbox-tag">副词条边际收益</span>
        <span class="wuwa-toolbox-tag">队伍 Buff 覆盖</span>
        <span class="wuwa-toolbox-tag">输出窗口拆分</span>
        <span class="wuwa-toolbox-tag">收益边界</span>
        <span class="wuwa-toolbox-tag">不同配队对比</span>
      </div>
      <div class="wuwa-toolbox-meta">
        <span>公式依据与数据源：见计算器底部 Reference</span>
        <span>产品交互参考：<a href="https://wuwacalc.cn" target="_blank" rel="noreferrer">wuwacalc.cn</a> · <a href="https://www.bilibili.com/video/BV1qTuh63E4c/" target="_blank" rel="noreferrer">南边道友TEIO</a></span>
      </div>
    </div>

    <section class="wuwa-tool-shell" aria-label="鸣潮声骸计算器">
      <div class="wuwa-tool-shell-head">
        <div class="wuwa-tool-title">
          <strong>Echo Marginal Calculator</strong>
          <span>配置会保存在当前浏览器；独立页面与博客内版本共用同一套计算引擎。</span>
        </div>
        <div class="wuwa-tool-actions">
          <a href="/tools/wuwa-echo-calculator/" target="_blank" rel="noreferrer">独立打开</a>
          <a href="https://github.com/etg227/etg227.github.io/tree/main/tools/wuwa-echo-calculator" target="_blank" rel="noreferrer">源码 / Reference</a>
        </div>
      </div>
      <div class="wuwa-tool-embed-wrap">
        <div class="wuwa-tool-loading" id="wuwa-tool-loading"><span class="wuwa-tool-loading-dot"></span>正在载入计算引擎…</div>
        <iframe id="${FRAME_ID}" title="鸣潮声骸边际收益计算器" src="${TOOL_PATH}" loading="eager"></iframe>
      </div>
    </section>

    <div class="wuwa-toolbox-note">
      说明：wuwacalc.cn 在这里作为产品交互与低门槛数据工具的参考，不作为本计算器伤害公式的唯一来源。伤害公式、声骸词条范围及社区实测来源均单独列在 Reference 中。
    </div>
  `;

  const mount = () => {
    if (!isWuwaPage()) {
      document.body?.classList.remove('wuwa-toolbox-mounted');
      return;
    }

    const container = document.getElementById('article-container');
    if (!container) return;
    document.body.classList.add('wuwa-toolbox-mounted');

    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      root.innerHTML = toolboxHtml();
      container.prepend(root);
    }

    const frame = document.getElementById(FRAME_ID);
    if (!frame || frame.dataset.wuwaBound === '1') return;
    frame.dataset.wuwaBound = '1';

    frame.addEventListener('load', () => {
      syncFrameTheme(frame);
      setupAutoHeight(frame);
      document.getElementById('wuwa-tool-loading')?.classList.add('is-ready');
    });

    if (frame.contentDocument?.readyState === 'complete') {
      syncFrameTheme(frame);
      setupAutoHeight(frame);
      document.getElementById('wuwa-tool-loading')?.classList.add('is-ready');
    }
  };

  window.mountWuwaToolbox = mount;

  const themeObserver = new MutationObserver(() => {
    const frame = document.getElementById(FRAME_ID);
    if (frame) syncFrameTheme(frame);
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
  document.addEventListener('pjax:complete', () => setTimeout(mount, 0));
})();
