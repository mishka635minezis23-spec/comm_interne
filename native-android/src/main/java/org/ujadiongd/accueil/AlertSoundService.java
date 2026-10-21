package org.ujadiongd.accueil;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.util.LinkedHashMap;
import java.util.Map;

public class AlertSoundService extends Service {
    private static final String TAG = "UJADI-Alert";
    private static final String CHANNEL_ID = "ujadi_pending_audience_v1";
    private static final int NOTIFICATION_ID = 73120;
    private static final String ACTION_START = "org.ujadiongd.accueil.ALERT_START";
    private static volatile AlertSoundService runningInstance;

    private final Map<String, String> activeAlerts = new LinkedHashMap<>();
    private MediaPlayer player;

    public static void startAlert(Context context, String visitId, String visitorName) {
        Intent intent = new Intent(context, AlertSoundService.class)
            .setAction(ACTION_START)
            .putExtra("visit_id", visitId)
            .putExtra("visitor_name", visitorName);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stopAlert(Context context, String visitId) {
        AlertSoundService service = runningInstance;
        if (service != null) {
            service.removeAlert(visitId);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        runningInstance = this;
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || !ACTION_START.equals(intent.getAction())) {
            return START_NOT_STICKY;
        }

        String visitId = intent.getStringExtra("visit_id");
        String visitorName = intent.getStringExtra("visitor_name");
        if (visitId == null || visitId.trim().isEmpty()) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }

        activeAlerts.put(visitId, visitorName == null ? "Visiteur" : visitorName);
        Notification notification = buildNotification();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            if (player == null) startRepeatingSound();
            else updateNotification();
        } catch (Exception exception) {
            Log.e(TAG, "Impossible de démarrer le service d'alerte", exception);
            stopSelf(startId);
        }
        return START_NOT_STICKY;
    }

    private void removeAlert(String visitId) {
        if (visitId == null) return;
        activeAlerts.remove(visitId);
        if (activeAlerts.isEmpty()) {
            stopRepeatingSound();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        } else {
            updateNotification();
        }
    }

    private void updateNotification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification());
    }

    private Notification buildNotification() {
        String firstName = activeAlerts.isEmpty()
            ? "Demande d'audience"
            : activeAlerts.values().iterator().next();
        String body = activeAlerts.size() > 1
            ? activeAlerts.size() + " demandes attendent une action."
            : "Ouvre la demande pour arrêter la sonnerie.";

        String selectedVisit = activeAlerts.isEmpty()
            ? "" : activeAlerts.keySet().iterator().next();

        Intent openIntent = new Intent(this, AlertActionReceiver.class)
            .setAction("org.ujadiongd.accueil.ALERT_OPEN")
            .putExtra("visit_id", selectedVisit)
            .putExtra("alert_action", "open");
        PendingIntent openPending = PendingIntent.getBroadcast(
            this, 73121, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent ackIntent = new Intent(this, AlertActionReceiver.class)
            .setAction("org.ujadiongd.accueil.ALERT_ACK")
            .putExtra("visit_id", selectedVisit)
            .putExtra("alert_action", "acknowledge");
        PendingIntent ackPending = PendingIntent.getBroadcast(
            this, 73122, ackIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("UJADI · " + firstName)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setAutoCancel(false)
            .setSilent(true)
            .setContentIntent(openPending)
            .addAction(android.R.drawable.ic_menu_view, "Ouvrir", openPending)
            .addAction(android.R.drawable.ic_menu_send, "J'ai vu", ackPending)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "Alertes d'audience en cours",
            NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Notification persistante pendant une alerte d'audience.");
        channel.setSound(null, null);
        channel.enableVibration(false);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private void startRepeatingSound() {
        Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        if (uri == null) {
            Log.w(TAG, "Aucun son système par défaut disponible.");
            return;
        }

        try {
            player = new MediaPlayer();
            player.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            player.setDataSource(this, uri);
            player.setLooping(true);
            player.setOnPreparedListener(MediaPlayer::start);
            player.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "Erreur de lecture sonore: " + what + "/" + extra);
                stopRepeatingSound();
                return true;
            });
            player.prepareAsync();
        } catch (Exception exception) {
            Log.e(TAG, "Lecture de la sonnerie impossible", exception);
            stopRepeatingSound();
        }
    }

    private void stopRepeatingSound() {
        if (player != null) {
            try {
                if (player.isPlaying()) player.stop();
            } catch (IllegalStateException ignored) {}
            player.release();
            player = null;
        }
    }

    @Override
    public void onDestroy() {
        stopRepeatingSound();
        activeAlerts.clear();
        if (runningInstance == this) runningInstance = null;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
