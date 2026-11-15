#!/usr/bin/env python3
"""Tiny UI helper for smoke tests: find on-screen text in a uiautomator dump.

usage: ui.py find <dump.xml> <text>   -> prints "x y" centre of the first node whose text or
                                         content-desc contains <text> (case-insensitive; prefix with = for an exact text match), exit 1 if none
       ui.py has  <dump.xml> <text>   -> exit 0 if present
"""
import html, re, sys

def nodes(path):
    xml = open(path, encoding="utf-8", errors="replace").read()
    for m in re.finditer(r"<node [^>]*>", xml):
        n = m.group(0)
        text = html.unescape((re.search(r' text="([^"]*)"', n) or [None, ""])[1])
        desc = html.unescape((re.search(r' content-desc="([^"]*)"', n) or [None, ""])[1])
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if b:
            x1, y1, x2, y2 = map(int, b.groups())
            yield text, desc, ((x1 + x2) // 2, (y1 + y2) // 2)

def texts(path):
    xml = open(path, encoding="utf-8", errors="replace").read()
    for m in re.finditer(r"<node [^>]*>", xml):
        n = m.group(0)
        t = html.unescape((re.search(r' text="([^"]*)"', n) or [None, ""])[1])
        if t:
            checked = ' [checked]' if 'checked="true"' in n else ''
            print("   |", t[:90] + checked)

def main():
    if sys.argv[1] == "texts":
        texts(sys.argv[2]); return
    cmd, path, needle = sys.argv[1], sys.argv[2], sys.argv[3].lower()
    exact = needle.startswith("=")
    if exact:
        needle = needle[1:]
    for text, desc, (x, y) in nodes(path):
        t, d = text.lower().strip(), desc.lower()
        hit = (t == needle) if exact else (needle in t or (needle in d and not t))
        if hit:
            if cmd == "find":
                print(x, y)
            sys.exit(0)
    sys.exit(1)

main()
