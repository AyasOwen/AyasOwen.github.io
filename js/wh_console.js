// /js/wh_console.js
(function(){
  "use strict";
  if(!window.WH) window.WH = {};
  const { $, $$, api, auth, setText, show, guardUsersTab, healthGuard } = WH;

  // 缓存
  let shelvesCache = [], invAllCache = [], tasksCache = [];
  let usersCache = [];

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

  async function createShelf(){
    setText($("#s-msg"), "");

    // 必须使用 ?.value 安全获取值
    const code = $("#s-code")?.value?.trim();
    const row_idx = $("#s-row")?.value;
    const col_idx = $("#s-col")?.value;
    const capacity = $("#s-cap")?.value; // 确保这是正确的 ID

    if(!code || !row_idx || !col_idx || !capacity) {
        setText($("#s-msg"), "请完整填写货架 code, row, col 和 capacity", "error");
        return;
    }

    try{
        const body = {
            code: code,
            row_idx: +row_idx, col_idx: +col_idx,
            capacity: +capacity,
            // 确保可选字段也使用安全获取
            x_mm: $("#s-x")?.value ? +$("#s-x").value : undefined,
            y_mm: $("#s-y")?.value ? +$("#s-y").value : undefined,
            height_mm: $("#s-h")?.value ? +$("#s-h").value : undefined,
            status: $("#s-st")?.value,
            note: $("#s-note")?.value || null
        };

        await api("/api/shelves","POST",body);
        setText($("#s-msg"), "新建成功", "ok");
        await loadShelves();
    }catch(e){
        setText($("#s-msg"), "新建失败: " + (e.message || e), "error");
    }
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
  // ====== Inventory ======
  async function loadInventoryAll(){
    setText($("#i-msg"), "");
    const tb = $("#i-tbody"); if(!tb) return;
    tb.innerHTML = "";

    let rows = [];
    try{
      rows = await api("/api/inventory/all","GET");
      invAllCache = rows;
    }catch(e){
      try{
        const sh = await api("/api/shelves","GET");
        const all = [];
        for(const s of sh){
          try{
            const d = await api(`/api/inventory?shelf_id=${s.id}`,"GET");
            (d.items||[]).forEach(it=> all.push({shelf_id:d.shelf_id, code:s.code, ...it}));
          }catch(_){}
        }
        rows = all;
        invAllCache = rows;
      }catch(ee){
        invAllCache = [];
      }
    }
    const fcode = $("#i-filter-code").value.trim().toLowerCase();
    const ftype = $("#i-filter-type").value.trim().toLowerCase();
    const list = rows.filter(r=>{
      if(fcode && !(r.code||"").toLowerCase().includes(fcode)) return false;
      if(ftype && !(r.item_type||"").toLowerCase().includes(ftype)) return false;
      return true;
    });

    list.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.shelf_id}</td><td>${r.code||""}</td><td>${r.item_type}</td>
                      <td>${r.quantity}</td><td>${r.updated_at}</td>`;
      tb.appendChild(tr);
    });
    setText($("#i-msg"), `共 ${list.length} 行`);
  }

  function renderInventory(rows){
    rows = rows || [];
    const tb = $("#i-tbody"); if(!tb) return;
    tb.innerHTML = ""; // 确保清除

    const fcode = $("#i-filter-code").value.trim().toLowerCase();
    const ftype = $("#i-filter-type").value.trim().toLowerCase();
    const list = rows.filter(r=>{
      if(fcode && !(r.code||"").toLowerCase().includes(fcode)) return false;
      if(ftype && !(r.item_type||"").toLowerCase().includes(ftype)) return false;
      return true;
    });

    list.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.shelf_id}</td><td>${r.code||""}</td><td>${r.item_type}</td>
                      <td>${r.quantity}</td><td>${r.updated_at}</td>`;
      tb.appendChild(tr);
    });
    setText($("#i-msg"), `共 ${list.length} 行`);
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
  async function loadTasks(forceReload = false){
    setText($("#t-msg"), "");
    try{
        const tb = $("#t-tbody");
        if(!tb) return;
        if(forceReload || tasksCache.length === 0){
            tasksCache = await api("/api/tasks","GET");
        }

        const rows = tasksCache;
        const st = ($("#t-filter-status")?.value || "").trim();
        const sid= ($("#t-filter-sid")?.value || "").trim();

        const list = rows.filter(r => {
            if (st && r.status !== st) return false;
            if (sid && String(r.shelf_id) !== sid) return false;
            return true;
        });

        tb.innerHTML = "";
        list.forEach(r=>{
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${r.id}</td><td>${r.type}</td><td>${r.shelf_id}</td>
                             <td>${r.status}</td><td>${r.assigned_to||""}</td>
                             <td>${typeof r.payload==='object'? JSON.stringify(r.payload): (r.payload||"")}</td>
                             <td>${r.created_at}</td><td>${r.updated_at}</td>`;
            tb.appendChild(tr);
        });

        setText($("#t-msg"), `共 ${list.length} 行 (总数: ${rows.length})`);
    }catch(e){
        console.error("loadTasks error:", e);
        setText($("#t-msg"), String(e.message || e), "error");
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
        const ttype = $("#t-type").value;
        const shelf_id_val = $("#t-sid").value;
        const who = $("#t-who").value;
        const payload_val = $("#t-payload").value;

        if(!ttype) return alert("任务类型不能为空");
        if(!shelf_id_val || isNaN(+shelf_id_val)) return alert("shelf_id 必填且必须是有效数字");

        const body = {
            type: ttype,
            shelf_id: +shelf_id_val,
            assigned_to: who || undefined,
            payload: payload_val ? JSON.parse(payload_val) : undefined
        };

        // 调用 API
        await api("/api/tasks","POST",body);

        // 清空输入框
        $("#t-sid").value = "";
        $("#t-who").value = "";
        $("#t-payload").value = "";

        alert("任务创建成功");
        await loadTasks(true);
    }catch(e){
        console.error("创建任务失败:", e);
        alert("创建任务失败: " + (e.message || e));
    }
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
      const tb = $("#o-tbody"); if(!tb) return;
      tb.innerHTML = "";
      const rows = await api(path,"GET");
      rows.forEach(r=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${r.shelf_id}</td><td>${r.code}</td><td>${r.observed_status}</td>
                      <td>${r.item_type||""}</td><td>${r.quantity_est??""}</td>
                      <td>${r.occupancy_pct??""}</td><td>${r.confidence??""}</td>
                      <td>${r.x_mm??""},${r.y_mm??""}</td><td>${r.source}</td><td>${r.robot_id??""}</td>
                      <td>${r.detected_at}</td>`;
        tb.appendChild(tr);
      });
      setText($("#o-msg"), `共 ${rows.length} 行`);
    }catch(e){ console.error("loadObs error:", e); setText($("#o-msg"), String(e.message || e)); }
  }

  // ===== Users =====
  async function createUser(){
    try{
      // 假设 HTML 中有 #u-name, #u-pass, #u-role, #u-note
      const name = $("#u-name").value.trim();
      const pass = $("#u-pass").value.trim();
      const role = $("#u-role").value;
      // 使用可选链操作符处理可能不存在的元素
      const note = $("#u-note")?.value || null;
      if(!name || !pass) return alert("用户名和密码不能为空");

      const body = { username: name, password: pass, role: role, note: note };

      // 假设使用 /api/auth/register 接口创建新用户
      await api("/api/auth/register","POST",body);

      // 清空输入框（可选）
      $("#u-name").value = "";
      $("#u-pass").value = "";
      if($("#u-note")) $("#u-note").value = "";

      alert("用户创建成功");
      // 【关键】创建成功后，强制刷新列表 (loadUsers(true))
      await loadUsers(true);
    }catch(e){ alert("创建失败: " + (e.message || e)); }
  }

  async function updateUser(){
    setText($("#u-msg"), "");
    try{
        const uid = +$("#u-id")?.value;
        if(!uid) return setText($("#u-msg"), "请输入 user_id 进行更新", "error");

        const body = {};
        if($("#u-pass")?.value) body.password = $("#u-pass").value;
        if($("#u-role")?.value) body.role = $("#u-role").value;
        if($("#u-status")?.value) body.status = $("#u-status").value;

        const noteEl = $("#u-note");
        if(noteEl && (noteEl.value !== null && noteEl.value !== undefined)) {
             body.note = noteEl.value || null; // 允许将 note 清空为 null
        }

        if (Object.keys(body).length === 0) return setText($("#u-msg"), "请输入要更新的字段", "error");

        await api(`/api/users/${uid}`,"PATCH",body);
        setText($("#u-msg"), `用户 ${uid} 更新成功`, "ok");
        await loadUsers(true);
    }catch(e){
        setText($("#u-msg"), String(e.message || e), "error");
    }
  }

  async function delUser(){
      setText($("#u-msg"), "");
      try{
          const uid = +$("#u-id")?.value;
          if(!uid) return setText($("#u-msg"), "请输入 user_id 进行删除", "error");

          if(!confirm(`确认删除用户 ${uid} 吗？`)) return;

          await api(`/api/users/${uid}`,"DELETE");
          setText($("#u-msg"), `用户 ${uid} 删除成功`, "ok");
          $("#u-id").value = "";
          await loadUsers(true);
      }catch(e){
          setText($("#u-msg"), String(e.message || e), "error");
      }
  }

  async function loadUsersGuarded(){
    const ok = await guardUsersTab(); //
    if(!ok) return alert("口令错误，无法查看 Users");
    await loadUsers(true); // 默认打开时强制加载
  }

  // 统一加载和渲染逻辑
  async function loadUsers(forceReload = false){
      setText($("#u-msg"), "");
      try{
        // forceReload 为 true 时，或缓存为空时，从后端获取数据
        if(forceReload || usersCache.length === 0){
          usersCache = await api("/api/users","GET");
        }

        const rows = usersCache;
        const tb = $("#u-tbody"); if(!tb) return;

        // 【新增】搜索和过滤逻辑 (客户端)
        const q    = ($("#u-q")?.value || "").trim().toLowerCase();
        const role = ($("#u-filter-role")?.value || "").trim().toLowerCase();

        const list = rows.filter(r => {
            // 搜索: 检查用户名是否包含 q
            if (q && !(r.username || "").toLowerCase().includes(q)) return false;
            // 过滤: 检查角色是否匹配 role
            if (role && (r.role || "").toLowerCase() !== role) return false;
            return true;
        });

        tb.innerHTML = "";
        // 【使用过滤后的 list 进行渲染】
        list.forEach(r=>{
          const tr = document.createElement("tr");
          tr.innerHTML = `<td>${r.id}</td><td>${r.username}</td><td>${r.role}</td><td>${r.status}</td>
                          <td>${r.created_at}</td><td>${r.updated_at}</td>`;
          tb.appendChild(tr);
        });
        setText($("#u-msg"), `共 ${list.length} 行`);
      }catch(e){ setText($("#u-msg"), String(e.message || e), "error"); }
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
    $("#t-btn-load") && $("#t-btn-load").addEventListener("click", () => loadTasks(true));
    if(isAdmin){
      $("#t-btn-create") && $("#t-btn-create").addEventListener("click", createTask);
    }
    // Observations
    if(isAdmin){
      $("#o-btn-load") && $("#o-btn-load").addEventListener("click", loadObs);
    }
    // Users
    if(isAdmin){
  // 【只绑定搜索/过滤，不绑定 loadUsersGuarded 或 #u-btn-load】
      $("#u-btn-search") && ($("#u-btn-search").onclick = loadUsers);
      $("#u-btn-apply") && ($("#u-btn-apply").onclick  = loadUsers);

      $("#u-btn-create") && ($("#u-btn-create").onclick = createUser);
      $("#u-btn-update") && ($("#u-btn-update").onclick = updateUser);
      $("#u-btn-delete") && ($("#u-btn-delete").onclick = delUser);
    }
    // Logout
    $("#btnLogout") && ($("#btnLogout").onclick = WH.logout);

    // 默认打开
    await switchTab("shelves");
  }

  document.addEventListener('DOMContentLoaded', mount);

  async function switchTab(name){
    $$("#tabs .data-tab").forEach(b => b.classList.toggle("active", b.getAttribute("data-tab") === name));

    $$(".tab-panel").forEach(p => p.style.display = (p.id === ("tab-" + name)) ? "" : "none");
    if(name === "shelves") loadShelves();
    if(name === "shelf_inventory") loadInventoryAll();
    if(name === "tasks") loadTasks();
    if(name === "shelf_observations") loadObs();

    if(name === "users"){
      if (await WH.guardUsersTab()) loadUsers(); // 必须使用 await
    }
  }

  // mount on DOM ready
  document.addEventListener('DOMContentLoaded', mount);

  // expose mount for pjax compatibility
  window.WH_PAGE_MOUNT = mount;

})();
