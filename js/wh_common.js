// wh_common.js  —— 公共工具（兼容大写/小写 localStorage key）
(function(){
  // === 配置（可在页面里覆盖 window.WH_API_BASE / window.WH_USERS_GUARD_SHA256） ===
  const API_BASE = (window.WH_API_BASE || "").trim();     // 例如 https://localhost:8000 或隧道域名
  const USERS_GUARD_SHA256 = (window.WH_USERS_GUARD_SHA256 || "").trim(); // Users 分栏二次口令的 SHA-256(HEX)

  // === 简易 DOM ===
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  function setText(el, t){ if(!el) return; el.textContent=t; }
  function show(el, on){ if(!el) return; el.style.display = on ? "" : "none"; }

  // === 鉴权本地存储（兼容两种写法） ===
  // 支持旧代码使用 "WH_TOKEN"/"WH_ROLE"/"WH_USER" 以及 新代码使用 "wh_token"/"wh_role"/"wh_name"
  const KEYS = {
    LOWER: { T: "wh_token", R: "wh_role", N: "wh_name" },
    UPPER: { T: "WH_TOKEN", R: "WH_ROLE", N: "WH_USER" }
  };

  const auth = {
    // token() 优先返回任意一个存在的 token（优先大写以兼容旧脚本）
    token: () => {
      return localStorage.getItem(KEYS.UPPER.T) || localStorage.getItem(KEYS.LOWER.T) || "";
    },
    role:  () => {
      return localStorage.getItem(KEYS.UPPER.R) || localStorage.getItem(KEYS.LOWER.R) || "";
    },
    name:  () => {
      return localStorage.getItem(KEYS.UPPER.N) || localStorage.getItem(KEYS.LOWER.N) || "";
    },
    // set 时同时写入两套 key，保证兼容性
    set:   (t, r, n) => {
      if(t !== undefined && t !== null){
        localStorage.setItem(KEYS.LOWER.T, t);
        localStorage.setItem(KEYS.UPPER.T, t);
      }
      if(r !== undefined){
        localStorage.setItem(KEYS.LOWER.R, r || "");
        localStorage.setItem(KEYS.UPPER.R, r || "");
      }
      if(n !== undefined){
        localStorage.setItem(KEYS.LOWER.N, n || "");
        localStorage.setItem(KEYS.UPPER.N, n || "");
      }
    },
    // clear 时同时移除两套 key
    clear: () => {
      Object.values(KEYS).forEach(kset => {
        localStorage.removeItem(kset.T);
        localStorage.removeItem(kset.R);
        localStorage.removeItem(kset.N);
      });
    }
  };

  // === 请求封装（自动加 Bearer / 统一错误） ===
  async function api(path, method="GET", body){
    const headers = {"Content-Type":"application/json"};
    const t = auth.token(); if(t) headers["Authorization"]="Bearer "+t;
    const ctl = new AbortController();
    const timeout = setTimeout(()=>ctl.abort(), 12000); // 12s 超时
    try{
      const res = await fetch((API_BASE||"") + path, {method, headers, body: body?JSON.stringify(body):undefined, signal: ctl.signal});
      const ctype = (res.headers.get("content-type")||"");
      const isJSON = ctype.includes("application/json");
      const text = await res.text().catch(()=>"");
      const data = isJSON && text ? JSON.parse(text) : text;

      // 探测 401/403 -> 清空本地鉴权并抛出
      if(res.status === 401 || res.status === 403){
        auth.clear();
        const err = new Error("Unauthorized");
        err.status = res.status;
        err.payload = data;
        throw err;
      }

      if(!res.ok){
        const msg = (data && data.error) ? data.error : (typeof data === 'string' && data) ? data : res.statusText;
        const err = new Error(msg || ("HTTP " + res.status));
        err.status = res.status;
        err.payload = data;
        throw err;
      }
      return data;
    }catch(e){
      // 若是 fetch abort / network，包装信息
      if(e.name === "AbortError") throw new Error("timeout");
      throw e;
    }finally{
      clearTimeout(timeout);
    }
  }

  // === 健康检查：失败则显示“服务器未启动”占位，隐藏页面主体 ===
  async function healthGuard(selectorMain, selectorGuard){
    const main = selectorMain ? $(selectorMain) : null;
    const guard = selectorGuard ? $(selectorGuard) : null;
    try{
      const d = await api("/api/health","GET");
      const ok = d && d.ok === true;
      if(main) show(main, ok);
      if(guard) show(guard, !ok);
      return ok;
    }catch(e){
      if(main) show(main, false);
      if(guard) show(guard, true);
      return false;
    }
  }

  // === login/logout ===
  async function login(username, password){
    const d = await api("/api/auth/login","POST",{username,password});
    // 常见后端字段名：access_token / token / accessToken / jwt
    const tok = d && (d.access_token || d.token || d.accessToken || d.jwt || d.accessToken);
    const role = d && (d.role || d.user_role || d.role_name || "");
    const uname = d && (d.username || d.user || d.name || username);
    if(!tok) {
      // 若后端返回 200 但无 token，则仍抛错
      const err = new Error("登录成功但未收到 token");
      err.payload = d;
      throw err;
    }
    // 存两套 key（兼容旧代码）
    auth.set(tok, role, uname);
    // 登录成功后立即跳转（使用 replace 避开浏览器历史）
    try {
      location.replace("/warehouse/console/");
    } catch(e){
      // 在某些环境 replace 可能失败，fallback to href
      location.href = "/warehouse/console/";
    }
    return d;
  }

  function logout(){
    auth.clear();
    try{ location.replace("/warehouse/login/"); }catch(e){ location.href="/warehouse/login/"; }
  }

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
    $,$$, setText, show, sha256Hex
  });

  // PJAX 兼容：页面可在 pjax:complete 时再次挂载
  document.addEventListener("pjax:complete", ()=>{ if(typeof window.WH_PAGE_MOUNT==='function') window.WH_PAGE_MOUNT(); });
})();
