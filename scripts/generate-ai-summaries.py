#!/usr/bin/env python3
"""Generate AI summaries for posts with the DeepSeek API.

Reads content/posts/*.md, asks DeepSeek for a short Chinese summary of each
post and stores the result in enhancements/ai-summaries.json, keyed by the
post's permalink. The front end (enhancements/blog.js) renders it as the
"AI-摘要" card above the article.

A post is only sent to the API when it has no summary yet or its content
changed since the summary was made (tracked by a SHA-256 of title + body),
so re-running is cheap. Stdlib only.

    DEEPSEEK_API_KEY=sk-... python3 scripts/generate-ai-summaries.py [--force]

Without DEEPSEEK_API_KEY the script leaves the existing file untouched and
exits successfully, so CI does not fail before the secret is configured.
"""
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS_DIR = os.path.join(ROOT, 'content', 'posts')
OUTPUT = os.path.join(ROOT, 'enhancements', 'ai-summaries.json')

API_URL = os.environ.get('DEEPSEEK_API_URL', 'https://api.deepseek.com/chat/completions')
MODEL = os.environ.get('DEEPSEEK_MODEL', 'deepseek-chat')
MAX_INPUT_CHARS = 16000
REQUEST_TIMEOUT = 120
RETRIES = 3

SYSTEM_PROMPT = (
    '你是一个博客文章摘要助手。请阅读用户提供的文章，用简体中文写一段 120 到 220 字的摘要。'
    '要求：只输出摘要正文，不要标题、不要列表、不要 Markdown、不要引号；'
    '以“本文”开头，客观概括文章讨论的问题、采用的方法和主要结论；'
    '不要编造文章中没有的信息。'
)


def parse_post(path):
    text = open(path, encoding='utf-8').read()
    m = re.match(r'---\n(.*?)\n---\n(.*)', text, re.S)
    if not m:
        raise ValueError(f'{path}: no front matter')
    meta = {}
    for line in m.group(1).splitlines():
        key, sep, value = line.partition(':')
        if sep:
            meta[key.strip()] = value.strip()
    permalink = meta.get('permalink', '')
    if not permalink:
        raise ValueError(f'{path}: front matter has no permalink')
    if not permalink.endswith('/'):
        permalink += '/'
    return meta.get('title', ''), permalink, m.group(2)


def plain_text(markdown):
    text = re.sub(r'<[^>]+>', ' ', markdown)
    text = re.sub(r'!\[[^\]]*\]\([^)]*\)', ' ', text)
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()[:MAX_INPUT_CHARS]


def content_hash(title, body):
    return hashlib.sha256((title + '\n' + body).encode('utf-8')).hexdigest()


def request_summary(api_key, title, body):
    payload = json.dumps({
        'model': MODEL,
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': f'标题：{title}\n\n正文：\n{body}'},
        ],
        'temperature': 0.3,
        'max_tokens': 600,
        'stream': False,
    }).encode('utf-8')
    req = urllib.request.Request(API_URL, data=payload, method='POST', headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    })
    last_error = None
    for attempt in range(RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                data = json.load(resp)
            summary = data['choices'][0]['message']['content'].strip()
            summary = re.sub(r'\s+', ' ', summary).strip('"“”')
            if not summary:
                raise ValueError('empty summary')
            return summary
        except urllib.error.HTTPError as e:
            last_error = f'HTTP {e.code}: {e.read().decode("utf-8", "replace")[:300]}'
            if e.code in (400, 401, 402, 403):
                break  # bad request, bad key or no balance: retrying will not help
        except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError) as e:
            last_error = repr(e)
        time.sleep(2 ** (attempt + 1))
    raise RuntimeError(last_error)


def main():
    force = '--force' in sys.argv[1:]
    api_key = os.environ.get('DEEPSEEK_API_KEY', '').strip()
    if not api_key:
        print('DEEPSEEK_API_KEY is not set; leaving AI summaries unchanged.')
        return 0

    try:
        existing = json.load(open(OUTPUT, encoding='utf-8'))
    except FileNotFoundError:
        existing = {}

    result, generated, failed = {}, 0, 0
    for fn in sorted(os.listdir(POSTS_DIR)):
        if not fn.endswith('.md'):
            continue
        title, permalink, raw_body = parse_post(os.path.join(POSTS_DIR, fn))
        body = plain_text(raw_body)
        digest = content_hash(title, body)
        old = existing.get(permalink)
        if old and old.get('hash') == digest and not force:
            result[permalink] = old
            continue
        try:
            summary = request_summary(api_key, title, body)
        except RuntimeError as e:
            print(f'FAILED {permalink}: {e}', file=sys.stderr)
            failed += 1
            if old:
                result[permalink] = old  # keep the stale summary rather than none
            continue
        result[permalink] = {
            'title': title,
            'summary': summary,
            'hash': digest,
            'model': MODEL,
            'generated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        }
        generated += 1
        print(f'generated {permalink}')

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write('\n')
    print(f'{generated} generated, {len(result) - generated} unchanged, {failed} failed')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
