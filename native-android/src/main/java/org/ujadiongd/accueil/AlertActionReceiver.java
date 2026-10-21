package org.ujadiongd.accueil;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class AlertActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String visitId = intent.getStringExtra("visit_id");
        String action = intent.getStringExtra("alert_action");
        AlertSoundService.stopAlert(context, visitId);

        Intent launch = context.getPackageManager()
            .getLaunchIntentForPackage(context.getPackageName());
        if (launch == null) return;

        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
            | Intent.FLAG_ACTIVITY_CLEAR_TOP
            | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launch.putExtra("ujadi_visit_id", visitId);
        launch.putExtra("visit_id", visitId);
        launch.putExtra("ujadi_alert_action",
            action == null ? "open" : action);
        launch.putExtra("alert_action",
            action == null ? "open" : action);
        launch.putExtra("google.message_id", "ujadi-local-" + System.currentTimeMillis());
        launch.putExtra("event", "visit_alert_opened");
        context.startActivity(launch);
    }
}
