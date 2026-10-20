package org.ujadiongd.accueil;

import android.util.Log;

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class UjadiMessagingService extends FirebaseMessagingService {
    private static final String TAG = "UJADI-Push";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        String event = message.getData().get("event");
        String visitId = message.getData().get("visit_id");
        String visitorName = message.getData().get("visitor_name");

        try {
            if ("visit_alert_start".equals(event) && visitId != null) {
                if (message.getPriority() == RemoteMessage.PRIORITY_HIGH) {
                    AlertSoundService.startAlert(this, visitId,
                        visitorName == null ? "Visiteur" : visitorName);
                } else {
                    Log.w(TAG, "Alerte ignorée : priorité FCM non élevée.");
                }
            } else if ("visit_alert_stop".equals(event) && visitId != null) {
                AlertSoundService.stopAlert(this, visitId);
            }
        } catch (Exception exception) {
            Log.e(TAG, "Traitement de l'alerte UJADI impossible", exception);
        }

        // Conserve les événements Capacitor lorsque l'application est au premier plan.
        PushNotificationsPlugin.sendRemoteMessage(message);
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        PushNotificationsPlugin.onNewToken(token);
    }
}
