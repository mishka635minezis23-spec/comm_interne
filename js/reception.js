(function(){"use strict";
let ctx=null,members=[],channel=null,firstVisitLoad=true,previousResponses=new Map(),announcementQueue=[],announcementOpen=false,suppressedAnnouncements=new Map();
const form=$("#visit-form"),list=$("#active-visits"),visitModal=$("#visit-dialog"),noticeModal=$("#response-announcement");
const responseOptions=[["authorized","Autoriser l’entrée"],["waiting","Faire patienter"],["unavailable","Indisponible"]];
function setModal(modal,open){modal.classList.toggle("hidden",!open);modal.setAttribute("aria-hidden",open?"false":"true");}
function renderMemberOptions(){
 const primary=$("#target-member"),selected=primary.value;
 primary.innerHTML='<option value="">Choisir un collaborateur…</option>'+members.map(m=>'<option value="'+escapeHTML(m.id)+'">'+escapeHTML(m.full_name)+' · '+escapeHTML(m.floor_name)+' · '+escapeHTML(availabilityLabel(m.availability))+'</option>').join("");
 if(members.some(m=>m.id===selected))primary.value=selected;
 renderExtraMembers();
}
function renderExtraMembers(){
 const target=$("#extra-target-members"),primary=$("#target-member").value;
 target.innerHTML=members.filter(m=>m.id!==primary).map(m=>'<label class="check-item"><input type="checkbox" name="extra_member_ids" value="'+escapeHTML(m.id)+'"><span><strong>'+escapeHTML(m.full_name)+'</strong><br><span class="small">'+escapeHTML(m.floor_name)+' · '+escapeHTML(availabilityLabel(m.availability))+'</span></span></label>').join("")||'<p class="small muted">Aucun autre collaborateur disponible.</p>';
}
async function loadPeople(){
 const {data,error}=await db.from("staff_members").select("id,full_name,role,floor_id,availability,is_active,floors(name)").eq("is_active",true).order("full_name");
 if(error)throw error;
 members=(data||[]).filter(m=>m.id!==ctx.session.user.id).map(m=>Object.assign({},m,{floor_name:m.floors&&m.floors.name||"Étage non défini"}));
 renderMemberOptions();
}
async function loadReasons(){
 const {data,error}=await db.from("visit_reasons").select("id,label").eq("is_active",true).order("sort_order");
 if(error)throw error;$("#visit-reason").innerHTML='<option value="">Choisir un motif…</option>'+(data||[]).map(r=>'<option value="'+escapeHTML(r.id)+'">'+escapeHTML(r.label)+'</option>').join("");
}
function createAnnouncement(v){announcementQueue.push(v);if(!announcementOpen)showNextAnnouncement();}
function showNextAnnouncement(){
 if(!announcementQueue.length){announcementOpen=false;setModal(noticeModal,false);return;}
 announcementOpen=true;const v=announcementQueue[0];const person=members.find(m=>m.id===v.responding_member_id);
 $("#response-announcement-title").textContent="Nouvelle réponse à une audience";
 $("#response-announcement-summary").textContent=(person?person.full_name:"Un collaborateur")+" a répondu pour le visiteur « "+v.visitor_name+" ».";
 $("#response-announcement-state").textContent="Décision : "+responseLabel(v.response_status)+(v.response_status==="waiting"&&v.waiting_until?" · jusqu’à "+formatDate(v.waiting_until):"");
 const message=$("#response-announcement-message");message.textContent=v.response_message||"";message.classList.toggle("hidden",!v.response_message);
 setModal(noticeModal,true);$("#acknowledge-response").focus();
}
function renderCard(v){
 const disabled=v.response_status==="cancelled"||v.presence_status==="completed";
 const responseControls=disabled?"":'<div class="visit-controls"><select aria-label="Modifier la réponse de la visite" data-state-select="'+escapeHTML(v.id)+'"><option value="">Modifier la décision…</option>'+responseOptions.map(([value,label])=>'<option value="'+value+'" '+(v.response_status===value?"selected":"")+'>'+label+'</option>').join("")+'</select><button type="button" class="btn secondary small-btn" data-save-state="'+escapeHTML(v.id)+'">Appliquer</button></div>';
 const minutes=disabled?"":'<div class="field section-gap"><label for="wait-'+escapeHTML(v.id)+'">Délai si le visiteur doit patienter</label><select id="wait-'+escapeHTML(v.id)+'" data-wait-minutes="'+escapeHTML(v.id)+'"><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 heure</option><option value="120">2 heures</option></select></div>';
 let html='<article class="visit-card" data-visit="'+escapeHTML(v.id)+'"><div class="visit-top"><div><h3>'+escapeHTML(v.visitor_name)+'</h3><div class="muted small">'+escapeHTML(v.visitor_organization||"Visiteur")+' · '+formatDate(v.created_at)+'</div></div><div class="stack">'+badge(v.response_status,responseLabel(v.response_status))+' '+badge(v.presence_status,presenceLabel(v.presence_status))+'</div></div>';
 if(v.note)html+='<p class="visit-note">'+escapeHTML(v.note)+'</p>';
 html+='<div class="visit-meta">'+badge(v.urgency,v.urgency==="urgent"?"Priorité urgente":"Priorité normale")+(v.responding_member_id?badge("available","Réponse reçue"):"")+'</div>';
 if(v.response_status==="waiting"&&v.waiting_until)html+='<p class="notice warning section-gap">Le visiteur patiente jusqu’à '+escapeHTML(formatDate(v.waiting_until))+'.</p>';
 if(v.response_message)html+='<p class="visit-note"><strong>Dernier message</strong><br>'+escapeHTML(v.response_message)+'</p>';
 html+=responseControls+minutes+'<div class="actions section-gap">';
 if(v.response_status==="authorized"&&v.presence_status==="not_arrived")html+='<button class="btn success small-btn" data-presence="in_visit" data-id="'+escapeHTML(v.id)+'">✓ Confirmer l’entrée</button>';
 if(v.response_status==="authorized"&&v.presence_status==="in_visit")html+='<button class="btn secondary small-btn" data-presence="completed" data-id="'+escapeHTML(v.id)+'">Terminer la visite</button>';
 if(!disabled&&["pending","viewed","authorized","waiting","unavailable","no_response"].includes(v.response_status))html+='<button class="btn danger small-btn" data-cancel="'+escapeHTML(v.id)+'">Annuler</button>';
 if(!disabled)html+='<button class="btn secondary small-btn" type="button" data-open-chat="'+escapeHTML(v.id)+'" data-chat-title="'+escapeHTML(v.visitor_name)+'">▤ Chat interne</button>';
 html+='</div></article>';return html;
}
async function loadVisits(notifyChanges=false){
 const {data,error}=await db.from("visits").select("id,visitor_name,visitor_organization,note,created_at,response_status,presence_status,urgency,responding_member_id,response_message,response_at,waiting_until").order("created_at",{ascending:false}).limit(30);
 if(error)throw error;const rows=data||[];
 if(notifyChanges&&!firstVisitLoad){
  rows.forEach(v=>{
   const before=previousResponses.get(v.id);
   if(!before||before===v.response_status||!["authorized","waiting","unavailable"].includes(v.response_status)||!v.responding_member_id)return;
   const suppressed=suppressedAnnouncements.get(v.id);
   if(suppressed&&suppressed.status===v.response_status&&suppressed.expires>Date.now()){suppressedAnnouncements.delete(v.id);return;}
   createAnnouncement(v);
  });
 }
 previousResponses=new Map(rows.map(v=>[v.id,v.response_status]));firstVisitLoad=false;
 $("#stat-active").textContent=rows.filter(v=>v.presence_status!=="completed"&&v.response_status!=="cancelled").length;
 $("#stat-pending").textContent=rows.filter(v=>["pending","viewed","no_response"].includes(v.response_status)).length;
 list.innerHTML=rows.length?rows.map(renderCard).join(""):'<div class="empty"><strong>Aucune visite pour le moment</strong>Les demandes d’audience apparaîtront ici, avec leur réponse et leur état.</div>';
}
function openVisitForm(){setModal(visitModal,true);setTimeout(()=>$("#visitor-name").focus(),50);}
function closeVisitForm(){setModal(visitModal,false);}
document.addEventListener("click",async e=>{
 if(e.target.closest("[data-open-visit]")){openVisitForm();return;}
 if(e.target.closest("[data-close-visit]")){closeVisitForm();return;}
 if(e.target.closest("[data-refresh]")){loadVisits().catch(err=>toast(err.message||"Actualisation impossible.","error"));return;}
 if(e.target===visitModal){closeVisitForm();return;}
 if(e.target.closest("#acknowledge-response")){announcementQueue.shift();showNextAnnouncement();return;}
 const p=e.target.closest("[data-presence]"),c=e.target.closest("[data-cancel]"),save=e.target.closest("[data-save-state]");
 try{
  if(p){const {error}=await db.rpc("set_visit_presence",{p_visit_id:p.dataset.id,p_presence_status:p.dataset.presence});if(error)throw error;toast("Présence mise à jour.","success");await loadVisits();return;}
  if(c&&confirm("Annuler cette demande de visite ?")){const {error}=await db.rpc("cancel_visit",{p_visit_id:c.dataset.cancel});if(error)throw error;toast("Demande annulée.","success");await loadVisits();return;}
  if(save){
   const id=save.dataset.saveState,state=$('[data-state-select="'+id+'"]').value,mins=parseInt($('[data-wait-minutes="'+id+'"]').value,10)||5;
   if(!state){toast("Choisis d’abord une décision.","error");return;}
   if(!confirm("Confirmer le changement de décision pour cette visite ?"))return;
   suppressedAnnouncements.set(id,{status:state,expires:Date.now()+15000});setButtonBusy(save,true,"Mise à jour…");
   const visit=await db.from("visits").select("response_message").eq("id",id).maybeSingle();
   if(visit.error)throw visit.error;
   const {error}=await db.rpc("reception_update_visit_response",{p_visit_id:id,p_response_status:state,p_wait_minutes:mins,p_message:visit.data?.response_message||null});if(error)throw error;
   toast("Décision de la visite mise à jour.","success");await loadVisits();return;
  }
 }catch(err){toast(err.message||"Action impossible.","error");}
 finally{if(save)setButtonBusy(save,false);}
});
form.addEventListener("submit",async e=>{
 e.preventDefault();const btn=form.querySelector('[type="submit"]');
 const primary=$("#target-member").value,extras=$$('input[name="extra_member_ids"]:checked',form).map(el=>el.value);
 const ids=[primary,...extras].filter((id,index,array)=>id&&array.indexOf(id)===index);
 if(!primary){toast("Choisis un collaborateur à contacter.","error");return;}
 setButtonBusy(btn,true,"Envoi…");
 try{
  const {error}=await db.rpc("create_visit",{p_visit_id:null,p_visitor_name:form.elements.visitor_name.value.trim(),p_visitor_organization:form.elements.visitor_organization.value.trim()||null,p_photo_path:null,p_reason_id:form.elements.reason_id.value||null,p_note:form.elements.note.value.trim()||null,p_member_ids:ids,p_urgency:form.elements.urgency.value});
  if(error)throw error;toast("Demande d’audience enregistrée et transmise.","success");form.reset();$("#extra-target-members").classList.add("hidden");closeVisitForm();await loadVisits();
 }catch(err){toast(err.message||"La demande n’a pas pu être créée.","error");}
 finally{setButtonBusy(btn,false);}
});
$("#target-member").addEventListener("change",renderExtraMembers);
$("#add-extra-targets").addEventListener("change",e=>$("#extra-target-members").classList.toggle("hidden",!e.target.checked));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!visitModal.classList.contains("hidden"))closeVisitForm();});
(async()=>{try{
 ctx=await requireRoles(["reception","secretary","admin"]);if(!ctx)return;bindCommonNav("reception");if(window.VisitChat)VisitChat.init(ctx);
 await Promise.all([loadPeople(),loadReasons(),loadVisits()]);
 channel=db.channel("reception-live").on("postgres_changes",{event:"*",schema:"public",table:"visits"},()=>loadVisits(true)).subscribe();
 }catch(err){toast(err.message||"Erreur de chargement.","error");}})();
window.addEventListener("beforeunload",()=>{if(channel)db.removeChannel(channel);});
})();