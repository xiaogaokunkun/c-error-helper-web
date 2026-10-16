// 在 Node 里跑 index.html 的逻辑：桩掉 DOM，真实调用页面自己的函数与按钮 handler
// 用法： node test-webpage.js [html路径]      默认 D:/work/c-error-helper/index.html
// 说明：拆分版与内联单文件版都能测；改完源码（index.html/style.css/rules.js/app.js）后跑一次。
const fs = require('fs');
const vm = require('vm');

const HTML = process.argv[2] || 'D:/work/c-error-helper/index.html';
const html = fs.readFileSync(HTML, 'utf8');
const path = require('path');

// 兼容两种形态：内联 <script>…</script>（单文件版）与 <script src="x.js">（拆分版）
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let code;
if (inline.length) {
  inline.sort((a, b) => b.length - a.length);
  code = inline[0];
} else {
  const refs = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]);
  code = refs.map(r => `/* ==== ${r} ==== */\n` + fs.readFileSync(path.join(path.dirname(HTML), r), 'utf8')).join('\n;\n');
  console.log('按 src 顺序加载:', refs.join(' → '));
}
console.log('内联脚本长度:', code.length, '字符');

function El(id) {
  return {
    id, value: '', innerHTML: '', textContent: '', className: '', checked: false,
    style: { setProperty() {}, getPropertyValue() { return '' } },
    dataset: {}, hidden: false, disabled: false, files: [], options: [],
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c) }, remove(c) { this._s.delete(c) },
      toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c) } else { on ? this._s.add(c) : this._s.delete(c) } },
      contains(c) { return this._s.has(c) },
    },
    children: [], attributes: {}, offsetWidth: 0,
    appendChild(c) { this.children.push(c); return c },
    append(...c) { this.children.push(...c) },
    insertBefore(c) { this.children.push(c); return c },
    removeChild() {}, remove() {},
    setAttribute(k, v) { this.attributes[k] = v },
    getAttribute(k) { return this.attributes[k] ?? null },
    removeAttribute() {},
    addEventListener() {}, removeEventListener() {},
    querySelector(s) { return El(id + ' ' + s) },
    querySelectorAll() { return [] },
    click() { if (typeof this.onclick === 'function') this.onclick(); },
    focus() {}, blur() {}, select() {}, scrollIntoView() {},
    cloneNode() { return El(id + '-clone') },
    closest() { return null }, contains() { return false }, matches() { return false },
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 } },
    parentNode: null, firstChild: null, lastChild: null, firstElementChild: null, tagName: 'DIV',
  };
}

function makeDoc() {
  const cache = new Map();
  const doc = {
    _els: cache,
    querySelector(sel) { if (!cache.has(sel)) cache.set(sel, El(sel)); return cache.get(sel) },
    querySelectorAll() { return [] },
    getElementById(id) { return doc.querySelector('#' + id) },
    createElement(tag) { return El('<' + tag + '>') },
    addEventListener() {}, removeEventListener() {},
    execCommand() { return true },
    body: El('body'), documentElement: El('html'), head: El('head'),
  };
  return doc;
}

function makeCtx(search) {
  const doc = makeDoc();
  const ctx = vm.createContext({
    console, document: doc,
    window: { getComputedStyle: () => ({}) }, navigator: {},
    location: { search: search || '', pathname: '/index.html', href: 'file:///index.html' + (search || '') },
    history: { replaceState() {} },
    URLSearchParams, setTimeout, clearTimeout, encodeURIComponent, decodeURIComponent,
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    Math, JSON, Date,
  });
  vm.runInContext(code, ctx, { filename: 'index.html-inline.js' });
  return { ctx, doc };
}

const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const heads = h => [...String(h).matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map(m => strip(m[1]));

// ---------- 1) 基本加载 ----------
const { ctx, doc } = makeCtx('');
const el = s => doc.querySelector(s);
let fail = 0;
const ok = (name, cond, extra) => { if (!cond) fail++; console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`); };

console.log('\n=== 1) 初始化 ===');
console.log('规则条数 RULES.length =', vm.runInContext('RULES.length', ctx));
console.log('逻辑坑 LOGIC.length =', vm.runInContext('LOGIC.length', ctx));
console.log('#cnt 文案 =', el('#cnt').textContent);
console.log('#errOut 初始渲染 =', strip(el('#errOut').innerHTML).slice(0, 60));
console.log('#ruleList 初始渲染长度 =', el('#ruleList').innerHTML.length);
ok('#doErr 绑定', typeof el('#doErr').onclick === 'function');
ok('#doChk 绑定', typeof el('#doChk').onclick === 'function');
ok('#doInt 绑定', typeof el('#doInt').onclick === 'function');
ok('#fbCopy 绑定（反馈）', typeof el('#fbCopy').onclick === 'function');

// ---------- 2) 一条条喂真实的 Dev-C++ / gcc 报错 ----------
const cases = [
  ['A 多行真实输出（漏分号）',
    "C:\\Users\\someone\\Desktop\\a.c: In function 'int main()':\nC:\\Users\\someone\\Desktop\\a.c:5:14: error: expected ';' before '}' token"],
  ['B 全角标点', "[Error] stray '\\357' in program"],
  ['C 链接失败', '[Error] ld returned 1 exit status'],
  ['D 未声明', "error: 'scanf' was not declared in this scope; did you mean 'scanf_s'?"],
  ['E 链接 math', "undefined reference to `sqrt'"],
  ['F 类型不匹配', "error: invalid operands to binary % (have 'double' and 'int')"],
  ['G 逗号写成中文', '[Error] invalid suffix "a" on integer constant'],
  ['H 乱编的（走兜底分支）', 'error: banana not found in fridge'],
];

console.log('\n=== 2) 逐条翻译（调页面自己的 doErr handler）===');
const expectHit = [true, true, true, true, true, true, true, false];
cases.forEach(([name, text], i) => {
  el('#errIn').value = text;
  el('#errOut').innerHTML = '';
  let hs = [];
  try {
    el('#doErr').onclick();
    const out = el('#errOut').innerHTML;
    hs = heads(out);
    console.log(`\n[${name}] 命中标题: ${JSON.stringify(hs)}`);
  } catch (e) {
    console.log(`\n[${name}] ❌ 抛错:`, e.message);
    fail++;
  }
  ok(`${name} ${expectHit[i] ? '有命中' : '走兜底'}`, expectHit[i] ? hs.length > 0 : hs.some(h => h.includes('没认出来')), hs.join(' / ').slice(0, 80));
});

// ---------- 3) 代码体检 ----------
console.log('\n=== 3) 代码体检（中文标点 + 括号不配对）===');
el('#codeIn').value = '#include <stdio.h>\nint main() {\n  int a = 1，\n  if (a > 0) {\n    printf("%d", a);\n  return 0;\n}';
el('#chkOut').innerHTML = '';
try {
  el('#doChk').onclick();
  const t = strip(el('#chkOut').innerHTML);
  console.log('  结果:', t.slice(0, 220) || '(空)');
  ok('检出全角逗号', t.includes('全角'), '');
  ok('检出未闭合括号', t.includes('没闭合'), '');
} catch (e) { console.log('  ❌ 抛错:', e.message); fail++; }

// ---------- 4) 定积分 ----------
console.log('\n=== 4) 定积分 ===');
el('#fx').value = 'x*x'; el('#ia').value = '0'; el('#ib').value = '1';
el('#intOut').innerHTML = '';
try {
  el('#doInt').onclick();
  const t = strip(el('#intOut').innerHTML);
  console.log('  结果:', t.slice(0, 120));
  ok('∫x²(0→1)=0.333333', t.includes('0.333333'), '');
} catch (e) { console.log('  ❌ 抛错:', e.message); fail++; }

// ---------- 5) URL 参数自动翻译链路 ----------
console.log('\n=== 5) URL 参数 ?t= 自动翻译 ===');
const sample = "[Error] expected ';' before '}' token";
const enc = Buffer.from(sample, 'utf8').toString('base64');
const variants = { '标准base64': enc, 'base64url': enc.replace(/\+/g, '-').replace(/\//g, '_'), 'base64url去=号': enc.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') };
for (const [label, v] of Object.entries(variants)) {
  const good = vm.runInContext(`b64uDec(${JSON.stringify(v)})`, ctx) === sample;
  ok(`b64uDec(${label})`, good);
}
const goodEnc = Object.entries(variants).find(([, v]) => vm.runInContext(`b64uDec(${JSON.stringify(v)})`, ctx) === sample)[1];
const { doc: doc2 } = makeCtx('?t=' + encodeURIComponent(goodEnc));
const el2 = s => doc2.querySelector(s);
ok('?t= 自动填入 errIn', el2('#errIn').value === sample);
el2('#errOut').innerHTML = '';
try { el2('#doErr').onclick(); } catch (e) { console.log('  ❌ 抛错:', e.message); fail++; }
console.log('  自动翻译结果:', strip(el2('#errOut').innerHTML).slice(0, 100));

// ---------- 6) 反馈内容生成（含路径抹除）----------
console.log('\n=== 6) 反馈：fbBuild / fbScrub ===');
try {
  const txt = vm.runInContext(`(function(){
    document.querySelectorAll('#fbChips .chip');   // 桩里返回 []
    return fbScrub('C:\\\\Users\\\\someone\\\\Desktop\\\\作业\\\\a.c:5:14: error: expected ;') ;
  })()`, ctx);
  console.log('  fbScrub 结果:', txt);
  ok('路径被抹掉', txt.includes('<路径>') && !txt.includes('31546'), '');
} catch (e) { console.log('  ❌ 抛错:', e.message); fail++; }

// ---------- 7) parseErrLines：一行命中多条规则时，取的是优先级最高（p 最小）的那条 ----------
console.log('\n=== 7) parseErrLines 优先级裁决 ===');
try {
  const probe = vm.runInContext(`(function(){
    const line = "main.c:5:14: error: expected ';' before '}' token stray '\\\\357' in program";
    const lowT = line.toLowerCase();
    const hits = RULES.filter(function(x){return x.k.some(function(k){return lowT.indexOf(k.toLowerCase())>=0;});});
    const sorted = hits.slice().sort(function(a,b){return (a.p===undefined?5:a.p)-(b.p===undefined?5:b.p);});
    const out = parseErrLines(line);
    return JSON.stringify({
      hits: hits.map(function(r){return r.n+' (p='+(r.p===undefined?5:r.p)+')';}),
      picked: out.map(function(o){return o.name;}),
      best: sorted.length ? sorted[0].n : null
    });
  })()`, ctx);
  const d = JSON.parse(probe);
  console.log('  命中的规则:', d.hits.join(' / ') || '(无)');
  console.log('  清单里选中的:', d.picked.join(' / ') || '(无)');
  ok('清单选中 = 优先级最高的那条', d.best !== null && d.picked.includes(d.best), '期望 ' + d.best);
} catch (e) { console.log('  ❌ 抛错:', e.message); fail++; }

// ---------- 8) 回归：代码体检的三类误报（2026-10-15 独立复核发现） ----------
console.log('\n=== 8) 回归：代码体检误报 ===');
const scan = (source) => {
  const { doc: d } = makeCtx('');
  const q = s => d.querySelector(s);
  q('#codeIn').value = source; q('#chkOut').innerHTML = '';
  q('#doChk').onclick();
  return strip(q('#chkOut').innerHTML);
};
try {
  const t1 = scan('int main(){\n  int a[3];\n  a[0]=1;\n  return 0;\n}');
  ok('合法 ASCII 数组不报「全角字符」', t1.includes('没发现中文全角字符'), t1.slice(0, 60));
  const t2 = scan('#include <stdio.h>\nint main(){ printf("hi"); return 0; }');
  ok('#include <stdio.h> 不误报缺头文件', !t2.includes('没看到'), t2.slice(0, 60));
  const t3 = scan('int main(){\n  return 0;\n}}');
  ok('多一个右括号时不自相矛盾', !(t3.includes('括号全部配对') && t3.includes('括号不配对')), t3.slice(0, 100));
  const t4 = scan('int main(){\n  int a = 1】;\n}');
  ok('全角 】 仍能被识别', t4.includes('全角字符') && t4.includes('】'), t4.slice(0, 60));
} catch (e) { console.log('  ❌ 抛错:', e.message); fail++; }

console.log(`\n=== 汇总：${fail === 0 ? '全部通过' : fail + ' 项失败'} ===`);
process.exit(fail === 0 ? 0 : 1);
