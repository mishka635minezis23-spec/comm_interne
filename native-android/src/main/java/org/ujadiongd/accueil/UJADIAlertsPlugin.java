package org.ujadiongd.accueil;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "UJADIAlerts")
public class UJADIAlertsPlugin extends Plugin {
    @PluginMethod
    public void stopAlert(PluginCall call) {
        String visitId = call.getString("visitId");
        AlertSoundService.stopAlert(getContext(), visitId);
        call.resolve();
    }

    @PluginMethod
    public void getLaunchData(PluginCall call) {
        JSObject result = new JSObject();
        Intent intent = getActivity().getIntent();
        if (intent != null) {
            String visitId = intent.getStringExtra("ujadi_visit_id");
            String action = intent.getStringExtra("ujadi_alert_action");
            if (visitId != null) result.put("visitId", visitId);
            if (action != null) result.put("action", action);
        }
        call.resolve(result);
    }
}
