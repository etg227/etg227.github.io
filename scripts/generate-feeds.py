#!/usr/bin/env python3
"""Generate atom.xml, sitemap.xml and robots.txt for blog.etg227.com.

Posts are read from content/posts/*.md front matter (title, date,
permalink, tags, categories). Site pages are discovered by walking the
repository for index.html files, excluding the preview mirror and
non-page directories. Stdlib only; run from anywhere:

    python3 scripts/generate-feeds.py
"""
import html
import os
import re
import sys
from datetime import datetime, timezone
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://blog.etg227.com'
TITLE = '花澪'
SUBTITLE = '你所弹奏的声音，至今仍在回响'
AUTHOR = '花澪'
FEED_MAX_ENTRIES = 20
SUMMARY_MAX_CHARS = 200

# directories that never contain site pages
EXCLUDE_TOP = {'preview', 'content', 'scripts', '.github', '.git'}
# page paths to leave out of the sitemap
EXCLUDE_PAGES = {'/404.html'}


def parse_front_matter(path):
    text = open(path, encoding='utf-8').read()
    m = re.match(r'---\n(.*?)\n---\n(.*)', text, re.S)
    if not m:
        raise ValueError(f'{path}: no front matter')
    meta = {}
    for line in m.group(1).splitlines():
        if ':' not in line:
            continue
        key, _, value = line.partition(':')
        meta[key.strip()] = value.strip()
    for key in ('tags', 'categories'):
        raw = meta.get(key, '')
        meta[key] = [t.strip() for t in raw.strip('[]').split(',') if t.strip()]
    return meta, m.group(2)


def extract_summary(body):
    text = re.sub(r'<[^>]+>', ' ', body)               # html tags
    text = re.sub(r'^#{1,6} .*$', ' ', text, flags=re.M)  # headings
    text = re.sub(r'^\|.*$', ' ', text, flags=re.M)    # tables
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text)  # links
    text = re.sub(r'[*_`>#]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) > SUMMARY_MAX_CHARS:
        text = text[:SUMMARY_MAX_CHARS].rstrip() + '……'
    return text


def post_datetime(meta):
    value = meta['date']
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return datetime.fromisoformat(value)


def load_posts():
    posts = []
    posts_dir = os.path.join(ROOT, 'content', 'posts')
    for fn in sorted(os.listdir(posts_dir)):
        if not fn.endswith('.md'):
            continue
        meta, body = parse_front_matter(os.path.join(posts_dir, fn))
        permalink = meta['permalink']
        if not permalink.endswith('/'):
            permalink += '/'
        posts.append({
            'title': meta['title'],
            'url': SITE + permalink,
            'date': post_datetime(meta),
            'tags': meta['tags'] + meta['categories'],
            'summary': extract_summary(body),
        })
    posts.sort(key=lambda p: p['date'], reverse=True)
    return posts


def discover_pages():
    pages = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        rel = os.path.relpath(dirpath, ROOT)
        if rel == '.':
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_TOP]
        if 'index.html' in filenames:
            url_path = '/' if rel == '.' else '/' + rel.replace(os.sep, '/') + '/'
            if url_path not in EXCLUDE_PAGES:
                pages.append(url_path)
    pages.sort()
    return pages


def write_atom(posts):
    updated = posts[0]['date'] if posts else datetime.now(timezone.utc)
    e = html.escape
    lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<feed xmlns="http://www.w3.org/2005/Atom">',
        f'  <title>{e(TITLE)}</title>',
        f'  <subtitle>{e(SUBTITLE)}</subtitle>',
        f'  <link href="{SITE}/atom.xml" rel="self"/>',
        f'  <link href="{SITE}/"/>',
        f'  <id>{SITE}/</id>',
        f'  <updated>{updated.isoformat()}</updated>',
        f'  <author><name>{e(AUTHOR)}</name></author>',
    ]
    for p in posts[:FEED_MAX_ENTRIES]:
        lines += [
            '  <entry>',
            f'    <title>{e(p["title"])}</title>',
            f'    <link href="{p["url"]}"/>',
            f'    <id>{p["url"]}</id>',
            f'    <published>{p["date"].isoformat()}</published>',
            f'    <updated>{p["date"].isoformat()}</updated>',
            f'    <summary>{e(p["summary"])}</summary>',
        ]
        lines += [f'    <category term="{e(t)}"/>' for t in p['tags']]
        lines.append('  </entry>')
    lines.append('</feed>')
    open(os.path.join(ROOT, 'atom.xml'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')


def write_sitemap(pages, posts):
    lastmod = {p['url']: p['date'].date().isoformat() for p in posts}
    lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for path in pages:
        url = SITE + quote(path)
        lines.append('  <url>')
        lines.append(f'    <loc>{html.escape(url)}</loc>')
        if url in lastmod:
            lines.append(f'    <lastmod>{lastmod[url]}</lastmod>')
        lines.append('  </url>')
    lines.append('</urlset>')
    open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')


def write_robots():
    content = (
        'User-agent: *\n'
        'Allow: /\n'
        'Disallow: /preview/\n'
        '\n'
        f'Sitemap: {SITE}/sitemap.xml\n'
    )
    open(os.path.join(ROOT, 'robots.txt'), 'w', encoding='utf-8').write(content)


def main():
    posts = load_posts()
    pages = discover_pages()
    write_atom(posts)
    write_sitemap(pages, posts)
    write_robots()
    print(f'atom.xml: {min(len(posts), FEED_MAX_ENTRIES)} entries')
    print(f'sitemap.xml: {len(pages)} urls')
    print('robots.txt written')


if __name__ == '__main__':
    sys.exit(main())
