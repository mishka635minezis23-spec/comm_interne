(function(){ "use strict";
  if(!window.APP_CONFIG||!window.supabase||!window.supabase.createClient){console.error("Supabase/config.js manquant");return;}
  window.db=window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL,window.APP_CONFIG.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}});
})();