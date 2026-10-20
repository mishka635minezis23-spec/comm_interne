(function(){"use strict";
let ctx=null,channel=null,pendingAction=null;const list=$("#my-visits"),responseModal=$("#personnel-response-dialog");
const responseCopy={authorized:{title:"Autoriser l’entrée",help:"La réception sera avertie que le visiteur peut être reçu."},waiting:{title:"Demander au visiteur de patienter",help:"Choisis un délai indicatif. La réception recevra ton message."},unavailable:{title:"Signaler ton indisponibilité",help:"La réception sera avertie et pourra réorienter le visiteur."}};
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
 let html='<article class="visit-card" data-visit="'+escapeHTML(v.id)+'" data-visitor="'+escapeHTML(v.visitor_name)+'"><div class="visit-top"><div><div class="eyebrow">Demande d’audience</div><h3>'+escapeHTML(v.visitor_name)+'</h3><div class="muted small">'+escapeHTML(v.visitor_organization||"Visiteur")+' · '+formatDate(v.created_at)+'</div></div><div class="stack">'+badge(v.response_status)+' '+badge(v.presence_status,presenceLabel(v.presence_status))+'</div></div>';
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
 if(v.response_status!=="cancelled"&&v.presence_status!=="completed")html+='<div class="actions section-gap"><button class="btn secondary small-btn" type="button" data-open-chat="'+escapeHTML(v.id)+'" data-chat-title="'+escapeHTML(v.visitor_name)+'">▤ Discuter avec la réception</button></div>';
 return html+"</article>";
}
async function load(){
 const {data,error}=await db.from("visit_recipients").select("id,status,visit_id,visits(id,visitor_name,visitor_organization,note,created_at,response_status,presence_status,urgency,waiting_until,responding_member_id,response_message,response_at)").eq("member_id",ctx.session.user.id).order("created_at",{referencedTable:"visits",ascending:false}).limit(60);
 if(error)throw error;const rows=(data||[]).filter(r=>r.visits);
 $("#pending-count").textContent=rows.filter(r=>["pending","viewed"].includes(r.visits.response_status)&&["pending","notified","viewed","claimed"].includes(r.status)).length;
 list.innerHTML=rows.length?rows.map(card).join(""):'<div class="empty"><strong>Aucune demande pour le moment</strong>Les demandes d’audience apparaîtront ici, avec leur réponse et leur état.</div>';
}
list.addEventListener("click",e=>{const b=e.target.closest("[data-response]");if(b)showResponseModal(b);});
document.addEventListener("click",e=>{if(e.target.closest("[data-close-response]"))hideResponseModal();if(e.target===responseModal)hideResponseModal();if(e.target.closest("[data-refresh]"))load().catch(err=>toast(err.message||"Actualisation impossible.","error"));});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!responseModal.classList.contains("hidden"))hideResponseModal();});
$("#confirm-personnel-response").addEventListener("click",async()=>{
 if(!pendingAction)return;const btn=$("#confirm-personnel-response"),action={...pendingAction};const minutes=parseInt($("#personnel-wait-minutes").value,10)||5;const message=$("#personnel-response-message").value.trim()||null;
 setButtonBusy(btn,true,"Transmission…");
 try{
  const {error}=await db.rpc("respond_to_visit",{p_visit_id:action.id,p_response:action.response,p_wait_minutes:minutes,p_message:message});
  if(error)throw error;hideResponseModal();toast("Réponse transmise à la réception.","success");await load();
 }catch(err){toast(err.message||"Réponse impossible.","error");}
 finally{setButtonBusy(btn,false);}
});
(async()=>{try{
 ctx=await requireRoles(["member","admin"]);if(!ctx)return;bindCommonNav("personnel");$("#welcome-name").textContent=ctx.profile.full_name;$("#current-availability").textContent=availabilityLabel(ctx.profile.availability);
 if(window.VisitChat)VisitChat.init(ctx);await load();
 channel=db.channel("personal-visits-"+ctx.session.user.id)
  .on("postgres_changes",{event:"*",schema:"public",table:"visits"},load)
  .on("postgres_changes",{event:"*",schema:"public",table:"visit_recipients",filter:"member_id=eq."+ctx.session.user.id},load).subscribe();
 }catch(err){toast(err.message||"Erreur de chargement.","error");}})();
window.addEventListener("beforeunload",()=>{if(channel)db.removeChannel(channel);});
})();