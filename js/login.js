(() => {
  "use strict";

  const form = document.getElementById("login-form");
  if (!form) {
    console.error("[UJADI login] Formulaire #login-form introuvable.");
    return;
  }

  const button = form.querySelector('button[type="submit"]');

  function showMessage(message, type = "error") {
    if (typeof window.toast === "function") {
      window.toast(message, type);
      return;
    }

    let notice = document.getElementById("login-feedback");
    if (!notice) {
      notice = document.createElement("p");
      notice.id = "login-feedback";
      notice.setAttribute("role", "alert");
      notice.style.cssText = "margin-top:14px;padding:12px;border-radius:10px;background:#fff1f0;color:#9b1c1c;font-size:14px";
      form.appendChild(notice);
    }
    notice.textContent = message;
  }

  if (new URLSearchParams(window.location.search).get("session") === "expired") {
    showMessage("Ta session a expiré. Reconnecte-toi pour continuer.", "warning");
  }

  function isInvalidRefreshTokenError(error) {
    const message = String(error?.message || error?.msg || "");
    const code = String(error?.code || "");
    return code === "invalid_grant" || /invalid.{0,30}refresh token|refresh token.{0,40}(not found|invalid|already used|revoked)/i.test(message);
  }

  async function clearLocalSession() {
    try {
      await window.db?.auth?.signOut({ scope: "local" });
    } catch (error) {
      console.warn("[UJADI login] Nettoyage local de session :", error);
    }
  }

  function setBusy(busy) {
    if (!button) return;
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    button.textContent = busy ? "Connexion en cours…" : "Se connecter →";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (button?.disabled) return;

    const email = form.querySelector('[name="email"]')?.value.trim() || "";
    const password = form.querySelector('[name="password"]')?.value || "";

    if (!email || !password) {
      showMessage("Saisis ton e-mail et ton mot de passe.");
      return;
    }

    setBusy(true);

    try {
      const client = window.db;
      if (!client?.auth?.signInWithPassword) {
        throw new Error("Le service de connexion n'est pas initialisé. Vérifie ta connexion Internet puis relance l'application.");
      }

      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data?.user?.id) {
        throw new Error("Supabase n'a pas retourné de session utilisateur.");
      }

      const { data: profile, error: profileError } = await client
        .from("staff_members")
        .select("role,is_active")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile || !profile.is_active) {
        await client.auth.signOut({ scope: "local" });
        throw new Error("Aucun profil actif n'est associé à ce compte. Contacte l'administration.");
      }

      const destination = profile.role === "admin"
        ? "admin.html"
        : (["reception", "secretary"].includes(profile.role) ? "reception.html" : "personnel.html");

      window.location.replace(destination);
    } catch (error) {
      console.error("[UJADI login] Échec de connexion :", error);
      showMessage(error?.message || "Connexion impossible. Réessaie dans un instant.");
      setBusy(false);
    }
  });

  console.info("[UJADI login] Gestionnaire de connexion prêt.");

  (async () => {
    try {
      const client = window.db;
      if (!client?.auth) return;

      const { data, error } = await client.auth.getSession();
      if (error) throw error;

      const userId = data?.session?.user?.id;
      if (!userId) return;

      const { data: profile, error: profileError } = await client
        .from("staff_members")
        .select("role,is_active")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile?.is_active) return;

      const destination = profile.role === "admin"
        ? "admin.html"
        : (["reception", "secretary"].includes(profile.role) ? "reception.html" : "personnel.html");

      window.location.replace(destination);
    } catch (error) {
      if (isInvalidRefreshTokenError(error)) {\n        await clearLocalSession();\n        showMessage("Une ancienne session n’est plus valide. Reconnecte-toi avec tes identifiants.", "warning");\n        return;\n      }\n      console.warn("[UJADI login] Vérification de session ignorée :", error);
    }
  })();
})();