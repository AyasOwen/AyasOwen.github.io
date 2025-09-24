// source/js/warehouse.js
(function(){
  const API = window.WH_API_BASE || "";
  const $ = id => document.getElementById(id);
  const txt = (id, s, cls="")=>{ const el=$(id); if(!el) return; el.textContent=s; el.className=cls; };
  const tbody = id => $(id);

  const TOK="wh_token", ROLE="wh_role", NAME="wh_name";
  const getTok = ()=>localStorage.getItem(TOK);
  const setAuth=(t,r,n)=>{localStorage.setItem(TOK,t);localStorage.setItem(ROLE,r);localStorage.setItem(NAME,n);};
  const clrAuth=()=>{localStorage.removeItem(TOK);localStorage.removeItem(ROLE);localStorage.removeItem(NAME);};

  async function call(path, method="GET", body){
    const headers={"Content-Type":"application/json"};
    const t=getTok(); if(t) headers["Authorization"]="Bearer "+t;
    const res = await fetch(API+path,{method,headers,body:body?JSON.stringify(body):undefined});
    if(!res.ok){ let e; try{e=await res.json();}catch{e={};} throw new Error(e.error||res.statusText); }
    return res.json();
  }

  async function refreshUI(){
    const authed = !!getTok();
    // 会话信息
    $("wh_who_name").textContent = localStorage.getItem(NAME) || "--";
    $("wh_who_role").textContent = localStorage.getItem(ROLE) || "--";
    // 初始加载
    if(authed){ await WH.loadShelves().catch(()=>{}); }
  }

  const WH = {
    async login(){
      txt("wh_msg","");
      const u=$("wh_u").value.trim(), p=$("wh_p").value;
      if(!u||!p){ txt("wh_msg","请输入用户名与密码","err"); return; }
      try{
        const d = await call("/api/auth/login","POST",{username:u,password:p});
        setAuth(d.access_token,d.role,d.username);
        $("wh_u").value=""; $("wh_p").value="";
        txt("wh_msg","登录成功","ok");
        await refreshUI();
      }catch(e){ txt("wh_msg","登录失败："+e.message,"err"); }
    },
    logout(){
      clrAuth();
      txt("wh_msg","已退出","ok");
      // 清空表格
      tbody("wh_shelves_tbody").innerHTML="";
      tbody("wh_inv_tbody").innerHTML="";
      $("wh_inv_shelf").textContent="--";
      refreshUI();
    },

    async loadShelves(){
      txt("wh_qmsg","");
      const q = $("wh_q").value.trim();
      let url="/api/shelves"; if(q) url += `?q=${encodeURIComponent(q)}`;
      try{
        const rows = await call(url);
        const tb = tbody("wh_shelves_tbody"); tb.innerHTML="";
        rows.forEach(r=>{
          const tr=document.createElement("tr");
          tr.style.cursor="pointer";
          tr.onclick=()=> WH.loadInventory({shelf_id:r.id, code:r.code});
          tr.innerHTML = `<td>${r.code}</td><td>${r.row_idx}</td><td>${r.col_idx}</td>
                          <td>${r.capacity}</td><td>${r.quantity}</td><td>${r.status}</td>
                          <td>${r.x_mm??""},${r.y_mm??""}</td>`;
          tb.appendChild(tr);
        });
        txt("wh_qmsg",`共 ${rows.length} 条`,"ok");
      }catch(e){ txt("wh_qmsg","查询失败："+e.message,"err"); }
    },

    async loadInventory({shelf_id, code}){
      try{
        let url="/api/inventory";
        if(shelf_id) url+=`?shelf_id=${shelf_id}`; else url+=`?code=${encodeURIComponent(code)}`;
        const d = await call(url);
        $("wh_inv_shelf").textContent = code ? code : `#${d.shelf_id}`;
        const tb = tbody("wh_inv_tbody"); tb.innerHTML="";
        (d.items||[]).forEach(it=>{
          const tr=document.createElement("tr");
          tr.innerHTML = `<td>${it.item_type}</td><td>${it.quantity}</td><td>${it.updated_at}</td>`;
          tb.appendChild(tr);
        });
      }catch(e){ txt("wh_qmsg","加载库存失败："+e.message,"err"); }
    },

    async createShelf(){
      txt("wh_smsg","");
      try{
        const body = {
          code: $("wh_s_code").value.trim(),
          row_idx: +$("wh_s_row").value,
          col_idx: +$("wh_s_col").value,
          capacity: +$("wh_s_cap").value,
          x_mm: $("wh_s_x").value ? +$("wh_s_x").value : null,
          y_mm: $("wh_s_y").value ? +$("wh_s_y").value : null,
          height_mm: $("wh_s_h").value ? +$("wh_s_h").value : null,
          status: $("wh_s_st").value,
          note: $("wh_s_note").value || null
        };
        if(!body.code) throw new Error("code 不能为空");
        await call("/api/shelves","POST",body);
        txt("wh_smsg","创建成功","ok");
        await WH.loadShelves();
      }catch(e){ txt("wh_smsg","创建失败："+e.message,"err"); }
    },

    async upsertInventory(){
      txt("wh_imsg","");
      try{
        const body = {
          code: $("wh_i_code").value.trim() || undefined,
          shelf_id: $("wh_i_sid").value ? +$("wh_i_sid").value : undefined,
          item_type: $("wh_i_type").value.trim(),
          quantity: +$("wh_i_qty").value
        };
        if(!body.code && !body.shelf_id) throw new Error("请填写 shelf code 或 shelf_id");
        await call("/api/inventory/upsert","POST",body);
        txt("wh_imsg","保存成功","ok");
        // 刷新列表与明细
        await WH.loadShelves();
        if(body.code) await WH.loadInventory({code: body.code});
        if(body.shelf_id) await WH.loadInventory({shelf_id: body.shelf_id});
      }catch(e){ txt("wh_imsg","保存失败："+e.message,"err"); }
    },

    async registerUser(){
      txt("wh_rmsg","");
      try{
        const body = {
          username: $("wh_r_u").value.trim(),
          password: $("wh_r_p").value,
          role: $("wh_r_role").value
        };
        if(!body.username || !body.password) throw new Error("用户名/密码不能为空");
        await call("/api/auth/register","POST",body);
        txt("wh_rmsg","创建成功","ok");
        $("wh_r_u").value=""; $("wh_r_p").value="";
      }catch(e){ txt("wh_rmsg","创建失败："+e.message,"err"); }
    }
  };

  window.WH = WH;
  // 初次渲染
  document.addEventListener("DOMContentLoaded", refreshUI);
})();
