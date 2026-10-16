/* C 语言报错翻译器 · 网页版 —— 主题初始化
   必须紧跟样式表、同步执行：晚一步就会先闪一下浅色再跳成深色。
   取值规则：手动选择 > 系统偏好。切换按钮在 app.js 末尾，它只管「点过之后」写入。
   这里刻意不用 @media prefers-color-scheme —— 深色统一由 html.dark 驱动，
   否则「系统是深色 + 用户手动选浅色」时，媒体查询会把用户的意愿压回去。 */
(function(){try{
  var t=localStorage.getItem('ceh.theme');
  var dark=(t==='dark')||(t!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches);
  if(dark)document.documentElement.classList.add('dark');
  document.documentElement.setAttribute('data-theme',t||'auto');
}catch(e){}})();
