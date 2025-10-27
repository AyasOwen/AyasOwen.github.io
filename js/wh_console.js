// /js/wh_console.js
(function(){
  "use strict";
  if(!window.WH) window.WH = {};
  const { $, $$, api, auth, setText, show, guardUsersTab, healthGuard } = WH;

  // 缓存
  let shelvesCache = [], invAllCache = [], tasksCache = [];

  // ========== Shelves ==========
  async function loadShelves(){
    setText($("#s-msg"), "");
    const q = ($("#s-q") && $("#s-q").value) ? $("#s-q").value.trim() : "";
    const path = q ? "/api/shelves?q=" + encodeURIComponent(q) : "/api/shelves";
    try{
      const rows = await api(path, "GET");
      shelvesCache = Array.isArray(rows) ? rows : [];
      renderShelves(shelvesCache);
    }catch(e){
      console.error("loadShelves error:", e);
      setText($("#s-msg"), String(e.message || e));
    }
  }

  function renderShelves(rows){
    rows = rows || [];
    const fcode = ($("#s-filter-code") && $("#s-filter-code").value) ? $("#s-filter-code").value.trim().toLowerCase() : "";
    const frow  = ($("#s-filter-row") && $("#s-filter-row").value) ? $("#s-filter-row").value : "";
    const fcol  = ($("#s-filter-col") && $("#s-filter-col").value) ? $("#s-filter-col").value : "";
    const list = rows.filter(r=>{
      if(fcode && !(r.code||"").toLowerCase().includes(fcode)) return false;
      if(frow && +r.row_idx !== +frow) return false;
      if(fcol && +r.col_idx !== +fcol) return false;
      return true;
    });

    const tb = $("#s-tbody"); if(!tb) return;
    tb.innerHTML = "";
    list.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.id}</td><td>${r.code}</td><td>${r.row_idx}</td><td>${r.col_idx}</td>
                      <td>${r.capacity ?? ""}</td><td>${r.quantity ?? ""}</td><td>${r.status}</td>
                      <td>${r.x_mm ?? ""}</td><td>${r.y_mm ?? ""}</td><td>${r.height_mm ?? ""}</td>`;
      tb.appendChild(tr);
      // 点击填表（管理员）
      tr.onclick = () => {
        const adminPanel = document.querySelector('.admin-only');
        if (!adminPanel || getComputedStyle(adminPanel).display === 'none') return;
        $("#s-id").value = r.id || "";
        $("#s-code").value = r.code || "";
        $("#s-row").value = r.row_idx ?? "";
        $("#s-col").value = r.col_idx ?? "";
        $("#s-cap").value = r.capacity ?? "";
        $("#s-x").value = r.x_mm ?? "";
        $("#s-y").value = r.y_mm ?? "";
        $("#s-h").value = r.height_mm ?? "";
        $("#s-st").value = r.status || "unknown";
        $("#s-note").value = r.note || "";
      };
      tb.appendChild(tr);
    });
    setText($("#s-msg"), `共 ${list.length} 行`);
  }

  async function createShelf(){ /* ... same as before ... */
    try{
      const body = {
        code: $("#s-code").value.trim(),
        row_idx: +$("#s-row").value, col_idx: +$("#s-col").value,
        capacity: +$("#s-cap").value,
        x_mm: $("#s-x").value? +$("#s-x").value : undefined,
        y_mm: $("#s-y").value? +$("#s-y").value : undefined,
        height_mm: $("#s-h").value? +$("#s-h").value : undefined,
        status: $("#s-st").value,
        note: $("#s-note").value || null
      };
      await api("/api/shelves","POST",body);
      await loadShelves();
    }catch(e){ alert("新建失败: " + (e.message || e)); }
  }
  async function updateShelf(){
    try{
      const id = +$("#s-id").value; if(!id) return alert("请输入 shelf_id");
      const body = {};
      [["row_idx","#s-row"],["col_idx","#s-col"],["capacity","#s-cap"],
       ["x_mm","#s-x"],["y_mm","#s-y"],["height_mm","#s-h"],
       ["status","#s-st"],["note","#s-note"]].forEach(([k,sel])=>{
         const el = document.querySelector(sel);
         if(!el) return;
         const v = el.value;
         if(v!=="" && v!=null) body[k] = (k==="status"||k==="note") ? v : +v;
      });
      await api(`/api/shelves/${id}`,"PATCH",body);
      await loadShelves();
    }catch(e){ alert("更新失败: " + (e.message || e)); }
  }
  async function deleteShelf(){
    try{
      const id = +$("#s-id").value; if(!id) return alert("请输入 shelf_id");
      if(!confirm(`确认删除 shelf ${id} ?`)) return;
      await api(`/api/shelves/${id}`,"DELETE");
      await loadShelves();
    }catch(e){ alert("删除失败: " + (e.message || e)); }
  }

  // ===== Inventory simplified =====
  async function loadInventoryAll(){
    setText($("#i-msg"), "");
    try{
      // 优先尝试后端提供的总表接口
      const rows = await api("/api/inventory/all","GET").catch(()=>null);
      if(Array.isArray(rows)) {
        invAllCache = rows;
      } else {
        // fallback: 逐个 shelf 调用 inventory
        const sh = await api("/api/shelves","GET");
        const all = [];
        for(const s of sh){
          try{
            const d = await api(`/api/inventory?shelf_id=${s.id}`,"GET");
            (d.items||[]).forEach(it=> all.push({shelf_id:d.shelf_id, code:s.code, ...it}));
          }catch(_){}
        }
        invAllCache = all;
      }
    }catch(e){
      console.error("loadInventoryAll error:", e);
      invAllCache = [];
    }
    renderInventory(invAllCache);
  }
  function renderInventory(rows){
    rows = rows || [];
    const fcode = $("#si-filter-item").value.trim().toLowerCase();
    const list = rows.filter(r=>{
      if(fcode && !(r.item_type||"").toLowerCase().includes(fcode)) return false;
      return true;
    });
    const tb = $("#si-tbody"); if(!tb) return;
    tb.innerHTML = "";
    list.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.id}</td><td>${r.shelf_id}</td><td>${r.item_type}</td>
                      <td>${r.quantity}</td><td>${r.updated_at}</td>`;
      tb.appendChild(tr);
    });
    setText($("#si-msg"), `共 ${list.length} 行`);
  }
  async function invUpsert(){
    try{
      const body = {
        code: $("#i-code").value.trim() || undefined,
        shelf_id: $("#i-sid").value ? +$("#i-sid").value : undefined,
        item_type: $("#i-type").value.trim(),
        quantity: +$("#i-qty").value
      };
      await api("/api/inventory/upsert","POST",body);
      await loadInventoryAll();
    }catch(e){ alert("保存失败: " + (e.message || e)); }
  }
  async function invDelete(){
    try{
      const body = {
        code: $("#i-code").value.trim() || undefined,
        shelf_id: $("#i-sid").value ? +$("#i-sid").value : undefined,
        item_type: $("#i-type").value.trim()
      };
      if(!body.item_type) return alert("请填写 item_type");
      if(!body.code && !body.shelf_id) return alert("请填写 code 或 shelf_id");
      if(!confirm("确认删除该库存行？")) return;
      await api("/api/inventory","DELETE",body);
      await loadInventoryAll();
    }catch(e){ alert("删除失败: " + (e.message || e)); }
  }

  // ===== Tasks =====
  async function loadTasks(){
    try{
      const st = $("#t-filter-status").value;
      const sid= $("#t-filter-sid").value;
      let path = "/api/tasks";
      const qs = [];
      if(st) qs.push("status=" + encodeURIComponent(st));
      if(sid) qs.push("shelf_id=" + encodeURIComponent(sid));
      if(qs.length) path += "?" + qs.join("&");
      tasksCache = await api(path,"GET");
      renderTasks(tasksCache);
    }catch(e){
      console.error("loadTasks error:", e);
      setText($("#t-msg"), String(e.message || e));
    }
  }
  function renderTasks(rows){
    rows = rows || [];
    const tb = $("#t-tbody"); if(!tb) return;
    tb.innerHTML = "";
    rows.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.id}</td><td>${r.type}</td><td>${r.shelf_id}</td>
                      <td>${r.status}</td><td>${r.assigned_to||""}</td>
                      <td>${typeof r.payload==='object'? JSON.stringify(r.payload): (r.payload||"")}</td>
                      <td>${r.created_at}</td><td>${r.updated_at}</td>`;
      tb.appendChild(tr);
    });
    setText($("#t-msg"), `共 ${rows.length} 行`);
  }
  async function createTask(){
    try{
      const body = {
        type: $("#t-type").value,
        shelf_id: +$("#t-shelf").value,
        assigned_to: $("#t-who").value || undefined,
        status: $("#t-status").value,
        payload: $("#t-payload").value ? JSON.parse($("#t-payload").value) : undefined
      };
      await api("/api/tasks","POST",body);
      await loadTasks();
    }catch(e){ alert("创建任务失败: " + (e.message || e)); }
  }

  // ===== Observations =====
  async function loadObs(){
    try{
      const code = ($("#o-code") && $("#o-code").value) ? $("#o-code").value.trim() : "";
      const sid  = ($("#o-sid") && $("#o-sid").value) ? $("#o-sid").value : "";
      const lim  = ($("#o-limit") && $("#o-limit").value) ? $("#o-limit").value : 50;
      const qs = [];
      if(code) qs.push("code=" + encodeURIComponent(code));
      if(sid) qs.push("shelf_id=" + encodeURIComponent(sid));
      qs.push("limit=" + encodeURIComponent(lim));
      const path = "/api/observations" + (qs.length ? ("?" + qs.join("&")) : "");
      const rows = await api(path,"GET");
      const tb = $("#o-tbody"); if(!tb) return;
      tb.innerHTML = "";
      rows.forEach(r=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${r.observed_status}</td><td>${r.item_type || ""}</td><td>${r.quantity_est ?? ""}</td><td>${r.occupancy_pct ?? ""}</td><td>${r.confidence ?? ""}</td><td>${r.x_mm ?? ""},${r.y_mm ?? ""}</td><td>${r.source||""}</td><td>${r.robot_id||""}</td><td>${r.detected_at||""}</td>`;
        tb.appendChild(tr);
      });
      setText($("#o-msg"), `共 ${rows.length} 行`);
    }catch(e){ console.error("loadObs error:", e); setText($("#o-msg"), String(e.message || e)); }
  }

  // ===== Users =====
  async function loadUsersGuarded(){
    const ok = await guardUsersTab();
    if(!ok) return alert("口令错误，无法查看 Users");
    await loadUsers();
  }
  async function loadUsers(){
    try{
      const rows = await api("/api/users","GET");
      const tb = $("#u-tbody"); if(!tb) return;
      tb.innerHTML = "";
      rows.forEach(r=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${r.id}</td><td>${r.username}</td><td>${r.role}</td>
                        <td>${r.created_at}</td><td>${r.updated_at}</td>`;
        tb.appendChild(tr);
      });
      setText($("#u-msg"), `共 ${rows.length} 行`);
    }catch(e){ setText($("#u-msg"), String(e.message || e)); }
  }
  async function updateUser(){
    try{
      const id = +$("#u-id").value; if(!id) return alert("请输入 user_id");
      const body = { role: $("#u-role").value, status: $("#u-status").value };
      const pw = $("#u-pass").value; if(pw) body.password = pw;
      await api(`/api/users/${id}`,"PATCH", body);
      $("#u-pass").value = "";
      await loadUsers();
    }catch(e){ alert("更新失败: " + (e.message || e)); }
  }
  async function delUser(){
    try{
      const id = +$("#u-id").value; if(!id) return alert("请输入 user_id");
      if(!confirm(`确认删除 user ${id} ?`)) return;
      await api(`/api/users/${id}`,"DELETE");
      await loadUsers();
    }catch(e){ alert("删除失败: " + (e.message || e)); }
  }

  // ========== Mount / 权限 / 事件绑定 ==========
  async function mount(){
    // 1) 先 healthCheck（会写 #wh-api），若失败直接显示 guard
    const ok = await healthGuard("#wh-main","#wh-guard");
    if(!ok) return;

    // 2) 检查是否已登录（token 存在）
    const tok = auth.token();
    if(!tok){
      // 没有 token -> 跳回登录
      console.warn("no token found in localStorage");
      try { location.replace("/warehouse/login/"); } catch(e){ location.href="/warehouse/login/"; }
      return;
    }

    // 3) 进一步通过 /api/auth/me 校验 token（若失效会抛 401）
    try{
      const me = await api("/api/auth/me","GET");
      // 将最新身份写回 localStorage 以便其它页面读取
      auth.set(tok, me.role || auth.role(), me.username || auth.name());
      setText($("#who"), me.username || auth.name());
      setText($("#role"), me.role || auth.role());
    }catch(e){
      console.error("auth/me failed:", e);
      // token 无效 -> 清并跳登录（同时给出调试信息）
      auth.clear();
      alert("鉴权失败，请重新登录（原因：" + (e.message || e) + "）");
      try { location.replace("/warehouse/login/"); } catch(ex) { location.href="/warehouse/login/"; }
      return;
    }

    // 权限控制
    const isAdmin = (auth.role() === "admin");
    $$(".admin-only").forEach(el=> show(el, isAdmin));
    // 显示额外 tab
    const obsBtn = document.querySelector('[data-tab="shelf_observations"]');
    const usersBtn = document.querySelector('[data-tab="users"]');
    if(obsBtn) obsBtn.style.display = isAdmin ? "" : "none";
    if(usersBtn) usersBtn.style.display = isAdmin ? "" : "none";

    // 事件绑定（tabs / buttons）
    $$("#tabs .data-tab").forEach(btn => btn.addEventListener("click", ()=> switchTab(btn.getAttribute("data-tab"))));
    // Shelves
    $("#s-btn-search") && $("#s-btn-search").addEventListener("click", loadShelves);
    $("#s-btn-apply") && $("#s-btn-apply").addEventListener("click", ()=> renderShelves(shelvesCache));
    if(isAdmin){
      $("#s-btn-create") && $("#s-btn-create").addEventListener("click", createShelf);
      $("#s-btn-update") && $("#s-btn-update").addEventListener("click", updateShelf);
      $("#s-btn-delete") && $("#s-btn-delete").addEventListener("click", deleteShelf);
    }
    // Inventory
    $("#i-btn-load") && $("#i-btn-load").addEventListener("click", loadInventoryAll);
    if(isAdmin){
      $("#i-btn-upsert") && $("#i-btn-upsert").addEventListener("click", invUpsert);
      $("#i-btn-del") && $("#i-btn-del").addEventListener("click", invDelete);
    }
    // Tasks
    $("#t-btn-load") && $("#t-btn-load").addEventListener("click", loadTasks);
    if(isAdmin){
      $("#t-btn-create") && $("#t-btn-create").addEventListener("click", createTask);
    }
    // Observations
    if(isAdmin){
      $("#o-btn-load") && $("#o-btn-load").addEventListener("click", loadObs);
    }
    // Users
    if(isAdmin){
      $("#u-btn-load") && $("#u-btn-load").addEventListener("click", loadUsersGuarded);
      $("#u-btn-update") && $("#u-btn-update").addEventListener("click", updateUser);
      $("#u-btn-del") && $("#u-btn-del").addEventListener("click", delUser);
    }
    // Logout
    $("#btnLogout") && $("#btnLogout").addEventListener("click", ()=> { auth.clear(); try{ location.replace("/warehouse/login/"); }catch(e){ location.href="/warehouse/login/"; } });

    // 默认打开
    switchTab("shelves");
  }

  document.addEventListener('DOMContentLoaded', mount);

  function switchTab(name){
    $$("#tabs .data-tab").forEach(b => b.classList.toggle("active", b.getAttribute("data-tab") === name));

    $$(".tab-panel").forEach(p => p.style.display = (p.id === ("tab-" + name)) ? "" : "none");
    if(name === "shelves") loadShelves();
    if(name === "shelf_inventory") loadInventoryAll();
    if(name === "tasks") loadTasks();
    if(name === "shelf_observations") loadObs();
    if(name === "users") loadUsersGuarded();
  }

  // mount on DOM ready
  document.addEventListener("DOMContentLoaded", function(){
    // Expose for console debugging
    window.WH = window.WH || {};
    window.WH._internal = { loadShelves, loadInventoryAll, loadTasks, loadObs, loadUsers };
    mount();
  });

  // expose mount for pjax compatibility
  window.WH_PAGE_MOUNT = mount;

})();
