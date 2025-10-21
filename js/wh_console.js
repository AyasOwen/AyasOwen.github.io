// wh_console.js —— 控制台逻辑（保持原有功能，增加少量容错）
(function(){
  const {$, $$, api, auth, setText, show, guardUsersTab} = WH;

  // 状态
  let shelvesCache = [];       // 供前端过滤用
  let invAllCache = [];        // 同上
  let tasksCache = [];

  // ====== Shelves ======
  async function loadShelves(){
    setText($("#s-msg"), "");
    const q = $("#s-q").value.trim();
    let path = "/api/shelves";
    if(q) path += "?q="+encodeURIComponent(q);
    try{
      const rows = await api(path, "GET");
      shelvesCache = rows;
      renderShelves(rows);
    }catch(e){
      setText($("#s-msg"), String(e.message || e));
    }
  }
  function renderShelves(rows){
    rows = rows || [];
    // === 过滤逻辑 ===
    const fcode = $("#s-filter-code").value.trim().toLowerCase();
    const frow  = $("#s-filter-row").value;
    const fcol  = $("#s-filter-col").value;
    const list = rows.filter(r=>{
      if(fcode && !(r.code||"").toLowerCase().includes(fcode)) return false;
      if(frow && +r.row_idx !== +frow) return false;
      if(fcol && +r.col_idx !== +fcol) return false;
      return true;
    });

    // === 渲染表格 ===
    const tb = $("#s-tbody");
    if(!tb) return;
    tb.innerHTML = "";

    list.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.code}</td>
        <td>${r.row_idx}</td>
        <td>${r.col_idx}</td>
        <td>${r.capacity ?? ""}</td>
        <td>${r.quantity ?? ""}</td>
        <td>${r.status}</td>
        <td>${r.x_mm ?? ""},${r.y_mm ?? ""}</td>
      `;

      // ✅ 新增：点击表格行自动把数据填入右侧表单（仅管理员可见）
      tr.onclick = () => {
        const adminPanel = document.querySelector('.admin-only');
        if (!adminPanel || getComputedStyle(adminPanel).display === 'none') return;

        $("#s-id").value    = r.id || "";
        $("#s-code").value  = r.code || "";
        $("#s-row").value   = r.row_idx ?? "";
        $("#s-col").value   = r.col_idx ?? "";
        $("#s-cap").value   = r.capacity ?? "";
        $("#s-x").value     = r.x_mm ?? "";
        $("#s-y").value     = r.y_mm ?? "";
        $("#s-h").value     = r.height_mm ?? "";
        $("#s-st").value    = r.status || "unknown";
        $("#s-note").value  = r.note || "";
      };

      tb.appendChild(tr);
    });

    // === 更新信息 ===
    setText($("#s-msg"), `共 ${list.length} 行`);
  }

  async function createShelf(){
    try{
      const body = {
        code: $("#s-code").value.trim(),
        row_idx: +$("#s-row").value, col_idx: +$("#s-col").value,
        capacity: +$("#s-cap").value,
        x_mm: $("#s-x").value? +$("#s-x").value : null,
        y_mm: $("#s-y").value? +$("#s-y").value : null,
        height_mm: $("#s-h").value? +$("#s-h").value : null,
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

  // ====== Inventory ======
  async function loadInventoryAll(){
    setText($("#i-msg"), "");
    try{
      invAllCache = await api("/api/inventory/all","GET");
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
        invAllCache = all;
      }catch(ee){
        invAllCache = [];
      }
    }
    renderInventory(invAllCache);
  }
  function renderInventory(rows){
    rows = rows || [];
    const fcode = $("#i-filter-code").value.trim().toLowerCase();
    const ftype = $("#i-filter-type").value.trim().toLowerCase();
    const list = rows.filter(r=>{
      if(fcode && !(r.code||"").toLowerCase().includes(fcode)) return false;
      if(ftype && !(r.item_type||"").toLowerCase().includes(ftype)) return false;
      return true;
    });
    const tb = $("#i-tbody"); if(!tb) return;
    tb.innerHTML = "";
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
        shelf_id: $("#i-sid").value? +$("#i-sid").value : undefined,
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
        shelf_id: $("#i-sid").value? +$("#i-sid").value : undefined,
        item_type: $("#i-type").value.trim()
      };
      if(!body.item_type) return alert("请填写 item_type");
      if(!body.code && !body.shelf_id) return alert("请填写 code 或 shelf_id");
      if(!confirm("确认删除该库存行？")) return;
      await api("/api/inventory","DELETE",body);
      await loadInventoryAll();
    }catch(e){ alert("删除失败: " + (e.message || e)); }
  }

  // ====== Tasks ======
  async function loadTasks(){
    try{
      const st = $("#t-filter-status").value;
      const sid= $("#t-filter-sid").value;
      let path = "/api/tasks";
      const qs = [];
      if(st) qs.push("status="+encodeURIComponent(st));
      if(sid) qs.push("shelf_id="+encodeURIComponent(sid));
      if(qs.length) path += "?"+qs.join("&");
      tasksCache = await api(path,"GET");
      renderTasks(tasksCache);
    }catch(e){ setText($("#t-msg"), String(e.message || e)); }
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
        shelf_id: +$("#t-sid").value,
        assigned_to: $("#t-who").value || undefined,
        payload: $("#t-payload").value ? JSON.parse($("#t-payload").value) : undefined
      };
      await api("/api/tasks","POST",body);
      await loadTasks();
    }catch(e){ alert("创建任务失败: " + (e.message || e)); }
  }

  // ====== Observations（admin） ======
  async function loadObs(){
    try{
      const code = $("#o-code").value.trim();
      const sid  = $("#o-sid").value;
      const lim  = $("#o-limit").value || 50;
      let path = "/api/observations";
      const qs=[];
      if(code) qs.push("code="+encodeURIComponent(code));
      if(sid)  qs.push("shelf_id="+encodeURIComponent(sid));
      qs.push("limit="+encodeURIComponent(lim));
      path += "?"+qs.join("&");
      const rows = await api(path,"GET");
      const tb = $("#o-tbody"); if(!tb) return;
      tb.innerHTML = "";
      rows.forEach(r=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${r.observed_status}</td><td>${r.item_type||""}</td><td>${r.quantity_est??""}</td>
                        <td>${r.occupancy_pct??""}</td><td>${r.confidence??""}</td>
                        <td>${r.x_mm??""},${r.y_mm??""}</td><td>${r.source}</td><td>${r.robot_id??""}</td>
                        <td>${r.detected_at}</td>`;
        tb.appendChild(tr);
      });
      setText($("#o-msg"), `共 ${rows.length} 行`);
    }catch(e){ setText($("#o-msg"), String(e.message || e)); }
  }

  // ====== Users（admin + 二次口令） ======
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
        tr.innerHTML = `<td>${r.id}</td><td>${r.username}</td><td>${r.role}</td><td>${r.status}</td>
                        <td>${r.created_at}</td><td>${r.updated_at}</td>`;
        tb.appendChild(tr);
      });
      setText($("#u-msg"), `共 ${rows.length} 行`);
    }catch(e){ setText($("#u-msg"), String(e.message || e)); }
  }
  async function updateUser(){
    try{
      const id = +$("#u-id").value; if(!id) return alert("请输入 user_id");
      const body = {
        role: $("#u-role").value,
        status: $("#u-status").value
      };
      const pw = $("#u-pass").value; if(pw) body.password = pw;
      await api(`/api/users/${id}`,"PATCH",body);
      $("#u-pass").value="";
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

  // ====== Tabs / 权限 / 入口挂载 ======
  function switchTab(tab){
    $$(".tab-panel").forEach(p=> p.style.display="none");
    const el = $("#tab-"+tab);
    if(el) el.style.display = "";
    // 某些 tab 打开即加载
    if(tab==="shelves") loadShelves();
    if(tab==="shelf_inventory") loadInventoryAll();
    if(tab==="tasks") loadTasks();
    if(tab==="shelf_observations") loadObs();
    if(tab==="users") loadUsersGuarded();
  }

  async function mount(){
    const ok = await WH.healthGuard("#wh-main","#wh-guard");
    if(!ok) return;

    // 已登录校验
    if(!auth.token()){
      // 没有 token -> 跳到登录页
      location.replace("/warehouse/login/");
      return;
    }

    // 显示当前用户、角色
    setText($("#who"), auth.name());
    setText($("#role"), auth.role());

    // 权限控制：普通用户隐藏 admin-only 元素和按钮
    const isAdmin = auth.role()==="admin";
    $$(".admin-only").forEach(el=> show(el, isAdmin));
    if(isAdmin){
      const obsBtn = $(`[data-tab="shelf_observations"]`); if(obsBtn) obsBtn.style.display="";
      const usersBtn = $(`[data-tab="users"]`); if(usersBtn) usersBtn.style.display="";
    }

    // 退出
    const logoutBtn = $("#btnLogout");
    if(logoutBtn) logoutBtn.onclick = ()=>{ WH.logout(); location.replace("/warehouse/login/"); };

    // Tab 点击
    $$("#tabs .data-tab").forEach(btn=>{
      btn.onclick = ()=> switchTab(btn.getAttribute("data-tab"));
    });

    // Shelves 事件
    $("#s-btn-search") && ($("#s-btn-search").onclick = loadShelves);
    $("#s-btn-apply") && ($("#s-btn-apply").onclick  = ()=> renderShelves(shelvesCache));
    if(isAdmin){
      $("#s-btn-create") && ($("#s-btn-create").onclick = createShelf);
      $("#s-btn-update") && ($("#s-btn-update").onclick = updateShelf);
      $("#s-btn-delete") && ($("#s-btn-delete").onclick = deleteShelf);
    }

    // Inventory 事件
    $("#i-btn-load") && ($("#i-btn-load").onclick = loadInventoryAll);
    if(isAdmin){
      $("#i-btn-upsert") && ($("#i-btn-upsert").onclick = invUpsert);
      $("#i-btn-del") && ($("#i-btn-del").onclick    = invDelete);
    }

    // Tasks 事件
    $("#t-btn-load") && ($("#t-btn-load").onclick = loadTasks);
    if(isAdmin){
      $("#t-btn-create") && ($("#t-btn-create").onclick = createTask);
    }

    // Observations
    if(isAdmin){
      $("#o-btn-load") && ($("#o-btn-load").onclick = loadObs);
    }

    // Users
    if(isAdmin){
      $("#u-btn-load") && ($("#u-btn-load").onclick   = loadUsersGuarded);
      $("#u-btn-update") && ($("#u-btn-update").onclick = updateUser);
      $("#u-btn-del") && ($("#u-btn-del").onclick    = delUser);
    }

    // 默认打开第一个 Tab
    switchTab("shelves");
  }

  document.addEventListener("DOMContentLoaded", mount);
  window.WH_PAGE_MOUNT = mount;
})();
