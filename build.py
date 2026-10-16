#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把拆分版（index.html + style.css + theme.js + rules.js + app.js）内联成一个单文件 HTML。

用途：单文件版可以直接发给同学 / 离线双击，不用带一整个文件夹。
源码仍以拆分版为准，改完跑一次这个脚本就行。

用法：python build.py
产物：dist/c-error-helper-单文件版.html
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
CSS = "style.css"
JS = ["theme.js", "rules.js", "app.js"]   # 顺序不能反：theme.js 定主题，rules.js 供数据，app.js 用数据
OUT = os.path.join(HERE, "dist", "c-error-helper-单文件版.html")


def main():
    html = open(os.path.join(HERE, "index.html"), encoding="utf-8").read()
    css = open(os.path.join(HERE, CSS), encoding="utf-8").read()

    if '<link rel="stylesheet" href="%s">' % CSS not in html:
        raise SystemExit("index.html 里没找到 style.css 的引用，源码结构变了？")
    html = html.replace('<link rel="stylesheet" href="%s">' % CSS, "<style>\n%s\n</style>" % css)

    # 逐个替换：theme.js 在 <head> 里、rules.js/app.js 在 body 末尾，位置不连续，
    # 按「每个标签各自原地内联」处理，文档顺序天然保持不变。
    for f in JS:
        tag = '<script src="%s"></script>' % f
        if tag not in html:
            raise SystemExit("index.html 里没找到 %s 的引用，源码结构变了？" % f)
        code = open(os.path.join(HERE, f), encoding="utf-8").read()
        html = html.replace(tag, "<script>\n%s\n</script>" % code)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    print("已生成 %s（%d 字节）" % (OUT, len(html.encode())))
    left = sum(html.count('src="%s"' % f) for f in JS) + html.count('src="%s"' % CSS)
    print("自检：内联 script 数 =", html.count("<script>") - html.count('<script src='), "| 还剩资源引用 =", left)


if __name__ == "__main__":
    main()
