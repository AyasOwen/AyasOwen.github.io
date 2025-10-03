// wh_console.js
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
    const rows = await api(path, "GET");
    shelvesCache = rows;
    renderShelves(rows);
  }
  function renderShelves(rows){
    // 过滤
    const fcode = $("#s-filter-code").value.trim().toLowerCase();
    const frow  = $("#s-filter-row").value;
    const fcol  = $("#s-filter-col").value;
    const list = rows.filter(r=>{
      if(fcode && !(r.code||"").toLowerCase().includes(fcode)) return false;
      if(frow && +r.row_idx !== +frow) return false;
      if(fcol && +r.col_idx !== +fcol) return false;
      return true;
    });
    const tb = $("#s-tbody"); tb.innerHTML="";
    list.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.id}</td><td>${r.code}</td><td>${r.row_idx}</td><td>${r.col_idx}</td>
                      <td>${r.capacity}</td><td>${r.quantity}</td><td>${r.status}</td>
                      <td>${r.x_mm??""},${r.y_mm??""}</td>`;
      tb.appendChild(tr);
    });
    setText($("#s-msg"), `共 ${list.length} 行`);
  }
  async function createShelf(){
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
  }
  async function updateShelf(){
    const id = +$("#s-id").value; if(!id) return alert("请输入 shelf_id");
    const body = {};
    [["row_idx","#s-row"],["col_idx","#s-col"],["capacity","#s-cap"],
     ["x_mm","#s-x"],["y_mm","#s-y"],["height_mm","#s-h"],
     ["status","#s-st"],["note","#s-note"]].forEach(([k,sel])=>{
      const v = $(sel).value;
      if(v!=="" && v!=null) body[k] = (k==="status"||k==="note") ? v : +v;
    });
    await api(`/api/shelves/${id}`,"PATCH",body);
    await loadShelves();
  }
  async function deleteShelf(){
    const id = +$("#s-id").value; if(!id) return alert("请输入 shelf_id");
    if(!confirm(`确认删除 shelf ${id} ?`)) return;
    await api(`/api/shelves/${id}`,"DELETE");
    await loadShelves();
  }

  // ====== Inventory ======
  async function loadInventoryAll(){
    setText($("#i-msg"), "");
    // 优先用后端 /api/inventory/all；如果后端未补丁，则回退：遍历 shelves 拉取
    try{
      invAllCache = await api("/api/inventory/all","GET");
    }catch(e){
      // 回退：先拉 shelves，再对每个 shelf 拉 /api/inventory?sid=
      const sh = await api("/api/shelves","GET");
      const all = [];
      for(const s of sh){
        const d = await api(`/api/inventory?shelf_id=${s.id}`,"GET");
        (d.items||[]).forEach(it=> all.push({shelf_id:d.shelf_id, code:s.code, ...it}));
      }
      invAllCache = all;
    }
    renderInventory(invAllCache);
  }
  function renderInventory(rows){
    const fcode = $("#i-filter-code").value.trim().toLowerCase();
    const ftype = $("#i-filter-type").value.trim().toLowerCase();
    const list = rows.filter(r=>{
      if(fcode && !(r.code||"").toLowerCase().includes(fcode)) return false;
      if(ftype && !(r.item_type||"").toLowerCase().includes(ftype)) return false;
      return true;
    });
    const tb = $("#i-tbody"); tb.innerHTML="";
    list.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.shelf_id}</td><td>${r.code||""}</td><td>${r.item_type}</td>
                      <td>${r.quantity}</td><td>${r.updated_at}</td>`;
      tb.appendChild(tr);
    });
    setText($("#i-msg"), `共 ${list.length} 行`);
  }
  async function invUpsert(){
    const body = {
      code: $("#i-code").value.trim() || undefined,
      shelf_id: $("#i-sid").value? +$("#i-sid").value : undefined,
      item_type: $("#i-type").value.trim(),
      quantity: +$("#i-qty").value
    };
    await api("/api/inventory/upsert","POST",body);
    await loadInventoryAll();
  }
  async function invDelete(){
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
  }

  // ====== Tasks ======
  async function loadTasks(){
    const st = $("#t-filter-status").value;
    const sid= $("#t-filter-sid").value;
    let path = "/api/tasks";
    const qs = [];
    if(st) qs.push("status="+encodeURIComponent(st));
    if(sid) qs.push("shelf_id="+encodeURIComponent(sid));
    if(qs.length) path += "?"+qs.join("&");
    tasksCache = await api(path,"GET");
    renderTasks(tasksCache);
  }
  function renderTasks(rows){
    const tb = $("#t-tbody"); tb.innerHTML="";
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
    const body = {
      type: $("#t-type").value,
      shelf_id: +$("#t-sid").value,
      assigned_to: $("#t-who").value || undefined,
      payload: $("#t-payload").value ? JSON.parse($("#t-payload").value) : undefined
    };
    await api("/api/tasks","POST",body);
    await loadTasks();
  }

  // ====== Observations（admin） ======
  async function loadObs(){
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
    const tb = $("#o-tbody"); tb.innerHTML="";
    rows.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.observed_status}</td><td>${r.item_type||""}</td><td>${r.quantity_est??""}</td>
                      <td>${r.occupancy_pct??""}</td><td>${r.confidence??""}</td>
                      <td>${r.x_mm??""},${r.y_mm??""}</td><td>${r.source}</td><td>${r.robot_id??""}</td>
                      <td>${r.detected_at}</td>`;
      tb.appendChild(tr);
    });
    setText($("#o-msg"), `共 ${rows.length} 行`);
  }

  // ====== Users（admin + 二次口令） ======
  async function loadUsersGuarded(){
    const ok = await guardUsersTab();
    if(!ok) return alert("口令错误，无法查看 Users");
    await loadUsers();
  }
  async function loadUsers(){
    const rows = await api("/api/users","GET");
    const tb = $("#u-tbody"); tb.innerHTML="";
    rows.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.id}</td><td>${r.username}</td><td>${r.role}</td><td>${r.status}</td>
                      <td>${r.created_at}</td><td>${r.updated_at}</td>`;
      tb.appendChild(tr);
    });
    setText($("#u-msg"), `共 ${rows.length} 行`);
  }
  async function updateUser(){
    const id = +$("#u-id").value; if(!id) return alert("请输入 user_id");
    const body = {
      role: $("#u-role").value,
      status: $("#u-status").value
    };
    const pw = $("#u-pass").value; if(pw) body.password = pw;
    await api(`/api/users/${id}`,"PATCH",body);
    $("#u-pass").value="";
    await loadUsers();
  }
  async function delUser(){
    const id = +$("#u-id").value; if(!id) return alert("请输入 user_id");
    if(!confirm(`确认删除 user ${id} ?`)) return;
    await api(`/api/users/${id}`,"DELETE");
    await loadUsers();
  }

  // ====== Tabs / 权限 / 入口挂载 ======
  function switchTab(tab){
    $$(".tab-panel").forEach(p=> p.style.display="none");
    const el = $("#tab-"+tab);
    if(el) el.style.display="";
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
    if(!auth.token()){ location.replace("/warehouse/login/"); return; }

    // 显示当前用户、角色
    setText($("#who"), auth.name());
    setText($("#role"), auth.role());

    // 权限控制：普通用户隐藏 admin-only 元素和按钮
    const isAdmin = auth.role()==="admin";
    $$(".admin-only").forEach(el=> show(el, isAdmin));
    if(isAdmin){
      $(`[data-tab="shelf_observations"]`).style.display="";
      $(`[data-tab="users"]`).style.display="";
    }

    // 退出
    $("#btnLogout").onclick = ()=>{ WH.logout(); location.replace("/warehouse/login/"); };

    // Tab 点击
    $$("#tabs .data-tab").forEach(btn=>{
      btn.onclick = ()=> switchTab(btn.getAttribute("data-tab"));
    });

    // Shelves 事件
    $("#s-btn-search").onclick = loadShelves;
    $("#s-btn-apply").onclick  = ()=> renderShelves(shelvesCache);
    if(isAdmin){
      $("#s-btn-create").onclick = createShelf;
      $("#s-btn-update").onclick = updateShelf;
      $("#s-btn-delete").onclick = deleteShelf;
    }

    // Inventory 事件
    $("#i-btn-load").onclick = loadInventoryAll;
    if(isAdmin){
      $("#i-btn-upsert").onclick = invUpsert;
      $("#i-btn-del").onclick    = invDelete;
    }

    // Tasks 事件
    $("#t-btn-load").onclick = loadTasks;
    if(isAdmin){
      $("#t-btn-create").onclick = createTask;
    }

    // Observations
    if(isAdmin){ $("#o-btn-load").onclick = loadObs; }

    // Users
    if(isAdmin){
      $("#u-btn-load").onclick   = loadUsersGuarded;
      $("#u-btn-update").onclick = updateUser;
      $("#u-btn-del").onclick    = delUser;
    }

    // 默认打开第一个 Tab
    switchTab("shelves");
  }

  document.addEventListener("DOMContentLoaded", mount);
  window.WH_PAGE_MOUNT = mount;
})();
