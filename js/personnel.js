(function(){"use strict";
let ctx=null,channel=null,pendingAction=null,currentDayKey="",allTodayRows=[],visitPage=1;
const pageSize=5,list=$("#my-visits"),responseModal=$("#personnel-response-dialog");
const responseCopy={authorized:{title:"Autoriser l’entrée",help:"La réception sera avertie que le visiteur peut être reçu."},waiting:{title:"Demander au visiteur de patienter",help:"Choisis un délai indicatif. La réception recevra ton message."},unavailable:{title:"Signaler ton indisponibilité",help:"La réception sera avertie et pourra réorienter le visiteur."}};
function localDay(){
 const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate()),end=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
 const key=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
 return {key,start:start.toISOString(),end:end.toISOString(),label:new Intl.DateTimeFormat("fr-FR",{dateStyle:"full"}).format(now)};
}
function hideResponseModal(){responseModal.classList.add("hidden");responseModal.setAttribute("aria-hidden","true");pendingAction=null;}
function showResponseModal(button){
 const article=button.closest("[data-visit]");if(!article)return;
 pendingAction={id:button.dataset.id,response:button.dataset.response,visitor:article.dataset.visitor||"Visiteur"};
 const info=responseCopy[pendingAction.response];$("#personnel-response-title").textContent=info.title;$("#personnel-response-visitor").textContent="Visiteur : "+pendingAction.visitor;$("#personnel-response-help").textContent=info.help;
 $("#personnel-wait-field").classList.toggle("hidden",pendingAction.response!=="waiting");
 $("#personnel-message-field").classList.toggle("hidden",!["waiting","unavailable"].includes(pendingAction.response));
 $("#personnel-response-message").value="";$("#personnel-wait-minutes").value="5";
 responseModal.classList.remove("hidden");responseModal.setAttribute("aria-hidden","false");$("#confirm-personnel-response").focus();
}
function card(row){
 const v=row.visits;if(!v)return "";
 const photo=v.visitor_photo_path?'<img class="visit-photo" data-photo-path="'+escapeHTML(v.visitor_photo_path)+'" alt="Photo de '+escapeHTML(v.visitor_name)+'" hidden>':"";
 let html='<article class="visit-card" data-visit="'+escapeHTML(v.id)+'" data-visitor="'+escapeHTML(v.visitor_name)+'"><div class="visit-top"><div class="visit-photo-wrap">'+photo+'<div><div class="eyebrow">Demande du jour</div><h3>'+escapeHTML(v.visitor_name)+'</h3><div class="muted small">'+escapeHTML(v.visitor_organization||"Visiteur")+' · '+formatDate(v.created_at)+'</div></div></div><div class="stack">'+badge(v.response_status)+' '+badge(v.presence_status,presenceLabel(v.presence_status))+'</div></div>';
 if(v.note)html+='<p class="visit-note">'+escapeHTML(v.note)+'</p>';
 html+='<div class="visit-meta">'+badge(v.urgency,v.urgency==="urgent"?"Urgente":"Normale")+(v.response_status==="waiting"&&v.waiting_until?badge("waiting","Jusqu’à "+formatDate(v.waiting_until)):"")+'</div>';
 if(["pending","viewed"].includes(v.response_status)&&["pending","notified","viewed","claimed"].includes(row.status)){
  html+='<div class="grid three section-gap"><button class="btn success" data-response="authorized" data-id="'+escapeHTML(v.id)+'">✓ Autoriser</button><button class="btn warning" data-response="waiting" data-id="'+escapeHTML(v.id)+'">◷ Patienter</button><button class="btn secondary" data-response="unavailable" data-id="'+escapeHTML(v.id)+'">Indisponible</button></div>';
 }else if(v.response_status==="waiting"){
  html+='<p class="notice warning section-gap">Tu as demandé au visiteur de patienter jusqu’à '+escapeHTML(formatDate(v.waiting_until))+'. La réception peut ajuster la situation si nécessaire.</p>';
 }else if(v.response_status==="unavailable"){
  html+='<p class="notice error section-gap">La réception a été informée de ton indisponibilité.</p>';
 }else if(v.response_status==="authorized"){
  html+='<p class="notice success section-gap">La réception a été informée que le visiteur peut être reçu.</p>';
 }
 if(v.response_message)html+='<p class="visit-note"><strong>Message associé</strong><br>'+escapeHTML(v.response_message)+'</p>';
 if(v.response_status!=="cancelled"&&v.presence_status!=="completed")html+='<div class="actions section-gap"><button class="btn secondary small-btn chat-action" type="button" data-open-chat="'+escapeHTML(v.id)+'" data-chat-title="'+escapeHTML(v.visitor_name)+'">▤ Discuter avec la réception<span class="chat-unread-dot hidden" data-chat-unread="'+escapeHTML(v.id)+'"></span></button></div>';
 return html+"</article>";
}
function renderPagination(){
 const nav=$("#my-visits-pagination");if(!nav)return;
 const pages=Math.max(1,Math.ceil(allTodayRows.length/pageSize));visitPage=Math.min(Math.max(1,visitPage),pages);
 if(pages<=1){nav.innerHTML=allTodayRows.length?'<span class="pagination-info">5 demandes maximum par page · '+allTodayRows.length+' aujourd’hui</span>':"";return;}
 const start=Math.max(1,Math.min(pages-4,visitPage-2)),end=Math.min(pages,start+4);
 nav.innerHTML='<button type="button" class="pagination-btn" data-staff-page="'+(visitPage-1)+'" '+(visitPage===1?"disabled":"")+' aria-label="Page précédente">‹</button>'
 +Array.from({length:end-start+1},(_,i)=>start+i).map(n=>'<button type="button" class="pagination-btn '+(n===visitPage?"current":"")+'" data-staff-page="'+n+'" aria-label="Page '+n+'" '+(n===visitPage?'aria-current="page"':"")+'>'+n+'</button>').join("")
 +'<span class="pagination-info">Page '+visitPage+' / '+pages+'</span>'
 +'<button type="button" class="pagination-btn" data-staff-page="'+(visitPage+1)+'" '+(visitPage===pages?"disabled":"")+' aria-label="Page suivante">›</button>';
}
function render(){
 const visible=allTodayRows.slice((visitPage-1)*pageSize,visitPage*pageSize);
 list.innerHTML=visible.length?visible.map(card).join(""):'<div class="empty"><strong>Aucune demande pour aujourd’hui</strong>Les demandes adressées à ton compte apparaîtront ici. La liste recommence automatiquement chaque jour.</div>';
 renderPagination();
 if(window.hydrateVisitPhotos)window.hydrateVisitPhotos(list);
 if(window.VisitChat)VisitChat.refreshUnreadBadges();
}
async function load(){
 const day=localDay();
 currentDayKey=day.key;
 const label=$("#today-label");if(label)label.textContent=day.label;
 const {data,error}=await db.from("visit_recipients")
  .select("id,status,visit_id,created_at,visits(id,visitor_name,visitor_organization,visitor_photo_path,note,created_at,response_status,presence_status,urgency,waiting_until,responding_member_id,response_message,response_at)")
  .eq("member_id",ctx.session.user.id)
  .gte("created_at",day.start).lt("created_at",day.end)
  .order("created_at",{ascending:false}).limit(200);
 if(error)throw error;
 allTodayRows=(data||[]).filter(r=>r.visits).sort((a,b)=>new Date(b.visits.created_at)-new Date(a.visits.created_at));
 $("#pending-count").textContent=allTodayRows.filter(r=>["pending","viewed"].includes(r.visits.response_status)&&["pending","notified","viewed","claimed"].includes(r.status)).length;
 $("#today-count").textContent=String(allTodayRows.length);
 render();
}
list.addEventListener("click",e=>{const b=e.target.closest("[data-response]");if(b)showResponseModal(b);});
document.addEventListener("click",e=>{
 if(e.target.closest("[data-close-response]"))hideResponseModal();
 if(e.target===responseModal)hideResponseModal();
 if(e.target.closest("[data-refresh]"))load().catch(err=>toast(err.message||"Actualisation impossible.","error"));
 const page=e.target.closest("[data-staff-page]");if(page){visitPage=parseInt(page.dataset.staffPage,10)||1;render();}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!responseModal.classList.contains("hidden"))hideResponseModal();});
$("#confirm-personnel-response").addEventListener("click",async()=>{
 if(!pendingAction)return;
 const btn=$("#confirm-personnel-response"),action={...pendingAction},minutes=parseInt($("#personnel-wait-minutes").value,10)||5,message=$("#personnel-response-message").value.trim()||null;
 setButtonBusy(btn,true,"Transmission…");
 try{
  const {error}=await db.rpc("respond_to_visit",{p_visit_id:action.id,p_response:action.response,p_wait_minutes:minutes,p_message:message});
  if(error)throw error;
  hideResponseModal();toast("Réponse transmise à la réception.","success");await load();
 }catch(err){toast(err.message||"Réponse impossible.","error");}
 finally{setButtonBusy(btn,false);}
});
async function refreshIfNewDay(){
 const day=localDay();if(day.key!==currentDayKey){visitPage=1;await load();}
}
(async()=>{try{
 ctx=await requireRoles(["member","admin"]);if(!ctx)return;
 bindCommonNav("personnel");$("#welcome-name").textContent=ctx.profile.full_name;$("#current-availability").textContent=availabilityLabel(ctx.profile.availability);
 if(window.VisitChat)VisitChat.init(ctx);
 await load();
 channel=db.channel("personal-visits-"+ctx.session.user.id)
  .on("postgres_changes",{event:"*",schema:"public",table:"visits"},load)
  .on("postgres_changes",{event:"*",schema:"public",table:"visit_recipients",filter:"member_id=eq."+ctx.session.user.id},load).subscribe();
 }catch(err){toast(err.message||"Erreur de chargement.","error");}})();
window.addEventListener("focus",()=>refreshIfNewDay().catch(()=>{}));
setInterval(()=>refreshIfNewDay().catch(()=>{}),60000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshIfNewDay().catch(()=>{});});
window.addEventListener("beforeunload",()=>{if(channel)db.removeChannel(channel);});
})();