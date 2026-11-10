#!/usr/bin/env python3
"""Keep each post page's derived information in step with the article.

The post HTML under /YYYY/MM/DD/slug/ is edited by hand next to its
Markdown source, so everything computed from the article goes stale
when the text changes. For every post in content/posts this script
recomputes, from the live page's article and the front matter:

  * the "更新于" date (front matter `updated`, else `date`) in the page
    header, the crawler header and GLOBAL_CONFIG_SITE.postUpdate, which
    the outdated-post notice reads;
  * the word count and reading time (hexo-wordcount's rules: CJK
    characters plus Latin words; 300 CJK characters or 160 words a
    minute);
  * the sidebar table of contents, from the article's h2-h4 headings;
  * the preview mirror's copy of the page;
  * the local search index (enhancements/search.json, live and preview);
  * the site-wide word total shown in every page's sidebar.

Nothing is written unless every expected anchor is found, so a page
whose markup has changed fails loudly instead of being half-edited.
Stdlib only:

    python3 scripts/sync-post-pages.py
"""
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS_DIR = os.path.join(ROOT, 'content', 'posts')
TREES = [('', ''), ('preview', '/preview')]  # (directory, URL prefix)
ARTICLE_OPEN = '<article class="post-content" id="article-container"'
ARTICLE_CLOSE = '</article>'
CN_PER_MINUTE = 300
EN_PER_MINUTE = 160


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def load_posts():
    posts = []
    for fn in sorted(os.listdir(POSTS_DIR)):
        if not fn.endswith('.md'):
            continue
        text = read(os.path.join(POSTS_DIR, fn))
        m = re.match(r'---\n(.*?)\n---\n', text, re.S)
        if not m:
            raise ValueError(f'{fn}: no front matter')
        meta = {}
        for line in m.group(1).splitlines():
            key, sep, value = line.partition(':')
            if sep:
                meta[key.strip()] = value.strip()
        permalink = meta['permalink']
        if not permalink.endswith('/'):
            permalink += '/'
        date = meta['date'][:10]
        posts.append({
            'title': meta['title'],
            'permalink': permalink,
            'date': date,
            'updated': (meta.get('updated') or date)[:10],
        })
    posts.sort(key=lambda p: p['date'], reverse=True)
    return posts


def page_path(tree_dir, permalink):
    return os.path.join(ROOT, tree_dir, permalink.strip('/'), 'index.html')


def article_span(page, path):
    start = page.find(ARTICLE_OPEN)
    end = page.find(ARTICLE_CLOSE, start)
    if start < 0 or end < 0:
        raise ValueError(f'{path}: article container not found')
    return start, end + len(ARTICLE_CLOSE)


def sub_once(pattern, repl, text, what, path, required=True):
    new, n = re.subn(pattern, repl, text, flags=re.S)
    if n > 1 or (required and n == 0):
        raise ValueError(f'{path}: expected one {what}, found {n}')
    return new


def article_text(article):
    body = re.sub(r'<style.*?</style>', '', article, flags=re.S)
    body = re.sub(r'<header>.*?</header>', '', body, count=1, flags=re.S)
    text = html.unescape(re.sub(r'<[^>]+>', ' ', body))
    return re.sub(r'\s+', ' ', text).strip()


def count_words(text):
    cn = len(re.findall(r'[一-龥]', text))
    rest = re.sub(r'[一-龥]', '', text)
    en = len(re.findall(
        r'[a-zA-Z0-9_Β-ωЀ-ӿ]+'
        r'|[一-鿿㐀-䶿豈-﫿぀-ゟ가-힯Ѐ-ӿ]+'
        r'|[äÄåÅöÖ]+|\w+', rest))
    minutes = max(1, int(cn / CN_PER_MINUTE + en / EN_PER_MINUTE))
    return cn + en, minutes


def format_total(count):
    return str(count) if count < 1000 else f'{round(count / 100) / 10:g}k'


def build_toc(article):
    """Nested <ol class="toc"> from the article's h2-h4 headings that have ids."""
    headings = [
        (int(level), hid, html.escape(html.unescape(re.sub(r'<[^>]+>', '', inner)).strip()))
        for level, hid, inner in re.findall(r'<h([2-4])[^>]*\bid="([^"]+)"[^>]*>(.*?)</h\1>', article, re.S)
    ]
    if not headings:
        return None
    out, stack = ['<ol class="toc">'], []
    for level, hid, text in headings:
        while stack and stack[-1] > level:
            out.append('</li></ol>')
            stack.pop()
        if stack and stack[-1] == level:
            out.append('</li>')
        else:
            if stack:
                out.append('<ol class="toc-child">')
            stack.append(level)
        out.append(f'<li class="toc-item toc-level-{level}"><a class="toc-link" href="#{hid}">'
                   f'<span class="toc-text">{text}</span></a>')
    while stack:
        out.append('</li></ol>')
        stack.pop()
    return ''.join(out)


def replace_toc(page, toc, path):
    start = page.find('<ol class="toc">')
    if start < 0 or toc is None:
        return page
    if page.find('<ol class="toc">', start + 1) >= 0:
        raise ValueError(f'{path}: more than one table of contents')
    depth = 0
    for m in re.finditer(r'<ol\b|</ol>', page[start:]):
        depth += 1 if m.group(0) == '<ol' else -1
        if depth == 0:
            return page[:start] + toc + page[start + m.end():]
    raise ValueError(f'{path}: unbalanced table of contents')


def with_updated_in_crawler_header(article, updated):
    def fix(header):
        times = list(re.finditer(r'<time\b[^>]*>[^<]*</time>', header.group(0)))
        if len(times) != 2:
            return header.group(0)
        tag = (f'<time datetime="{updated}T04:00:00.000Z" itemprop="dateModified" '
               f'title="更新于 {updated}">{updated}</time>')
        h = header.group(0)
        return h[:times[1].start()] + tag + h[times[1].end():]
    return re.sub(r'<header>.*?</header>', fix, article, count=1, flags=re.S)


def sync_page(page, path, article, post, words, minutes, toc):
    start, end = article_span(page, path)
    page = page[:start] + article + page[end:]
    updated = post['updated']
    page = sub_once(
        r'<time class="post-meta-date-updated"[^>]*>[^<]*</time>',
        f'<time class="post-meta-date-updated" datetime="{updated}T04:00:00.000Z" '
        f'itemprop="dateModified" title="更新于 {updated}">{updated}</time>',
        page, 'updated date', path)
    page = sub_once(r"postUpdate: '[^']*'", f"postUpdate: '{updated} 12:00:00'", page, 'postUpdate', path)
    page = sub_once(r'(<span class="word-count"[^>]*>)[^<]*(</span>)', rf'\g<1>{words}\g<2>',
                    page, 'word count', path)
    page = sub_once(r'(阅读时长:</span><span>)[^<]*(</span>)', rf'\g<1>{minutes}分钟\g<2>',
                    page, 'reading time', path)
    return replace_toc(page, toc, path)


def prefixed(article, prefix):
    """Point root-relative links in the article at the given tree."""
    if not prefix:
        return article
    return re.sub(r'((?:href|src)=")/(?!/)', rf'\g<1>{prefix}/', article)


def main():
    posts = load_posts()
    writes = {}  # path -> new content, written only if everything succeeds
    index = {tree_dir: [] for tree_dir, _ in TREES}
    total_words = 0

    for post in posts:
        live_path = page_path('', post['permalink'])
        live = read(live_path)
        start, end = article_span(live, live_path)
        article = with_updated_in_crawler_header(live[start:end], post['updated'])
        text = article_text(article)
        words, minutes = count_words(text)
        total_words += words
        toc = build_toc(article)

        for tree_dir, prefix in TREES:
            path = page_path(tree_dir, post['permalink'])
            if not os.path.exists(path):
                continue
            old = live if tree_dir == '' else read(path)
            new = sync_page(old, path, prefixed(article, prefix), post, words, minutes, toc)
            if new != old:
                writes[path] = new
            index[tree_dir].append({
                'title': post['title'],
                'url': prefix + post['permalink'],
                'text': text,
                'date': post['date'],
                'minutes': minutes,
            })

    for tree_dir, _ in TREES:
        path = os.path.join(ROOT, tree_dir, 'enhancements', 'search.json')
        if not os.path.exists(path):
            continue
        new = json.dumps(index[tree_dir], ensure_ascii=False, indent=2) + '\n'
        if new != read(path):
            writes[path] = new

    total = format_total(total_words)
    total_re = re.compile(r'(全站字数 :</div></div><div class="item-count">)[^<]+')
    for dirpath, dirnames, filenames in os.walk(ROOT):
        if dirpath == ROOT:
            dirnames[:] = [d for d in dirnames if d not in ('.git', '.github', 'content', 'scripts')]
        for fn in filenames:
            if not fn.endswith('.html'):
                continue
            path = os.path.join(dirpath, fn)
            old = writes.get(path) or read(path)
            new = total_re.sub(rf'\g<1>{total}', old)
            if new != read(path):
                writes[path] = new

    for path, content in writes.items():
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
    print(f'{len(posts)} post(s), {total} words in total, {len(writes)} file(s) updated')
    return 0


if __name__ == '__main__':
    sys.exit(main())
