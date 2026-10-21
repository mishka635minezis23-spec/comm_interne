(function(){"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));window.$=$;window.$$=$$;
window.escapeHTML=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
window.toast=(message,type="")=>{let region=$(".toast-region");if(!region){region=document.createElement("div");region.className="toast-region";document.body.appendChild(region);}const item=document.createElement("div");item.className="toast "+type;item.textContent=message;region.appendChild(item);setTimeout(()=>item.remove(),4000);};
window.formatDate=(value,withTime=true)=>{if(!value)return "—";const d=new Date(value);if(Number.isNaN(d.getTime()))return "—";return new Intl.DateTimeFormat("fr-FR",withTime?{dateStyle:"short",timeStyle:"short"}:{dateStyle:"medium"}).format(d);};
window.responseLabel=v=>({pending:"En attente",viewed:"Vue",authorized:"Autorisée",waiting:"Patienter",unavailable:"Indisponible",no_response:"Sans réponse",cancelled:"Annulée"}[v]||v||"—");
window.presenceLabel=v=>({not_arrived:"Pas encore arrivé",in_visit:"En visite",completed:"Terminée"}[v]||v||"—");
window.availabilityLabel=v=>({available:"Disponible",in_meeting:"En réunion",do_not_disturb:"Ne pas déranger",absent:"Absent"}[v]||v||"—");
window.badgeClass=v=>({authorized:"green",completed:"green",available:"green",waiting:"orange",in_meeting:"orange",pending:"blue",viewed:"blue",unavailable:"red",no_response:"red",cancelled:"red",do_not_dnd:"orange",do_not_disturb:"orange",absent:"red",in_visit:"green"}[v]||"");
window.badge=(v,label)=>'<span class="badge '+window.badgeClass(v)+'">'+window.escapeHTML(label||window.responseLabel(v))+'</span>';
window.setButtonBusy=(b,busy,label="Chargement…")=>{if(!b)return;if(busy){b.dataset.oldText=b.innerHTML;b.disabled=true;b.textContent=label;}else{b.disabled=false;if(b.dataset.oldText){b.innerHTML=b.dataset.oldText;delete b.dataset.oldText;}}};
window.getSessionProfile=async()=>{const {data:{session},error}=await db.auth.getSession();if(error)throw error;if(!session){location.replace("index.html");return null;}const {data:profile,error:pe}=await db.from("staff_members").select("id,full_name,email,role,floor_id,delegate_member_id,availability,availability_until,is_active").eq("id",session.user.id).maybeSingle();if(pe)throw pe;if(!profile||!profile.is_active){await db.auth.signOut();location.replace("index.html");return null;}return {session,profile};};
window.requireRoles=async roles=>{const ctx=await getSessionProfile();if(!ctx)return null;if(!roles.includes(ctx.profile.role)){toast("Ton compte n’a pas accès à cette page.","error");location.replace(ctx.profile.role==="admin"?"admin.html":(["reception","secretary"].includes(ctx.profile.role)?"reception.html":"personnel.html"));return null;}const name=$("#user-name");if(name)name.textContent=ctx.profile.full_name;const role=$("#user-role");if(role)role.textContent=({admin:"Administrateur",reception:"Réception",secretary:"Secrétariat",member:"Personnel"}[ctx.profile.role]||ctx.profile.role);const out=$("#sign-out");if(out)out.addEventListener("click",async()=>{try{await window.UJADINativeNotifications?.deactivate?.();}catch(error){console.warn("Déconnexion mobile :",error);}await db.auth.signOut();location.replace("index.html");});return ctx;};
window.invokeVisitAlert=async payload=>{
 const refreshSession=async force=>{
  const {data,error}=await db.auth.getSession();
  if(error)throw error;
  if(!data.session)throw new Error("Session expirée. Reconnecte-toi avant de transmettre l’alerte.");
  const expiresAt=(data.session.expires_at||0)*1000;
  if(force||expiresAt<=Date.now()+90000){
   const {data:refreshed,error:refreshError}=await db.auth.refreshSession();
   if(refreshError||!refreshed?.session)throw refreshError||new Error("Impossible de renouveler la session Supabase.");
  }
 };
 await refreshSession(false);
 let result=await db.functions.invoke("send-visit-alert",{body:payload});
 const status=result.error?.context?.status;
 if(result.error&&(status===401||/\\b401\\b|session invalide/i.test(result.error.message||""))){
  await refreshSession(true);
  result=await db.functions.invoke("send-visit-alert",{body:payload});
 }
 return result;
};
window.bindCommonNav=active=>{$$("[data-nav]").forEach(a=>a.classList.toggle("active",a.dataset.nav===active));$$("[data-bottom-nav]").forEach(a=>a.classList.toggle("active",a.dataset.bottomNav===active));};

window.hydrateVisitPhotos=async root=>{
 const container=root||document;
 const images=Array.from(container.querySelectorAll("[data-photo-path]")).filter(img=>!img.dataset.photoLoaded);
 for(const img of images){
  img.dataset.photoLoaded="1";
  const {data,error}=await db.storage.from("visitor-photos").createSignedUrl(img.dataset.photoPath,3600);
  if(error||!data?.signedUrl){img.hidden=true;continue;}
  img.src=data.signedUrl;img.hidden=false;img.tabIndex=0;img.setAttribute("role","button");img.setAttribute("aria-haspopup","dialog");img.setAttribute("aria-label","Agrandir la photo du visiteur");
  img.addEventListener("error",()=>{img.hidden=true;},{once:true});
 }
};

function ensurePhotoViewer(){
 let viewer=$("#visit-photo-viewer");
 if(viewer)return viewer;
 viewer=document.createElement("div");
 viewer.id="visit-photo-viewer";
 viewer.className="photo-viewer hidden";
 viewer.setAttribute("role","dialog");
 viewer.setAttribute("aria-modal","true");
 viewer.setAttribute("aria-label","Agrandissement de la photo du visiteur");
 viewer.innerHTML='<button type="button" class="photo-viewer-close" aria-label="Fermer la photo">×</button><div class="photo-viewer-content"><img class="photo-viewer-image" alt=""><p class="photo-viewer-caption"></p></div>';
 document.body.appendChild(viewer);
 return viewer;
}
let photoViewerReturnFocus=null;
async function openPhotoViewer(thumbnail){
 const viewer=ensurePhotoViewer(),image=$(".photo-viewer-image",viewer),caption=$(".photo-viewer-caption",viewer),close=$(".photo-viewer-close",viewer);
 photoViewerReturnFocus=thumbnail;
 image.removeAttribute("src");
 image.alt=thumbnail.alt||"Photo du visiteur";
 caption.textContent=thumbnail.alt||"Photo du visiteur";
 viewer.classList.remove("hidden");
 document.body.classList.add("modal-open");
 close.focus();
 const path=thumbnail.dataset.photoPath;
 const {data,error}=await db.storage.from("visitor-photos").createSignedUrl(path,3600);
 if(error||!data?.signedUrl){
  toast("La photo ne peut pas être affichée pour le moment.","error");
  closePhotoViewer();
  return;
 }
 image.src=data.signedUrl;
}
function closePhotoViewer(){
 const viewer=$("#visit-photo-viewer");
 if(!viewer)return;
 viewer.classList.add("hidden");
 document.body.classList.remove("modal-open");
 const image=$(".photo-viewer-image",viewer);
 image.removeAttribute("src");
 if(photoViewerReturnFocus?.isConnected)photoViewerReturnFocus.focus();
 photoViewerReturnFocus=null;
}
document.addEventListener("click",event=>{
 const thumbnail=event.target.closest("img[data-photo-path]");
 if(thumbnail&&!thumbnail.hidden){
  event.preventDefault();
  openPhotoViewer(thumbnail);
  return;
 }
 const viewer=$("#visit-photo-viewer");
 if(viewer&&!viewer.classList.contains("hidden")){
  if(event.target===viewer||event.target.closest(".photo-viewer-close"))closePhotoViewer();
 }
});
document.addEventListener("keydown",event=>{
 const thumbnail=event.target.closest?.("img[data-photo-path]");
 if(thumbnail&&(event.key==="Enter"||event.key===" ")){event.preventDefault();openPhotoViewer(thumbnail);return;}
 const viewer=$("#visit-photo-viewer");
 if(event.key==="Escape"&&viewer&&!viewer.classList.contains("hidden"))closePhotoViewer();
});
window.isOnline=()=>{const el=$("#connection-status");if(el){el.textContent=navigator.onLine?"En ligne":"Hors ligne";el.classList.toggle("offline",!navigator.onLine);}};window.addEventListener("online",isOnline);window.addEventListener("offline",isOnline);document.addEventListener("DOMContentLoaded",isOnline);
})();