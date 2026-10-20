(function(){"use strict";
let ctx=null,floorOptions=[];
const memberBody=$("#members-body"),floorBody=$("#floors-body"),reasonBody=$("#reasons-body");
function floorName(m){return m.floors&&m.floors.name||"Aucun étage";}
function memberFloorControl(m,canManage){
 if(!canManage)return escapeHTML(floorName(m));
 const options=floorOptions.filter(f=>f.is_active||f.id===m.floor_id).map(f=>'<option value="'+escapeHTML(f.id)+'" '+(f.id===m.floor_id?"selected":"")+' '+(!f.is_active?"disabled":"")+'>'+escapeHTML(f.name)+(f.is_active?"":" (inactif)")+'</option>').join("");
 return '<select class="inline-role floor-select" data-floor-select="'+escapeHTML(m.id)+'" aria-label="Étage de '+escapeHTML(m.full_name)+'"><option value="">Aucun étage</option>'+options+'</select>';
}
async function loadFloors(){
 const {data,error}=await db.from("floors").select("id,name,sort_order,is_active").order("sort_order").order("name");
 if(error)throw error;floorOptions=data||[];
 floorBody.innerHTML=floorOptions.map(f=>'<tr><td>'+escapeHTML(f.name)+'</td><td>'+f.sort_order+'</td><td>'+badge(f.is_active?"available":"absent",f.is_active?"Actif":"Désactivé")+'</td><td><div class="actions"><button class="btn small-btn secondary" data-floor-rename="'+escapeHTML(f.id)+'" data-floor-name="'+escapeHTML(f.name)+'">Renommer</button><button class="btn small-btn secondary" data-floor-toggle="'+escapeHTML(f.id)+'" data-active="'+f.is_active+'">'+(f.is_active?"Désactiver":"Activer")+'</button></div></td></tr>').join("")||'<tr><td colspan="4" class="table-empty">Aucun étage défini.</td></tr>';
}
async function loadMembers(){
 const {data,error}=await db.from("staff_members").select("id,full_name,email,role,availability,is_active,floor_id,floors(name)").order("full_name");
 if(error)throw error;
 const canManageRoles=ctx.profile.role==="admin";
 memberBody.innerHTML=(data||[]).map(m=>'<tr><td class="staff-name-cell"><strong>'+escapeHTML(m.full_name)+'</strong><br><span class="small muted">'+escapeHTML(m.email||"")+'</span></td><td>'+(canManageRoles?'<select class="inline-role" data-id="'+escapeHTML(m.id)+'" aria-label="Rôle"><option value="member" '+(m.role==="member"?"selected":"")+'>Personnel</option><option value="reception" '+(m.role==="reception"?"selected":"")+'>Réception</option><option value="secretary" '+(m.role==="secretary"?"selected":"")+'>Secrétariat</option><option value="admin" '+(m.role==="admin"?"selected":"")+'>Admin</option></select>':escapeHTML(({member:"Personnel",reception:"Réception",secretary:"Secrétariat",admin:"Admin"})[m.role]||m.role))+'</td><td>'+memberFloorControl(m,canManageRoles)+'</td><td>'+badge(m.availability,availabilityLabel(m.availability))+'</td><td>'+badge(m.is_active?"available":"absent",m.is_active?"Actif":"Désactivé")+'</td><td>'+(canManageRoles?'<button class="btn small-btn secondary" data-toggle="'+escapeHTML(m.id)+'" data-active="'+m.is_active+'">'+(m.is_active?"Désactiver":"Activer")+'</button>':'<span class="small muted">Lecture seule</span>')+'</td></tr>').join("")||'<tr><td colspan="6" class="table-empty">Aucun profil.</td></tr>';
}
async function loadReasons(){
 const {data,error}=await db.from("visit_reasons").select("id,label,is_active,sort_order").order("sort_order");
 if(error)throw error;
 reasonBody.innerHTML=(data||[]).map(r=>'<tr><td>'+escapeHTML(r.label)+'</td><td>'+r.sort_order+'</td><td>'+badge(r.is_active?"available":"absent",r.is_active?"Actif":"Désactivé")+'</td><td><button class="btn small-btn secondary" data-reason-toggle="'+escapeHTML(r.id)+'" data-active="'+r.is_active+'">'+(r.is_active?"Désactiver":"Activer")+'</button></td></tr>').join("")||'<tr><td colspan="4" class="table-empty">Aucun motif défini.</td></tr>';
}
$("#floor-form").addEventListener("submit",async e=>{
 e.preventDefault();const f=e.currentTarget,name=f.elements.name.value.trim();if(!name)return;
 const {error}=await db.from("floors").insert({name,sort_order:parseInt(f.elements.sort_order.value,10)||0});
 if(error){toast(error.message,"error");return;}
 f.reset();toast("Étage ajouté.","success");await loadFloors();await loadMembers();
});
$("#reason-form").addEventListener("submit",async e=>{
 e.preventDefault();const f=e.currentTarget,label=f.elements.label.value.trim();if(!label)return;
 const {error}=await db.from("visit_reasons").insert({label,sort_order:parseInt(f.elements.sort_order.value,10)||0});
 if(error){toast(error.message,"error");return;}
 f.reset();toast("Motif ajouté.","success");await loadReasons();
});
memberBody.addEventListener("change",async e=>{
 const role=e.target.closest(".inline-role[data-id]"),floor=e.target.closest("[data-floor-select]");
 try{
  if(role){
   const {error}=await db.rpc("admin_update_member",{p_member_id:role.dataset.id,p_role:role.value,p_is_active:null});
   if(error)throw error;toast("Rôle mis à jour.","success");
  }else if(floor){
   const {error}=await db.rpc("admin_assign_member_floor",{p_member_id:floor.dataset.floorSelect,p_floor_id:floor.value||null});
   if(error)throw error;toast("Affectation de l’étage mise à jour.","success");await loadMembers();
  }
 }catch(err){toast(err.message||"Modification refusée.","error");await loadMembers();}
});
document.addEventListener("click",async e=>{
 const m=e.target.closest("[data-toggle]"),f=e.target.closest("[data-floor-toggle]"),rename=e.target.closest("[data-floor-rename]"),r=e.target.closest("[data-reason-toggle]");
 try{
  if(m){
   const {error}=await db.rpc("admin_update_member",{p_member_id:m.dataset.toggle,p_role:null,p_is_active:m.dataset.active!=="true"});
   if(error)throw error;await loadMembers();toast("Membre mis à jour.","success");
  }else if(f){
   const {error}=await db.from("floors").update({is_active:f.dataset.active!=="true"}).eq("id",f.dataset.floorToggle);
   if(error)throw error;await loadFloors();await loadMembers();toast("Étage mis à jour.","success");
  }else if(rename){
   const next=prompt("Nouveau nom de l’étage :",rename.dataset.floorName||"");
   if(next===null)return;const name=next.trim();if(!name){toast("Le nom de l’étage est obligatoire.","error");return;}
   const {error}=await db.from("floors").update({name}).eq("id",rename.dataset.floorRename);
   if(error)throw error;await loadFloors();await loadMembers();toast("Étage renommé.","success");
  }else if(r){
   const {error}=await db.from("visit_reasons").update({is_active:r.dataset.active!=="true"}).eq("id",r.dataset.reasonToggle);
   if(error)throw error;await loadReasons();
  }
 }catch(err){toast(err.message||"Action impossible.","error");}
});
(async()=>{
 try{
  ctx=await requireRoles(["admin","secretary"]);if(!ctx)return;
  bindCommonNav("admin");
  await Promise.all([loadFloors(),loadReasons()]);
  await loadMembers();
 }catch(err){toast(err.message||"Chargement impossible.","error");}
})();
})();