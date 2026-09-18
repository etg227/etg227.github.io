#!/usr/bin/env python3
"""Post-build meta fixer for the Hexo output in this repo.

The Hexo source project currently emits relative canonical/og:url values and
placeholder site-verification tags. Until that is fixed at the source
(_config.yml `url:` + theme `site_verification`), run this after every
`hexo generate` (before committing the build) to:

  1. drop placeholder verification metas (content "xxx" / "code-xxx");
  2. rewrite canonical and og:url to the absolute page URL derived from the
     file path;
  3. absolutize og:image / twitter:image values that start with "/".

Usage:  python3 scripts/fix_build_meta.py [site_root]
The preview/ mirror is left untouched.
"""
import re
import sys
from pathlib import Path

SITE = 'https://blog.etg227.com'
OLD_SITES = ('https://etg227.github.io',)
PLACEHOLDERS = {'xxx', 'code-xxx'}
VERIFY_NAMES = ('google-site-verification', 'baidu-site-verification', 'msvalidate.01')

META_TAG = re.compile(r'<meta\b[^>]*>')
LINK_CANONICAL = re.compile(r'<link\b[^>]*rel="canonical"[^>]*>')
ATTR = lambda tag, name: (re.search(name + r'="([^"]*)"', tag) or [None, None])[1]


def page_url(path: Path, root: Path) -> str:
    rel = path.relative_to(root).as_posix()
    if rel == 'index.html':
        return SITE + '/'
    if rel.endswith('/index.html'):
        return SITE + '/' + rel[: -len('index.html')]
    return SITE + '/' + rel


def fix_file(path: Path, root: Path) -> bool:
    html = path.read_text(encoding='utf-8')
    original = html
    url = page_url(path, root)

    def meta_repl(m):
        tag = m.group(0)
        name = ATTR(tag, 'name')
        content = ATTR(tag, 'content')
        if name in VERIFY_NAMES and (content or '').strip() in PLACEHOLDERS:
            return ''
        prop = ATTR(tag, 'property')
        if prop == 'og:url' and content is not None and (not content.startswith('http') or content.startswith(OLD_SITES)):
            return tag.replace(f'content="{content}"', f'content="{url}"')
        if (prop == 'og:image' or name == 'twitter:image') and content:
            if content.startswith('/'):
                return tag.replace(f'content="{content}"', f'content="{SITE}{content}"')
            for old in OLD_SITES:
                if content.startswith(old):
                    return tag.replace(f'content="{content}"', f'content="{SITE}{content[len(old):]}"')
        return tag

    def canonical_repl(m):
        tag = m.group(0)
        href = ATTR(tag, 'href')
        if href is not None and (not href.startswith('http') or href.startswith(OLD_SITES)):
            return tag.replace(f'href="{href}"', f'href="{url}"')
        return tag

    html = META_TAG.sub(meta_repl, html)
    html = LINK_CANONICAL.sub(canonical_repl, html)
    if html != original:
        path.write_text(html, encoding='utf-8')
        return True
    return False


def main():
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
    changed = []
    for path in sorted(root.rglob('*.html')):
        rel = path.relative_to(root).as_posix()
        if rel.startswith(('preview/', '.git/')):
            continue
        if fix_file(path, root):
            changed.append(rel)
    print(f'fixed {len(changed)} file(s)')
    for rel in changed:
        print(' ', rel)


if __name__ == '__main__':
    main()
