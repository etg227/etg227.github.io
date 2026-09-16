var posts=["2025/04/20/post/","2025/04/20/test/","2025/01/14/hello-world/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };

(function () {
  const isWuwaPage = () => /^\/wuwa\/?$/.test(window.location.pathname);

  function ensureWuwaToolbox() {
    if (!isWuwaPage()) {
      document.body && document.body.classList.remove('wuwa-toolbox-mounted');
      return;
    }

    if (!document.getElementById('wuwa-toolbox-css')) {
      const link = document.createElement('link');
      link.id = 'wuwa-toolbox-css';
      link.rel = 'stylesheet';
      link.href = '/wuwa/toolbox.css?v=20260916';
      document.head.appendChild(link);
    }

    if (window.mountWuwaToolbox) {
      window.mountWuwaToolbox();
      return;
    }

    if (!document.getElementById('wuwa-toolbox-js')) {
      const script = document.createElement('script');
      script.id = 'wuwa-toolbox-js';
      script.src = '/wuwa/toolbox.js?v=20260916';
      script.defer = true;
      document.head.appendChild(script);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureWuwaToolbox, { once: true });
  } else {
    ensureWuwaToolbox();
  }

  document.addEventListener('pjax:complete', function () {
    setTimeout(ensureWuwaToolbox, 0);
  });
})();