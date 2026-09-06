(() => {
  if (window.flowerBlogEnhancements) return;
  window.flowerBlogEnhancements = true;
  function setup() {
    const music = document.querySelector('#anMusic-page');
    if (music && !document.querySelector('[data-music-status]')) {
      const note = document.createElement('p');
      note.dataset.musicStatus = ''; note.className = 'blog-music-status';
      note.setAttribute('role','status'); note.textContent = '正在加载你的网易云歌单…';
      music.before(note);
      const update = () => { if (music.querySelector('.aplayer-list li')) note.hidden = true; };
      const observer = new MutationObserver(update);
      observer.observe(music,{childList:true,subtree:true}); update();
      const timeout = setTimeout(() => { if (!note.hidden) note.textContent = '歌单服务暂时未响应，可以通过上方链接在网易云打开原歌单。'; },12000);
      document.addEventListener('pjax:send', () => { observer.disconnect(); clearTimeout(timeout); }, {once:true});
    }
    const nav = document.querySelector('#nav-right');
    if (nav && !document.getElementById('flower-search-link')) {
      const a = document.createElement('a');
      a.id = 'flower-search-link'; a.href = '/preview/search/'; a.textContent = '搜索';
      a.className = 'site-page'; a.setAttribute('aria-label', '搜索文章'); nav.prepend(a);
    }
    const input = document.querySelector('[data-blog-search]');
    if (!input || input.dataset.ready) return;
    input.dataset.ready = 'true';
    const results = document.querySelector('[data-blog-results]');
    const status = document.querySelector('[data-blog-status]');
    let posts = [];
    function render() {
      const query = input.value.trim().toLocaleLowerCase();
      const terms = query.split(/\s+/).filter(Boolean);
      const matches = posts.filter(p => terms.every(t => (p.title + ' ' + p.text).toLocaleLowerCase().includes(t)));
      results.replaceChildren(); status.textContent = query ? `找到 ${matches.length} 篇文章` : `共 ${posts.length} 篇文章`;
      for (const p of matches) {
        const section = document.createElement('section'); section.className = 'blog-result';
        const link = document.createElement('a'); link.href = p.url; link.textContent = p.title;
        const excerpt = document.createElement('p');
        const pos = terms.length ? Math.max(0,p.text.toLocaleLowerCase().indexOf(terms[0])-35) : 0;
        excerpt.textContent = (pos ? '…' : '') + p.text.slice(pos,pos+180) + (p.text.length > pos+180 ? '…' : '');
        section.append(link,excerpt); results.append(section);
      }
    }
    input.addEventListener('input',render);
    fetch('/preview/enhancements/search.json').then(r => {if(!r.ok) throw Error('index');return r.json();}).then(data => {posts=data;render();}).catch(() => {status.textContent='搜索暂时无法加载，请刷新重试。';});
  }
  document.addEventListener('DOMContentLoaded',setup);
  document.addEventListener('pjax:complete',setup);
  setup();
})();
