#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把拆分版（index.html + style.css + rules.js + app.js）内联成一个单文件 HTML。

用途：单文件版可以直接发给同学 / 离线双击，不用带一整个文件夹。
源码仍以拆分版为准，改完跑一次这个脚本就行。

用法：python build.py
产物：dist/c-error-helper-单文件版.html
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
CSS = "style.css"
JS = ["rules.js", "app.js"]          # 顺序不能反：rules.js 提供数据，app.js 用数据
OUT = os.path.join(HERE, "dist", "c-error-helper-单文件版.html")


def main():
    html = open(os.path.join(HERE, "index.html"), encoding="utf-8").read()
    css = open(os.path.join(HERE, CSS), encoding="utf-8").read()
    js = [open(os.path.join(HERE, f), encoding="utf-8").read() for f in JS]

    if '<link rel="stylesheet" href="%s">' % CSS not in html:
        raise SystemExit("index.html 里没找到 style.css 的引用，源码结构变了？")
    html = html.replace('<link rel="stylesheet" href="%s">' % CSS, "<style>\n%s\n</style>" % css)

    tags = "".join('<script src="%s"></script>\n' % f for f in JS).rstrip("\n")
    if tags not in html:
        raise SystemExit("index.html 里没找到 script 引用，源码结构变了？")
    html = html.replace(tags, "<script>\n%s\n</script>" % "\n".join(js))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    print("已生成 %s（%d 字节）" % (OUT, len(html.encode())))
    print("自检：内联 script 数 =", html.count("<script>"), "| 还剩 src 引用 =", html.count('src="rules.js"') + html.count('src="app.js"'))


if __name__ == "__main__":
    main()
