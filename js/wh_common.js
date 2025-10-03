// wh_common.js  —— 公共工具
(function(){
  // === 配置（可在页面里覆盖 window.WH_API_BASE / window.WH_USERS_GUARD_SHA256） ===
  const API_BASE = (window.WH_API_BASE || "").trim();     // 例如 https://localhost:8000 或隧道域名
  const USERS_GUARD_SHA256 = (window.WH_USERS_GUARD_SHA256 || "").trim(); // Users 分栏二次口令的 SHA-256(HEX)

  // === 简易 DOM ===
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  function setText(el, t){ if(!el) return; el.textContent=t; }
  function show(el, on){ if(!el) return; el.style.display = on ? "" : "none"; }

  // === 鉴权本地存储 ===
  const KEY_TOK="wh_token", KEY_ROLE="wh_role", KEY_NAME="wh_name";
  const auth = {
    token: () => localStorage.getItem(KEY_TOK),
    role:  () => localStorage.getItem(KEY_ROLE)||"",
    name:  () => localStorage.getItem(KEY_NAME)||"",
    set:   (t,r,n)=>{localStorage.setItem(KEY_TOK,t);localStorage.setItem(KEY_ROLE,r);localStorage.setItem(KEY_NAME,n);},
    clear: ()=>{localStorage.removeItem(KEY_TOK);localStorage.removeItem(KEY_ROLE);localStorage.removeItem(KEY_NAME);}
  };

  // === 请求封装（自动加 Bearer / 统一错误） ===
  async function api(path, method="GET", body){
    const headers = {"Content-Type":"application/json"};
    const t = auth.token(); if(t) headers["Authorization"]="Bearer "+t;
    const ctl = new AbortController();
    const timeout = setTimeout(()=>ctl.abort(), 12000); // 12s 超时
    try{
      const res = await fetch(API_BASE+path, {method, headers, body: body?JSON.stringify(body):undefined, signal: ctl.signal});
      const isJSON = (res.headers.get("content-type")||"").includes("application/json");
      const data = isJSON ? await res.json() : await res.text();
      if(!res.ok) throw new Error((data&&data.error)||res.statusText);
      return data;
    }finally{
      clearTimeout(timeout);
    }
  }

  // === 健康检查：失败则显示“服务器未启动”占位，隐藏页面主体 ===
  async function healthGuard(selectorMain, selectorGuard){
    const main = $(selectorMain), guard = $(selectorGuard);
    try{
      const d = await api("/api/health","GET");
      const ok = d && d.ok === true;
      show(main, ok); show(guard, !ok);
      return ok;
    }catch(e){
      show(main, false); show(guard, true);
      return false;
    }
  }

  // === 登录 / 登出 ===
  async function login(username, password){
    const d = await api("/api/auth/login","POST",{username,password});
    auth.set(d.access_token, d.role, d.username);
    return d;
  }
  function logout(){ auth.clear(); }

  // === Users 分栏二次口令校验（前端 SHA-256） ===
  async function sha256Hex(s){
    const enc = new TextEncoder().encode(s);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  async function guardUsersTab(){
    if(!USERS_GUARD_SHA256) return true; // 未配置就不校验
    const input = prompt("请输入 Users 分栏口令");
    if(input===null) return false;
    const h = await sha256Hex(input);
    return (h === USERS_GUARD_SHA256);
  }

  // === 导出到全局，供各页面使用 ===
  window.WH = Object.assign(window.WH||{}, {
    API_BASE, api, healthGuard, auth, login, logout, guardUsersTab,
    $,$$, setText, show
  });

  // PJAX 兼容：页面可在 pjax:complete 时再次挂载
  document.addEventListener("pjax:complete", ()=>{ if(typeof window.WH_PAGE_MOUNT==='function') window.WH_PAGE_MOUNT(); });
})();
