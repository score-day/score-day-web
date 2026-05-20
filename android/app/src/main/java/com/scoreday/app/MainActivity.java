package com.scoreday.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String PREFS_UI         = "ScoreDayUI";
    private static final String KEY_PINNED        = "widget_pin_prompted";
    private static final String KEY_BATTERY_ASKED = "battery_opt_asked";

    @Override
    public void onResume() {
        super.onResume();
        // Refresh widget data 3 s after resume (JS layer has written fresh prefs by then).
        new Handler(Looper.getMainLooper()).postDelayed(this::refreshWidget, 3000);

        SharedPreferences uiPrefs = getSharedPreferences(PREFS_UI, Context.MODE_PRIVATE);
        if (!uiPrefs.getBoolean(KEY_PINNED, false)) {
            new Handler(Looper.getMainLooper()).postDelayed(this::maybePromptWidget, 5000);
        }
        // Ask once to be exempted from battery optimization — needed for reliable widget updates.
        if (!uiPrefs.getBoolean(KEY_BATTERY_ASKED, false)) {
            new Handler(Looper.getMainLooper()).postDelayed(this::maybeRequestBatteryExemption, 8000);
        }
    }

    // ── Widget data refresh ──────────────────────────────────────────────────

    private void refreshWidget() {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(this);
            int[] ids = mgr.getAppWidgetIds(new ComponentName(this, ScoreDayWidget.class));
            if (ids.length == 0) return;
            Intent intent = new Intent(this, ScoreDayWidget.class);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            sendBroadcast(intent);
        } catch (Exception ignored) {}
    }

    // ── Battery optimization exemption ───────────────────────────────────────

    private void maybeRequestBatteryExemption() {
        SharedPreferences prefs = getSharedPreferences(PREFS_UI, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_BATTERY_ASKED, true).apply();
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            }
        } catch (Exception ignored) {}
    }

    // ── One-time widget pin prompt ───────────────────────────────────────────

    private void maybePromptWidget() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        AppWidgetManager mgr = AppWidgetManager.getInstance(this);
        if (!mgr.isRequestPinAppWidgetSupported()) return;

        ComponentName cn = new ComponentName(this, ScoreDayWidget.class);
        if (mgr.getAppWidgetIds(cn).length > 0) return;

        SharedPreferences prefs = getSharedPreferences(PREFS_UI, Context.MODE_PRIVATE);
        if (prefs.getBoolean(KEY_PINNED, false)) return;

        prefs.edit().putBoolean(KEY_PINNED, true).apply();

        try {
            Intent callbackIntent = new Intent(this, ScoreDayWidget.class);
            callbackIntent.setAction("com.scoreday.app.WIDGET_PINNED");
            PendingIntent successCallback = PendingIntent.getBroadcast(
                this, 0, callbackIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            mgr.requestPinAppWidget(cn, null, successCallback);
        } catch (Exception ignored) {}
    }
}
