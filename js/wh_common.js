// /js/wh_common.js
(function(){
  "use strict";

  // 最终使用的 API_BASE（页面里请先通过 script. window.WH_API_BASE = "http://127.0.0.1:8000";）
  const API_BASE = (window.WH_API_BASE || "").replace(/\/+$/,"");
  const USERS_GUARD_SHA256 = (window.WH_USERS_GUARD_SHA256 || "").trim();

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  function setText(el, t){ if(!el) return; el.textContent = t; }
  function show(el, on){ if(!el) return; el.style.display = on ? "" : "none"; }

  // 兼容大小写 key（保证 login / console 两边都能识别）
  const KEYS = {
    LOWER: { T: "wh_token", R: "wh_role", N: "wh_name" },
    UPPER: { T: "WH_TOKEN", R: "WH_ROLE", N: "WH_USER" }
  };

  const auth = {
    token: () => {
      return localStorage.getItem(KEYS.UPPER.T) || localStorage.getItem(KEYS.LOWER.T) || "";
    },
    role: () => {
      return localStorage.getItem(KEYS.UPPER.R) || localStorage.getItem(KEYS.LOWER.R) || "";
    },
    name: () => {
      return localStorage.getItem(KEYS.UPPER.N) || localStorage.getItem(KEYS.LOWER.N) || "";
    },
    // 写入两套 key 保兼容
    set: (t, r, n) => {
      if (t !== undefined && t !== null) {
        localStorage.setItem(KEYS.LOWER.T, t);
        localStorage.setItem(KEYS.UPPER.T, t);
      }
      if (r !== undefined) {
        localStorage.setItem(KEYS.LOWER.R, r || "");
        localStorage.setItem(KEYS.UPPER.R, r || "");
      }
      if (n !== undefined) {
        localStorage.setItem(KEYS.LOWER.N, n || "");
        localStorage.setItem(KEYS.UPPER.N, n || "");
      }
    },
    clear: () => {
      Object.values(KEYS).forEach(k => {
        localStorage.removeItem(k.T);
        localStorage.removeItem(k.R);
        localStorage.removeItem(k.N);
      });
    }
  };

  // fetch 封装（自动加 Authorization）
  async function api(path, method="GET", body){
    if(!API_BASE) {
      throw new Error("no-api-base");
    }
    const headers = {"Content-Type":"application/json"};
    const t = auth.token();
    if(t) headers["Authorization"] = "Bearer " + t;

    const ctl = new AbortController();
    const timeout = setTimeout(()=>ctl.abort(), 12000);
    try{
      const res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal });
      const ctype = (res.headers.get("content-type") || "");
      const isJSON = ctype.indexOf("application/json") !== -1;
      const text = await res.text().catch(()=>"");
      const data = isJSON && text ? JSON.parse(text) : text;

      if(res.status === 401 || res.status === 403){
        // 授权失败 -> 清 token
        auth.clear();
        const err = new Error("Unauthorized");
        err.status = res.status;
        err.payload = data;
        throw err;
      }

      if(!res.ok){
        const msg = (data && data.error) ? data.error : (typeof data === "string" ? data : res.statusText);
        const err = new Error(msg || ("HTTP " + res.status));
        err.status = res.status;
        err.payload = data;
        throw err;
      }
      return data;
    }catch(e){
      if(e.name === "AbortError") throw new Error("timeout");
      throw e;
    }finally{
      clearTimeout(timeout);
    }
  }

  // 健康检测：把 API 文本写到 #wh-api（如果存在）
  async function healthGuard(selectorMain, selectorGuard){
    const main = selectorMain ? $(selectorMain) : null;
    const guard = selectorGuard ? $(selectorGuard) : null;

    // 写入 API 文本到页面显示，便于排错
    try {
      const apiLabel = document.getElementById("wh-api");
      if(apiLabel) apiLabel.textContent = API_BASE || "--";
    } catch(e){}

    if(!API_BASE){
      // 若没有配置 API_BASE，直接显示 guard
      if(main) show(main, false);
      if(guard) show(guard, true);
      return false;
    }

    try{
      const ctl = new AbortController();
      const timer = setTimeout(()=>ctl.abort(), 4000);
      const res = await fetch(API_BASE + "/api/health", { signal: ctl.signal });
      clearTimeout(timer);
      if(res.ok){
        if(main) show(main, true);
        if(guard) show(guard, false);
        return true;
      }else{
        if(main) show(main, false);
        if(guard) show(guard, true);
        return false;
      }
    }catch(e){
      if(main) show(main, false);
      if(guard) show(guard, true);
      return false;
    }
  }

  // login: 调用 /api/auth/login 保存 token（写入两套 key）
  async function login(username, password){
    const d = await api("/api/auth/login","POST",{username,password});
    const tok = d && (d.access_token || d.token || d.accessToken || d.jwt);
    const role = d && (d.role || d.user_role || "");
    const uname = d && (d.username || d.user || username);

    if(!tok) {
      const err = new Error("登录成功但未收到 token");
      err.payload = d;
      throw err;
    }

    auth.set(tok, role, uname);

    try { location.replace("/warehouse/console/"); }
    catch { location.href = "/warehouse/console/"; }
    return d;
  }

  function logout(){
    auth.clear();
    try{ location.replace("/warehouse/login/"); }catch(e){ location.href="/warehouse/login/"; }
  }

  // Users 二次口令（前端 sha256）
  async function sha256Hex(s){
    const enc = new TextEncoder().encode(s);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  async function guardUsersTab(){
    if(!USERS_GUARD_SHA256) return true;
    const input = prompt("请输入 Users 分栏口令");
    if(input === null) return false;
    const h = await sha256Hex(input);
    return (h === USERS_GUARD_SHA256);
  }

  // 导出
  window.WH = Object.assign(window.WH || {}, {
    API_BASE, api, healthGuard, auth, login, logout, guardUsersTab,
    $, $$, setText, show, sha256Hex
  });

  // pjax 兼容
  document.addEventListener("pjax:complete", ()=>{ if(typeof window.WH_PAGE_MOUNT === 'function') window.WH_PAGE_MOUNT(); });

})();
