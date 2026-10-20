(function(){"use strict";
let ctx=null,currentVisitId=null,channel=null;
const modalId="visit-chat-dialog";
function ensureModal(){
 let modal=document.getElementById(modalId);if(modal)return modal;
 modal=document.createElement("div");modal.id=modalId;modal.className="modal-backdrop hidden";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-labelledby","chat-title");modal.setAttribute("aria-hidden","true");
 modal.innerHTML='<section class="chat-panel"><header class="chat-header"><div><div class="eyebrow">Conversation interne</div><h2 id="chat-title">Discussion de la visite</h2><p id="chat-description" class="small muted">Échange lié à cette demande d’audience.</p></div><button type="button" class="modal-close" data-chat-close aria-label="Fermer la conversation">×</button></header><div id="chat-messages" class="chat-messages"><div class="empty">Chargement des messages…</div></div><form id="chat-form" class="chat-form"><textarea id="chat-message-input" maxlength="2000" required rows="1" placeholder="Écrire un message…" aria-label="Message"></textarea><button class="btn" type="submit">Envoyer</button></form></section>';
 document.body.appendChild(modal);return modal;
}
function setOpen(open){const modal=ensureModal();modal.classList.toggle("hidden",!open);modal.setAttribute("aria-hidden",open?"false":"true");if(open)setTimeout(()=>$("#chat-message-input",modal)?.focus(),80);}
async function loadMessages(){
 if(!currentVisitId||!ctx)return;
 const box=$("#chat-messages");box.innerHTML='<div class="empty">Chargement des messages…</div>';
 const {data,error}=await db.from("visit_messages").select("id,sender_id,message,created_at").eq("visit_id",currentVisitId).order("created_at",{ascending:true}).limit(250);
 if(error){box.innerHTML='<div class="notice error">Impossible de charger la conversation. Vérifie les droits de la base puis réessaie.</div>';return;}
 const rows=data||[];
 box.innerHTML=rows.length?rows.map(m=>'<article class="chat-bubble '+(m.sender_id===ctx.session.user.id?"mine":"")+'"><div>'+escapeHTML(m.message)+'</div><small>'+escapeHTML(m.sender_id===ctx.session.user.id?"Vous":"Équipe UJADI")+' · '+escapeHTML(formatDate(m.created_at))+'</small></article>').join(""):'<div class="empty"><strong>Début de la conversation</strong>Échangez ici au sujet de cette demande. Seules les personnes autorisées à consulter la visite peuvent lire ces messages.</div>';
 box.scrollTop=box.scrollHeight;
}
async function openChat(visitId,visitorName){
 if(!ctx){toast("La conversation n’est pas encore prête.","error");return;}
 if(channel){await db.removeChannel(channel);channel=null;}
 currentVisitId=visitId;const modal=ensureModal();$("#chat-title",modal).textContent="Discussion · "+(visitorName||"Visite");$("#chat-description",modal).textContent="Conversation interne liée à cette demande d’audience.";setOpen(true);await loadMessages();
 channel=db.channel("visit-chat-"+visitId).on("postgres_changes",{event:"INSERT",schema:"public",table:"visit_messages",filter:"visit_id=eq."+visitId},()=>loadMessages()).subscribe();
}
function closeChat(){setOpen(false);currentVisitId=null;if(channel){db.removeChannel(channel);channel=null;}}
document.addEventListener("click",e=>{
 const open=e.target.closest("[data-open-chat]");if(open){e.preventDefault();openChat(open.dataset.openChat,open.dataset.chatTitle||"Visite");return;}
 if(e.target.closest("[data-chat-close]")){closeChat();return;}
 const modal=document.getElementById(modalId);if(modal&&e.target===modal)closeChat();
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!document.getElementById(modalId)?.classList.contains("hidden"))closeChat();});
document.addEventListener("submit",async e=>{
 if(e.target.id!=="chat-form")return;e.preventDefault();
 const form=e.target,textarea=$("#chat-message-input"),button=form.querySelector('[type="submit"]'),message=textarea.value.trim();
 if(!message||!currentVisitId||!ctx)return;
 setButtonBusy(button,true,"Envoi…");
 const {error}=await db.from("visit_messages").insert({visit_id:currentVisitId,sender_id:ctx.session.user.id,message});
 if(error){toast(error.message||"Message non envoyé.","error");setButtonBusy(button,false);return;}
 textarea.value="";setButtonBusy(button,false);await loadMessages();
});
window.VisitChat={init(value){ctx=value;ensureModal();}};
})();