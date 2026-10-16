/* C 语言报错翻译器 · 网页版 —— 逻辑（解析 / 渲染 / 体检 / 定积分 / URL 参数） */
/* ---------- 渲染逻辑 ---------- */
const $=s=>document.querySelector(s);
const TABS=[...document.querySelectorAll('.tab')];
TABS.forEach(t=>{
  t.onclick=()=>{
    const prev=TABS.findIndex(x=>x.classList.contains('on'));
    const next=TABS.indexOf(t);
    const pane=document.getElementById('p-'+t.dataset.p);
    document.querySelectorAll('.pane').forEach(p=>p.classList.remove('on'));
    if(pane){
      // 往下切 → 新内容从下面升上来；往上切 → 从上面降下来（"上下"都用到）
      pane.style.setProperty('--dy', (next>=prev?1:-1)*16+'px');
      void pane.offsetWidth;          // 强制重排，动画才会重新播
      pane.classList.add('on');
    }
    TABS.forEach(x=>x.classList.toggle('on',x===t));
  };
});
/* 左栏收起 / 展开（状态记住，窄屏下由 CSS 强制展开） */
(function(){
  var btn=document.getElementById('navToggle');
  if(!btn) return;
  var KEY='ceh.navCollapsed';
  try{ if(localStorage.getItem(KEY)==='1')
    document.body.classList.add('nav-collapsed'); }catch(e){}
  var sync=function(){ btn.setAttribute('aria-expanded',
    document.body.classList.contains('nav-collapsed')?'false':'true'); };
  sync();
  btn.onclick=function(){
    var on=document.body.classList.toggle('nav-collapsed');
    try{ localStorage.setItem(KEY, on?'1':'0'); }catch(e){}
    sync();
  };
})();
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const badge=s=>({e:'错误',w:'警告',i:'提示'}[s]);
const stripTags=s=>s.replace(/<[^>]+>/g,'');
function tplBlock(code){
  return '<div class="tpl"><div class="tplbar"><span>正确写法（照着抄就能改对）</span>'
    +'<button type="button" class="cpbtn" onclick="copyTpl(this)">复制</button></div>'
    +'<pre>'+esc(code)+'</pre></div>';
}
function copyTpl(b){
  var t=b.parentNode.parentNode.querySelector('pre').textContent;
  var done=function(ok){
    b.textContent=ok?'已复制 ✓':'请手动选中';
    setTimeout(function(){b.textContent='复制';},1600);
  };
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(function(){done(true);},
      function(){done(legacyCopy(t));});
  } else done(legacyCopy(t));
}
function legacyCopy(t){
  try{
    var ta=document.createElement('textarea');
    ta.value=t; ta.style.position='fixed'; ta.style.left='-9999px';
    document.body.appendChild(ta); ta.select();
    var ok=document.execCommand('copy');
    document.body.removeChild(ta); return ok;
  }catch(e){ return false; }
}

/* 逐行解析报错 -> 「哪一行、什么错」，用来生成改错顺序清单。
   支持两种格式：
     gcc        main.c:14:41: error: expected ';' before 'scanf'
     Dev-C++    14 <TAB> 41 <TAB> C:\...\a.c <TAB> [Error] expected ';' before 'scanf'  */
function parseErrLines(raw){
  const res=[], seen=new Set();
  raw.split(/\r?\n/).forEach(function(L){
    const t=L.trim();
    if(!t) return;
    let ln=null, col=null, msg=t;
    let m=t.match(/^(?:[A-Za-z]:[\\/][^:]*|[^\s:]+):(\d+):(\d+):\s*(.*)$/);
    if(m){ ln=+m[1]; col=+m[2]; msg=m[3]; }
    else{
      m=t.match(/^(\d+)\s+(\d+)\s+(.*)$/);
      if(m){ ln=+m[1]; col=+m[2]; msg=m[3]; }
    }
    if(ln===null) return;
    const mi=msg.search(/\[(?:Error|Warning|Note)\]/i);
    let body=(mi>=0?msg.slice(mi):msg).replace(/\[(?:Error|Warning|Note)\]\s*/i,'').trim();
    if(!body) return;
    const lowT=t.toLowerCase();
    // 同一行可能同时符合多条规则 → 取优先级最高的那条（p 越小越是根因），
    // 与 translate() 里的排序口径保持一致（原来用 RULES.find 只取数组顺序第一条）
    const hits=RULES.filter(function(x){
      return x.k.some(function(k){return lowT.indexOf(k.toLowerCase())>=0;});
    });
    if(!hits.length) return;              // 没认出来的不进清单
    hits.sort(function(a,b){
      return (a.p===undefined?5:a.p)-(b.p===undefined?5:b.p);
    });
    const r=hits[0];
    const key=ln+'|'+r.n;
    if(seen.has(key)) return;             // 同一行同一类错只留一条
    seen.add(key);
    res.push({ln:ln,col:col,name:r.n,short:r.t,sev:r.s,ig:r.ig?1:0,pri:(r.p===undefined?5:r.p)});
  });
  // 可忽略的沉底 -> 按行号从上往下 -> 同一行内根因优先（全角标点 p:0）
  res.sort(function(a,b){return a.ig-b.ig||a.ln-b.ln||a.pri-b.pri;});
  return res;
}

function srcSnippet(txt, ln){
  var h=esc(txt).replace(/[\u3000\u3001\u3002\uFF01-\uFF5E\u2018\u2019\u201C\u201D]/g,
    function(m){ return '<mark class="fw">'+m+'</mark>'; });
  return '<div class="srcline"><span class="lnnum">'+ln+'</span><code>'+h+'</code></div>';
}

function actionCard(lines, srcLines){
  const items=lines.map(function(l){
    const tg=l.ig?'<span class="tag w">可忽略</span>'
            :(l.sev==='e'?'<span class="tag e">错误</span>'
            :(l.sev==='w'?'<span class="tag w">警告</span>':''));
    var snip='';
    if(srcLines && srcLines[l.ln-1]!==undefined && srcLines[l.ln-1].trim()!=='')
      snip=srcSnippet(srcLines[l.ln-1], l.ln);
    return '<li><span class="lnbadge">第 '+l.ln+' 行'+(l.col?' '+l.col+' 列':'')+'</span> '
      +stripTags(l.short||l.name)+' '+tg+snip+'</li>';
  }).join('');
  return '<div class="card i actcard"><h3>先按这个顺序改（共 '+lines.length+' 处）</h3>'
    +'<ol class="acts">'+items+'</ol>'
    +'<div class="say">照着从上往下改，改完再编译一次。<strong>先修最上面那条</strong>——下面有些报错会跟着自己消失。</div></div>';
}

function findLineNo(txt){
  // 兼容 main.c:12:5 / error at line 12 / 第 12 行
  let m=txt.match(/:\s*(\d+)\s*:\s*\d+/);
  if(m) return m[1];
  m=txt.match(/\bline\s+(\d+)/i)||txt.match(/第\s*(\d+)\s*行/);
  return m?m[1]:null;
}

function translate(raw, codeText){
  const low=raw.toLowerCase();
  const out=[];
  RULES.forEach((r,i)=>{
    const hitK=r.k.find(k=>low.includes(k.toLowerCase()));
    if(hitK && !out.some(o=>o.r.n===r.n)) out.push({r,k:hitK,i});
  });
  if(!out.length){
    const ln=findLineNo(raw);
    return '<div class="card i"><h3>没认出来这条报错</h3>'
      +'<div class="why">说明它比较少见，或者你只粘了一小段。可以这样自己查：</div>'
      +'<ul class="fix"><li>把报错原文整段复制去搜，关键词保留英文</li>'
      +'<li>看报错里的文件名和行号：'+(ln?('第 <strong>'+ln+'</strong> 行'):'（没找到行号，粘全一点）')+'</li>'
      +'<li>先修<strong>最上面那条 Error</strong>——很多下面的错误是它带出来的</li>'
      +'<li>试试点「代码体检」，中文标点和括号不配对是隐形杀手</li></ul></div>';
  }
  const sevRank={e:0,w:1,i:2};
  const pri=x=>(x.r.p===undefined?5:x.r.p);
  out.sort((a,b)=>pri(a)-pri(b)||sevRank[a.r.s]-sevRank[b.r.s]||a.i-b.i);
  let html='';
  const elines=parseErrLines(raw);
  if(elines.length>=2){
    html+=actionCard(elines, codeText
      ? String(codeText).replace(/\r\n?/g,'\n').split('\n') : null);
  }else{
  const ln=findLineNo(raw);
  if(ln) html+='<div class="card i"><h3>报错位置</h3><div class="why">编译器指向第 <strong>'+ln+'</strong> 行。'
    +'先看<strong>这一行的末尾</strong>是不是漏了分号，再往上找：少分号、少括号这类错，编译器报的位置常常晚了一行。</div></div>';
  }
  html+=out.map(o=>{
    const c=o.r.s==='e'?'e':(o.r.s==='w'?'w':'i');
    const head='<h3>'+o.r.n+'<span class="badge '+c+'">'+badge(o.r.s)+'</span></h3>';
    const body='<div class="why">'+o.r.why+'</div>'
      +'<ul class="fix">'+o.r.fix.map(f=>'<li>'+f+'</li>').join('')+'</ul>'
      +(o.r.code?tplBlock(o.r.code):'')
      +'<div class="say">命中关键词：<code>'+esc(o.k)+'</code></div>';
    if(o.r.s==='w') return '<details class="card w"><summary>'+head+'</summary>'+body+'</details>';
    return '<div class="card '+c+'">'+head+body+'</div>';
  }).join('');
  if(out.length>1) html+='<div class="card o"><h3>一条条来，别慌</h3>'
    +'<div class="why">一次报了 '+out.length+' 类错，<strong>通常修好最上面那条，下面一半会自己消失</strong>。改一次编译一次。</div></div>';
  return html;
}

$('#doErr').onclick=()=>{
  const v=$('#errIn').value.trim();
  const c=$('#codeIn2').value;
  $('#errOut').innerHTML = v? translate(v, c)
    : '<div class="empty">先把报错粘进去 ↑</div>';
};
$('#paste').onclick=function(){
  var btn=this, old=btn.textContent;
  if(!(navigator.clipboard&&navigator.clipboard.readText)){
    $('#errOut').innerHTML='<div class="empty">这个浏览器不让读剪贴板，手动 Ctrl+V 粘到上面那个框里就行</div>';
    return;
  }
  navigator.clipboard.readText().then(function(t){
    if(!t||!t.trim()){
      $('#errOut').innerHTML='<div class="empty">剪贴板是空的 —— 先在 Dev-C++ 里拖黑那排报错，按 Ctrl+C</div>';
      return;
    }
    $('#errIn').value=t; $('#doErr').click();
    btn.textContent='已读入 ✓';
    setTimeout(function(){btn.textContent=old;},1500);
  },function(){
    $('#errOut').innerHTML='<div class="empty">浏览器拒绝了读取剪贴板（权限没给）。手动 Ctrl+V 粘到上面那个框里即可</div>';
  });
};
$('#clr').onclick=()=>{$('#errIn').value='';$('#codeIn2').value='';$('#errOut').innerHTML='';};

/* ---------- 被外部工具调用：?t=<base64报错>&c=<base64代码> ----------
   桌面小工具按快捷键后会打开带参数的网址，这里自动读入并翻译 */
function b64uDec(s){
  try{
    s=String(s).replace(/-/g,'+').replace(/_/g,'/');
    while(s.length%4) s+='=';
    return decodeURIComponent(atob(s).split('').map(function(ch){
      return '%'+('00'+ch.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  }catch(e){ return ''; }
}
function runUrlParams(){
  var _loc=(typeof location!=='undefined'&&location)?location:null;
  if(!_loc || !_loc.search || _loc.search.length<2) return;
  var q=new URLSearchParams(_loc.search);
  var t=b64uDec(q.get('t')||''), c=b64uDec(q.get('c')||'');
  if(!t && !c) return;
  if(t) $('#errIn').value=t;
  if(c) $('#codeIn2').value=c;
  if(t){
    $('#doErr').click();
    // 清掉地址栏参数，方便他收藏干净的网址
    try{ history.replaceState(null,'',(_loc.pathname||'/')); }catch(e){}
  }
}
$('#demo').onclick=()=>{
  $('#errIn').value=
`main.c: In function 'main':
main.c:8:5: error: stray '\\357' in program
main.c:11:9: error: expected ';' before 'return'
main.c:14:1: error: expected declaration or statement at end of input
[Error] ld returned 1 exit status`;
  $('#doErr').click();
};

/* ---------- 代码体检 ---------- */
const FULLWIDTH={'，':'逗号 ,','。':'句号 .','；':'分号 ;','：':'冒号 :','（':'左括号 (',
 '）':'右括号 )','【':'[','】':']', '《':'<','》':'>','、':'逗号','？':'问号 ?','！':'叹号 !',
 '“':'"','”':'"','‘':"'",'’':"'",'～':'~','＠':'@','＃':'#','％':'%','＆':'&','＊':'*',
 '＋':'+','－':'-','＝':'=','＜':'<','＞':'>','／':'/','｜':'|','　':'全角空格'};

function bodyScan(code){
  const issues=[];
  const lines=code.split(/\r?\n/);
  // 1 全角
  const fw=[];
  lines.forEach((L,i)=>{
    for(let c=0;c<L.length;c++){
      const ch=L[c];
      if(FULLWIDTH[ch]) fw.push({ln:i+1,col:c+1,ch,as:FULLWIDTH[ch]});
      // 注：全角空格（U+3000）已经在 FULLWIDTH 字典里，不需要单独再判一次
    }
  });
  // 2 括号配对
  const stack=[];
  const pairs={'(':')','[':']','{':'}'};
  const clos={')':'(',']':'[','}':'{'};
  let inStr=false,quoteType='';
  lines.forEach((L,i)=>{
    for(let c=0;c<L.length;c++){
      const ch=L[c];
      if(ch==='\\'&&inStr){c++;continue;}
      if(inStr){ if(ch===quoteType) inStr=false; continue; }
      if(ch==='"'||ch==="'"){inStr=true;quoteType=ch;continue;}
      if(ch==='/'&&L[c+1]==='/') break;
      if(pairs[ch]) stack.push({ch,ln:i+1,col:c+1});
      else if(clos[ch]){
        const last=stack.pop();
        if(!last||last.ch!==clos[ch]){
          issues.push({sev:'e',n:'括号不配对',d:'第 '+(i+1)+' 行第 '+(c+1)+' 列出现了 <code>'+esc(ch)+'</code>，但前面没有对应的 <code>'+clos[ch]+'</code>。',f:['检查这一行是不是多打了括号','往上找找有没有漏开的括号']});
          stack.length=0;
        }
      }
    }
  });
  return {fw,stack,issues};
}

$('#doChk').onclick=()=>{
  const code=$('#codeIn').value;
  if(!code.trim()){$('#chkOut').innerHTML='<div class="empty">先把代码粘进去 ↑</div>';return;}
  const r=bodyScan(code);
  let html='';
  // 全角
  if(r.fw.length){
    html+='<div class="card e"><h3>发现中文全角字符 '+r.fw.length+' 处'
      +'<span class="badge e">必改</span></h3>'
      +'<div class="why">这些字符看起来和英文一样，编译器却完全不认，会报 <code>stray</code> 之类的怪错。</div>'
      +'<table><tr><th>位置</th><th>你打的</th><th>应该改成</th></tr>'
      +r.fw.slice(0,25).map(f=>'<tr><td>第 '+f.ln+' 行 第 '+f.col+' 列</td><td><code>'+esc(f.ch)+'</code></td><td><code>'+esc(f.as)+'</code></td></tr>').join('')
      +'</table>'
      +(r.fw.length>25?'<div class="ln">（只列出前 25 处）</div>':'')
      +'<ul class="fix"><li>把输入法切到<strong>英文半角</strong>，逐个替换</li><li>或者删掉整行重新敲一遍，比找符号快</li></ul></div>';
  }else{
    html+='<div class="card o"><h3>没发现中文全角字符<span class="badge o">干净</span></h3>'
      +'<div class="why">标点这块没问题。</div></div>';
  }
  // 括号
  if(r.stack.length){
    html+='<div class="card e"><h3>有 '+r.stack.length+' 个括号没闭合<span class="badge e">必改</span></h3>'
      +'<div class="why">下面这些左括号开出去了，没找到对应的右括号。</div><table>'
      +'<tr><th>位置</th><th>符号</th></tr>'
      +r.stack.map(s=>'<tr><td>第 '+s.ln+' 行 第 '+s.col+' 列</td><td><code>'+esc(s.ch)+'</code></td></tr>').join('')
      +'</table><ul class="fix"><li>函数、if、for、while、结构体的 <code>{ }</code> 全都要成对</li>'
      +'<li>写完一段先缩进对齐，漏括号一眼就看得出来</li></ul></div>';
  }else if(!r.issues.length){
    // 有多余的右括号时就不能说「全部配对」，否则两份报告自相矛盾
    html+='<div class="card o"><h3>括号全部配对<span class="badge o">通过</span></h3>'
      +'<div class="why">花括号、圆括号、方括号都没问题。</div></div>';
  }
  html+= r.issues.map(i=>'<div class="card '+i.sev+'"><h3>'+i.n+'</h3><div class="why">'+i.d+'</div>'
    +'<ul class="fix">'+i.f.map(x=>'<li>'+x+'</li>').join('')+'</ul></div>').join('');
  // 经典坑
  const hall=[];
  if(/scanf\s*\([^)]*\)\s*;/.test(code)){
    const bad=code.match(/scanf\s*\(\s*"[^"]*"\s*,\s*([A-Za-z_]\w*)\s*[,)]/);
    if(bad) hall.push({n:'<code>scanf</code> 可能漏了 <code>&amp;</code>',d:'看到 <code>scanf(..., '+esc(bad[1])+')</code>，第二个参数如果是普通变量，前面必须有 <code>&amp;</code>。'});
  }
  if(/\bif\s*\(\s*[A-Za-z_]\w*\s*=\s*[^=]/.test(code)) hall.push({n:'<code>if</code> 里用了单个等号',d:'<code>if (x = 5)</code> 是赋值不是判断，永远为真。要写 <code>==</code>。'});
  if(/for\s*\([^;]*,[^;]*;[^)]*\)/.test(code)) hall.push({n:'<code>for</code> 括号里像是用了逗号',d:'<code>for</code> 的三个部分之间必须用<strong>分号</strong> <code>;</code> 隔开，不是逗号。'});
  if(/\d+\s*\/\s*\d+\s*;/.test(code)) hall.push({n:'整数除法嫌疑',d:'两个整数相除结果会截断小数（<code>7/2</code>=<code>3</code>）。要小数就写 <code>7.0/2</code>。'});
  if(/#include\s*<\s*stdio\.h\s*>/.test(code)===false && /printf|scanf/.test(code)) hall.push({n:'用了 printf/scanf 但没看到 <code>#include &lt;stdio.h&gt;</code>',d:'漏了头文件会出 warning，或者行为诡异。'});
  if(/$\s*$/m && /;/m && /^\s*int\s+main\s*\(\s*\)\s*$/m===false && /int\s+main\s*\(\s*void\s*\)/.test(code)===false && /int\s+main\s*\(/.test(code)===false) hall.push({n:'没找到 <code>int main()</code>',d:'每个程序都要有 <code>int main()</code> 入口，检查是不是打成了 <code>mian</code>。'});
  if(hall.length){
    html+='<div class="card w"><h3>经典写法坑检查<span class="badge w">看一眼</span></h3>'
      +'<ul class="fix">'+hall.map(h=>'<li><strong>'+h.n+'</strong>：'+h.d+'</li>').join('')+'</ul></div>';
  }
  $('#chkOut').innerHTML=html;
};
$('#clr2').onclick=()=>{$('#codeIn').value='';$('#chkOut').innerHTML='';};
$('#demo2').onclick=()=>{
  $('#codeIn').value=
`#include <stdio.h>
int main()
{
    int i, n, sum;
    double avg;
    printf("请输入五个数字：");
    for (i = 0; i < 5; i++)
        scanf("%d", n);
        sum = sum + n;
    }
    avg = sum / 5;
    printf("平均分是：%d", avg);
    return 0
}`;
  $('#doChk').click();
};

/* ---------- 定积分 ---------- */
function compileF(src){
  let s=src.trim();
  s=s.replace(/\^/g,'**');
  s=s.replace(/\b(ln|log)\s*\(/g,'Math.log(');
  s=s.replace(/\barcsin/g,'asin').replace(/\barccos/g,'acos').replace(/\barctan/g,'atan');
  s=s.replace(/\bpi\b/g,'Math.PI').replace(/\be\b/g,'Math.E');
  s=s.replace(/\bsin/g,'Math.sin').replace(/\bcos/g,'Math.cos').replace(/\btan/g,'Math.tan');
  s=s.replace(/\bsqrt/g,'Math.sqrt').replace(/\bexp/g,'Math.exp');
  s=s.replace(/\bfabs/g,'Math.abs').replace(/\babs/g,'Math.abs');
  s=s.replace(/\bfloor/g,'Math.floor').replace(/\bceil/g,'Math.ceil').replace(/\bround/g,'Math.round');
  s=s.replace(/\bpow/g,'Math.pow').replace(/\basin/g,'Math.asin')
     .replace(/\bacos/g,'Math.acos').replace(/\batan/g,'Math.atan');
  return new Function('x','return ('+s+');');
}
function simpson(f,a,b,n){
  if(n%2) n++;
  const h=(b-a)/n; let s=f(a)+f(b);
  for(let i=1;i<n;i++) s+=f(a+i*h)*(i%2?4:2);
  return s*h/3;
}
$('#doInt').onclick=()=>{
  const out=$('#intOut');
  try{
    const f=compileF($('#fx').value);
    const a=compileF($('#ia').value)(0), b=compileF($('#ib').value)(0);
    if(!isFinite(a)||!isFinite(b)) throw new Error('上下限不是数字');
    if(a===b){ out.innerHTML='<div class="card i"><h3>结果</h3><div class="big">0</div>'
      +'<div class="ln">上下限相同，积分当然是 0。</div></div>'; return; }
    const v=simpson(f,a,b,2000);
    if(!isFinite(v)) throw new Error('这个函数在这段区间上算不出有限值（可能有 1/x 在 0 附近的奇点）');
    // 校验：错误估计
    const v2=simpson(f,a,b,8000);
    const err=Math.abs(v-v2);
    const rounded=Math.round(v*1e6)/1e6;
    out.innerHTML='<div class="card o"><h3>定积分结果</h3>'
      +'<div class="big">'+rounded+'</div>'
      +'<div class="ln">∫ 从 '+a+' 到 '+b+' 的 f(x) dx  ≈  <strong>'+rounded+'</strong>'
      +(err<1e-4?'（数值已验证，可信）':'（数值接近上限，建议提高精度核对）')+'</div></div>'
      +'<div class="card i"><h3>老师要的答案怎么填</h3>'
      +'<ul class="fix"><li>答案直接写数字：<code>'+rounded+'</code>，别带 <code>≈</code> 符号</li>'
      +'<li>要保留几位小数就跟题目要求，比如 <code>'+ (Math.round(v*100)/100) +'</code></li>'
      +'<li>这是<strong>数值解</strong>，用来核对作业；卷面上该写的步骤还是要写</li></ul></div>';
  }catch(e){
    out.innerHTML='<div class="card e"><h3>表达式读不懂</h3><div class="why">'+esc(e.message)
      +'</div><ul class="fix"><li>乘法一定要写 <code>*</code>：<code>2x</code> 要写成 <code>2*x</code></li>'
      +'<li>除法加括号：<code>1/x+1</code> 是 <code>(1/x)+1</code>，想要 <code>1/(x+1)</code> 就加括号</li>'
      +'<li>只支持 <code>x</code> 一个变量</li></ul></div>';
  }
};
$('#clr3').onclick=()=>{$('#intOut').innerHTML='';};

/* ---------- 逻辑坑渲染 ---------- */
$('#logList').innerHTML=LOGIC.map(o=>'<div class="card w"><h3>'+o.n+'</h3>'
  +'<div class="why">'+o.why+'</div><ul class="fix">'+o.fix.map(f=>'<li>'+f+'</li>').join('')+'</ul></div>').join('');

$('#cnt').textContent=RULES.length;
$('#errOut').innerHTML='<div class="empty">把报错粘进去，点「翻译一下」</div>';

/* ---------- 反馈 ---------- */
/* 想让用户直接发邮件/加 QQ，把联系方式填在这里（例：'xiaogao@qq.com'）；留空则只提示"发我" */
const FB_CONTACT='';
const FB_VER='2026-10-16';
function fbScrub(s){
  return String(s||'')
    .replace(/[A-Za-z]:[\\/][^\s:'"<>|]*/g,'<路径>')
    .replace(/\/(?:home|Users|用户)\/[^\s:'"<>|]*/g,'<路径>')
    .replace(/\\\\[^\s:'"<>|]+/g,'<路径>');
}
function fbBuild(){
  const t=[...document.querySelectorAll('#fbChips .chip.on')].map(function(c){return c.dataset.t;});
  const d=$('#fbTxt').value.trim();
  const L=[];
  L.push('【C 语言报错翻译器 · 反馈】');
  L.push('类型：'+(t.length?t.join('、'):'(没选)'));
  L.push('情况：'+(d?fbScrub(d):'(没写)'));
  if($('#fbAttach').checked){
    L.push('');
    L.push('我粘进去的报错（已去掉路径）：');
    L.push(fbScrub($('#errIn').value.trim())||'(空的)');
  }
  L.push('');
  L.push('--- 页面信息（自动带上）---');
  L.push('页面版本 '+FB_VER+' · 规则 '+RULES.length+' 条');
  L.push('浏览器 '+navigator.userAgent);
  return L.join('\n');
}
document.querySelectorAll('#fbChips .chip').forEach(function(c){
  c.onclick=function(){ c.classList.toggle('on'); };
});
$('#fbCopy').onclick=function(){
  var btn=this, old=btn.textContent, text=fbBuild();
  var tail=FB_CONTACT?('粘好后发我：'+FB_CONTACT):'粘好后发我（微信 / QQ 都行）';
  var done=function(ok){
    btn.textContent=ok?'已复制 ✓':'请手动选中';
    setTimeout(function(){btn.textContent=old;},1700);
    $('#fbOut').innerHTML = ok
      ? '<div class="card i"><h3>已复制到剪贴板</h3><div class="why">'+esc(tail)
        +'。也可以直接粘到 GitHub 的 issue 里。</div></div>'
      : '<div class="empty">这个浏览器不让写剪贴板——手动选中下面这段复制就行：</div><pre>'+esc(text)+'</pre>';
  };
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){done(true);},function(){done(legacyCopy(text));});
  } else done(legacyCopy(text));
};
$('#fbClr').onclick=function(){
  $('#fbTxt').value='';
  $('#fbAttach').checked=false;
  document.querySelectorAll('#fbChips .chip').forEach(function(c){c.classList.remove('on');});
  $('#fbOut').innerHTML='';
};

/* 注意：必须放在所有初始化之后 —— 否则会被上面那行的初始文案覆盖 */
runUrlParams();

(function(){
  var ids=['errOut','chkOut','intOut'];
  function sync(){
    var any=ids.some(function(id){
      var el=document.getElementById(id);
      return !!(el && el.querySelector && el.querySelector('.card,.tpl,.big,pre'));
    });
    document.body.classList.toggle('nores',!any);
  }
  document.addEventListener('click',function(e){
    if(e.target && e.target.closest &&
       e.target.closest('.act.main,.act,.chip,#clr,#clr2,#clr3')) setTimeout(sync,30);
  });
  [['resCopy','errOut'],['chkCopy','chkOut']].forEach(function(p){
    var b=document.getElementById(p[0]); if(!b || !b.addEventListener) return;
    b.addEventListener('click',function(){
      var out=document.getElementById(p[1]);
      var t=(out.innerText||'').trim();
      navigator.clipboard.writeText(t).then(function(){
        var old=b.textContent; b.textContent='已复制';
        setTimeout(function(){b.textContent=old;},1200);
      }).catch(function(){});
    });
  });
  if(typeof MutationObserver!=='undefined'){
    new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});
  }
  sync();
})();

/* ===== 报错翻译：输入区「报错原文 / 代码」切换 =====
   两块 textarea 都留在 DOM 里（app.js 两个 id 都要读），只是轮流显示，
   所以不用改 app.js。 */
(function(){
  var wrap=document.getElementById('inWrap'), seg=document.getElementById('inSeg');
  if(!wrap || !seg || !seg.querySelectorAll) return;
  var lb=document.getElementById('fhLabel'), hh=document.getElementById('fhHint');
  var TXT={err:['报错原文','把 Dev-C++ 里那排红字整段粘进来'],
           code:['代码','粘整段代码，结果里会带出出错的那一行']};
  var bs=[].slice.call(seg.querySelectorAll('.segb'));
  bs.forEach(function(b){
    b.addEventListener('click', function(){
      var fd=b.getAttribute('data-f'); if(!fd || !TXT[fd]) return;
      wrap.setAttribute('data-field', fd);
      bs.forEach(function(x){ var on=(x===b);
        x.classList.toggle('on', on); x.setAttribute('aria-pressed', on?'true':'false'); });
      if(lb) lb.textContent=TXT[fd][0];
      if(hh) hh.textContent=TXT[fd][1];
      var t=document.getElementById(fd==='err'?'errIn':'codeIn2');
      if(t && t.focus) t.focus();
    });
  });
})();

/* ===== 液体填充 =====
   目标按钮的填充方式（按他 01:07 的说法）：液体从**两边**进来，在**中间汇合**，再**灌满**。
   四个形状一起演（都在 .inkgoo 里，goo 滤镜把挨着的形状黏成一股）：
     S  = 旧按钮那块：朝流向那一头抽干
     P1/P2 = 新按钮上的一对水流：从"垂直于流向"的两条边各长一半，在中间合上
     B  = 本体：两条流合上后，沿流向灌满
   ⚠️ 方向必须跟着布局走（2026-10-16 01:2x 修的 bug）：
     桌面 = 导航竖排 → 流向是 y（两股流从上/下边进来？不，是从左/右边进来、往下灌）
     窄屏 = 导航横排（flex row + wrap）→ 流向是 x（两股流从上/下边进来、往右灌）
   之前写死成"上下动"，所以在手机上不仅看不见液体流，选项之间也根本过不去。 */
(function(){
  // 触屏设备（手机/平板）：液体动画靠 setTimeout 收尾，移动端浏览器会节流它，
  // 卡住后选中项白字压在浅底上、高亮和内容不同步。触屏下禁用动画，改用 CSS 静态高亮。
  if(typeof matchMedia==='function' && matchMedia('(hover: none) and (pointer: coarse)').matches) return;
  var list=document.querySelector('.navlist'); if(!list || !list.querySelectorAll) return;
  var tabs=[].slice.call(list.querySelectorAll('.tab'));
  if(!tabs.length || !tabs[0].getBoundingClientRect) return;

  var layer=document.createElement('span'); layer.className='inkgoo';
  function mk(c){ var e=document.createElement('span'); e.className='ink '+c;
    e.setAttribute('aria-hidden','true'); layer.appendChild(e); return e; }
  var S=mk('inkS'), P1=mk('inkP'), P2=mk('inkP'), B=mk('inkB');
  list.insertBefore(layer, list.firstChild);

  var T=380, cur=0, phase='rest';
  var ES='cubic-bezier(.45,0,.55,1)';       // 旧项抽干
  var E1='cubic-bezier(.4,0,.4,1)';         // 两条水流从两边进来
  var E2='cubic-bezier(.45,0,.55,1)';       // 灌满
  var reduce = typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion:reduce)').matches;
  tabs.forEach(function(t,i){ if(t.classList.contains('on')) cur=i; });

  /* 导航是竖排还是横排：比较前两项的位移，哪个方向大就是哪个 */
  function vertical(){
    if(tabs.length<2) return true;
    var a=tabs[0].getBoundingClientRect(), b=tabs[1].getBoundingClientRect();
    return Math.abs(b.top-a.top) >= Math.abs(b.left-a.left);
  }
  function rel(i){
    var r=tabs[i].getBoundingClientRect(), l=list.getBoundingClientRect();
    return {x:r.left-l.left, y:r.top-l.top, w:r.width, h:r.height};
  }
  var tSrc=null, tDst=null;
  function markText(src, dst){
    clearTimeout(tSrc); clearTimeout(tDst);
    tabs[src].classList.add('leaving');
    tabs[dst].classList.add('waiting');
    tSrc=setTimeout(function(){ tabs[src].classList.remove('leaving'); }, Math.round(T*0.5));
    tDst=setTimeout(function(){ tabs[dst].classList.remove('waiting'); },  Math.round(T*0.62));
  }
  function place(e, r, tr){
    e.style.transition = tr || 'none';
    e.style.left=r.x+'px'; e.style.top=r.y+'px'; e.style.width=r.w+'px'; e.style.height=r.h+'px';
  }
  function rest(){
    place(S, rel(cur));
    var z=rel(cur);
    place(P1,{x:z.x,y:z.y,w:0,h:0}); place(P2,{x:z.x,y:z.y,w:0,h:0}); place(B,{x:z.x,y:z.y,w:0,h:0});
    phase='rest';
  }
  function go(i){
    if(typeof i!=='number' || i<0 || i===cur || i>=tabs.length) return;
    var A=rel(cur), G=rel(i), from=cur;
    var vert=vertical();
    var fwd = vert ? (G.y >= A.y) : (G.x >= A.x);      // 目标在流向的正向
    cur=i;
    tabs.forEach(function(t,k){ if(k!==i) t.classList.remove('on'); });
    tabs[i].classList.add('on');
    markText(from, i);
    if(reduce){ rest(); tabs[from].classList.remove('leaving'); tabs[i].classList.remove('waiting'); return; }

    /* ① 起跑线 */
    place(S, A); place(P1, G); place(P2, G); place(B, G);
    // 两条水流和本体先从"零"起：
    var band = Math.max(10, Math.round((vert ? G.h : G.w) * 0.4));
    var p1s, p1e, p2s, p2e, bS, bE;
    if(vert){                                   // 竖排：水流从左/右边进，往下/上灌
      p1s={x:G.x,       y:G.y, w:0,       h:band};  p1e={x:G.x,        y:G.y, w:G.w/2, h:band};
      p2s={x:G.x+G.w,   y:G.y, w:0,       h:band};  p2e={x:G.x+G.w/2,  y:G.y, w:G.w/2, h:band};
      bS ={x:G.x, y:(fwd?G.y:G.y+G.h), w:G.w, h:0};
      bE ={x:G.x, y:G.y,               w:G.w, h:G.h};
    }else{                                      // 横排：水流从上/下边进，往右/左灌
      p1s={x:G.x, y:G.y,       w:band, h:0};       p1e={x:G.x, y:G.y,       w:band, h:G.h/2};
      p2s={x:G.x, y:G.y+G.h,   w:band, h:0};       p2e={x:G.x, y:G.y+G.h/2, w:band, h:G.h/2};
      bS ={x:(fwd?G.x:G.x+G.w), y:G.y, w:0,      h:G.h};
      bE ={x:G.x,               y:G.y, w:G.w,    h:G.h};
    }
    var sEnd = {x:A.x, y:A.y, w:A.w, h:A.h};
    if(vert){ sEnd.h=0; sEnd.y = fwd ? A.y+A.h : A.y; }
    else    { sEnd.w=0; sEnd.x = fwd ? A.x+A.w : A.x; }
    place(P1,p1s); place(P2,p2s); place(B,bS);
    void P1.offsetWidth;                        // 强制回流，先落定起始状态
    phase='flow';
    place(S,  sEnd, 'left '+T+'ms '+ES+', top '+T+'ms '+ES+', width '+T+'ms '+ES+', height '+T+'ms '+ES);
    place(P1, p1e, 'left '+Math.round(T*0.45)+'ms '+E1+', top '+Math.round(T*0.45)+'ms '+E1
                 +', width '+Math.round(T*0.45)+'ms '+E1+', height '+Math.round(T*0.45)+'ms '+E1);
    place(P2, p2e, 'left '+Math.round(T*0.45)+'ms '+E1+', top '+Math.round(T*0.45)+'ms '+E1
                 +', width '+Math.round(T*0.45)+'ms '+E1+', height '+Math.round(T*0.45)+'ms '+E1);
    place(B,  bE,  'left '+Math.round(T*0.55)+'ms '+E2+' '+Math.round(T*0.45)+'ms, top '
                 +Math.round(T*0.55)+'ms '+E2+' '+Math.round(T*0.45)+'ms, width '
                 +Math.round(T*0.55)+'ms '+E2+' '+Math.round(T*0.45)+'ms, height '
                 +Math.round(T*0.55)+'ms '+E2+' '+Math.round(T*0.45)+'ms');
    /* 收尾必须清状态类：只靠中间那两个定时器，标签页被节流时会留下 waiting
       （= 选中项一直灰字压深蓝） */
    setTimeout(function(){
      tabs[from].classList.remove('leaving'); tabs[i].classList.remove('waiting');
      rest();
    }, T+40);
  }
  tabs.forEach(function(t,i){ t.addEventListener('click', function(){ go(i); }); });
  if(typeof window.addEventListener==='function'){
    window.addEventListener('resize', function(){ if(phase==='rest') rest(); });
  }
  rest();
  window.__ink={go:go, rest:rest, rel:rel, vertical:vertical, setDur:function(t){T=t;},
    get dur(){return T}, get cur(){return cur}, get phase(){return phase}};
})();

/* ---------- 启动动画 ----------
   标题逐字弹出（CSS stagger）→ 移到左上角（跟真实 h1 重合）
   → 顶部横幅 / 左栏 / 主内容从不同方向变速入场 → 全屏层淡出。 */
(function(){
  var intro=document.getElementById('intro');
  var title=document.getElementById('introTitle');
  var h1=document.querySelector('.topbar h1');
  if(!intro || !title || !h1) return;
  document.body.classList.add('pre-intro');
  setTimeout(function(){
    var r=h1.getBoundingClientRect();
    var tr=title.getBoundingClientRect();
    var s=r.height/tr.height;
    title.classList.add('moving');
    title.style.transform='translate('+(r.left-tr.left)+'px,'+(r.top-tr.top)+'px) scale('+s+')';
    document.body.classList.remove('pre-intro');
    document.body.classList.add('intro-done');
    setTimeout(function(){
      intro.style.opacity='0';
      setTimeout(function(){
        intro.remove();
        document.body.classList.remove('intro-done');
      },600);
    },800);
  },1100);
})();
