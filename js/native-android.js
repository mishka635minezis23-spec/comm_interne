import { Capacitor, registerPlugin } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

const NativeAlerts = registerPlugin("UJADIAlerts");
let activeUserId = null;
let activeToken = null;
let listenersReady = false;
let initRunning = false;

function isAndroidApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

async function stopAlert(visitId) {
  if (!isAndroidApp() || !visitId) return;
  try {
    await NativeAlerts.stopAlert({ visitId });
  } catch (error) {
    console.warn("Impossible d'arrêter l'alerte native :", error);
  }
}

async function dispatch(event, visitId) {
  if (!visitId || !window.db) return;
  const { error } = await db.functions.invoke("send-visit-alert", {
    body: { event, visit_id: visitId }
  });
  if (error) console.warn("Notification de suivi non transmise :", error.message);
}

async function acknowledge(visitId) {
  if (!visitId) return;
  await stopAlert(visitId);
  await dispatch("member_acknowledged", visitId);
}

function navigateToVisit(visitId, action = "open") {
  if (!visitId) return;
  const params = new URLSearchParams({ visit: visitId });
  if (action === "acknowledge") params.set("ack", "1");
  const target = "personnel.html?" + params.toString();
  if (location.pathname.endsWith("/personnel.html") && location.search === "?" + params.toString()) {
    return;
  }
  location.href = target;
}

async function handleOpenedVisit(visitId, action) {
  if (!visitId) return;
  await acknowledge(visitId);
  navigateToVisit(visitId, action);
}

async function saveDeviceToken(token) {
  if (!activeUserId || !token?.value) return;
  activeToken = token.value;
  const { error } = await db.from("devices").upsert({
    member_id: activeUserId,
    platform: "android",
    device_label: (navigator.userAgent || "Android").slice(0, 180),
    push_token: token.value,
    is_active: true,
    last_seen_at: new Date().toISOString()
  }, { onConflict: "push_token" });
  if (error) console.warn("Jeton Android non enregistré :", error.message);
}

async function handlePendingLaunch() {
  try {
    const pending = await NativeAlerts.getLaunchData();
    if (pending?.visitId) {
      await handleOpenedVisit(pending.visitId, pending.action || "open");
    }
  } catch (error) {
    console.warn("Lecture de l'ouverture native impossible :", error);
  }
}

async function startForUser(userId) {
  if (!userId || activeUserId === userId || initRunning) return;
  initRunning = true;
  try {
    const { data: profile, error } = await db.from("staff_members")
      .select("id,is_active").eq("id", userId).maybeSingle();
    if (error || !profile?.is_active) return;

    activeUserId = userId;
    const permissions = await PushNotifications.checkPermissions();
    const permission = permissions.receive === "granted"
      ? permissions
      : await PushNotifications.requestPermissions();

    if (permission.receive !== "granted") {
      console.info("Les notifications Android sont désactivées pour cette application.");
      return;
    }

    await PushNotifications.register();
    await handlePendingLaunch();
  } catch (error) {
    console.warn("Initialisation des notifications Android impossible :", error);
  } finally {
    initRunning = false;
  }
}

async function addListeners() {
  if (listenersReady) return;
  listenersReady = true;

  await PushNotifications.addListener("registration", saveDeviceToken);
  await PushNotifications.addListener("registrationError", error => {
    console.warn("Échec d'enregistrement FCM :", error);
  });
  await PushNotifications.addListener("pushNotificationReceived", notification => {
    const data = notification?.data || {};
    if (data.event === "visit_alert_start" && window.toast) {
      toast("Nouvelle demande d'audience reçue.", "info");
    }
  });
  await PushNotifications.addListener("pushNotificationActionPerformed", action => {
    const data = action?.notification?.data || {};
    const visitId = data.visit_id || data.ujadi_visit_id;
    const alertAction = data.alert_action || "open";
    void handleOpenedVisit(visitId, alertAction);
  });
}

async function deactivate() {
  const userId = activeUserId;
  const token = activeToken;
  if (userId && token && window.db) {
    const { error } = await db.from("devices").delete()
      .eq("member_id", userId).eq("platform", "android").eq("push_token", token);
    if (error) console.warn("Désactivation du téléphone impossible :", error.message);
  }
  activeUserId = null;
  activeToken = null;
}

if (isAndroidApp() && window.db) {
  void (async () => {
    await addListeners();
    db.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id) {
        queueMicrotask(() => void startForUser(session.user.id));
      } else {
        activeUserId = null;
        activeToken = null;
      }
    });
    const { data } = await db.auth.getSession();
    if (data?.session?.user?.id) await startForUser(data.session.user.id);
  })().catch(error => console.warn("Initialisation Android indisponible :", error));
}

window.UJADINativeNotifications = {
  stopAlert,
  acknowledge,
  deactivate
};
