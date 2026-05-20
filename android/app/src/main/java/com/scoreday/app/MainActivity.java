package com.scoreday.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String PREFS_UI    = "ScoreDayUI";
    private static final String KEY_PINNED  = "widget_pin_prompted";

    @Override
    public void onResume() {
        super.onResume();
        // Refresh widget data 3 s after resume (JS layer has written fresh prefs by then).
        new Handler(Looper.getMainLooper()).postDelayed(this::refreshWidget, 3000);
        // Show the "add widget" prompt once — skip Handler allocation if already prompted.
        SharedPreferences uiPrefs = getSharedPreferences(PREFS_UI, Context.MODE_PRIVATE);
        if (!uiPrefs.getBoolean(KEY_PINNED, false)) {
            new Handler(Looper.getMainLooper()).postDelayed(this::maybePromptWidget, 5000);
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

    // ── One-time widget pin prompt ───────────────────────────────────────────

    private void maybePromptWidget() {
        // Requires Android 8+ (API 26).
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        AppWidgetManager mgr = AppWidgetManager.getInstance(this);

        // Launcher doesn't support pinning — skip silently.
        if (!mgr.isRequestPinAppWidgetSupported()) return;

        // Widget already on the home screen — skip.
        ComponentName cn = new ComponentName(this, ScoreDayWidget.class);
        if (mgr.getAppWidgetIds(cn).length > 0) return;

        // Already prompted this install — skip.
        SharedPreferences prefs = getSharedPreferences(PREFS_UI, Context.MODE_PRIVATE);
        if (prefs.getBoolean(KEY_PINNED, false)) return;

        // Mark as prompted before the call so a crash can't loop it.
        prefs.edit().putBoolean(KEY_PINNED, true).apply();

        try {
            // Success callback — fires if the user taps "Add" in the system dialog.
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
