package com.scoreday.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.app.PendingIntent;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

public class ScoreDayWidget extends AppWidgetProvider {

    private static final String PREFS      = "CapacitorStorage";
    private static final String KEY_SCORE  = "sd_score";
    private static final String KEY_STREAK = "sd_streak";
    private static final String KEY_STATUS = "sd_status";
    private static final String KEY_PTS    = "sd_pts";
    private static final String KEY_TASKS  = "sd_tasks";

    private static final int[] ROW_IDS    = {R.id.task_row_0,    R.id.task_row_1,    R.id.task_row_2,    R.id.task_row_3};
    private static final int[] CHECK_IDS  = {R.id.task_check_0,  R.id.task_check_1,  R.id.task_check_2,  R.id.task_check_3};
    private static final int[] TITLE_IDS  = {R.id.task_title_0,  R.id.task_title_1,  R.id.task_title_2,  R.id.task_title_3};
    private static final int[] WEIGHT_IDS = {R.id.task_weight_0, R.id.task_weight_1, R.id.task_weight_2, R.id.task_weight_3};

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            updateWidget(context, mgr, id);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, ScoreDayWidget.class);
            for (int id : mgr.getAppWidgetIds(cn)) {
                updateWidget(context, mgr, id);
            }
        }
    }

    static void updateWidget(Context context, AppWidgetManager mgr, int id) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String scoreStr  = prefs.getString(KEY_SCORE,  null);
        String streakStr = prefs.getString(KEY_STREAK, "0");
        String status    = prefs.getString(KEY_STATUS, "");
        String pts       = prefs.getString(KEY_PTS,    "");
        String tasksJson = prefs.getString(KEY_TASKS,  "[]");

        // Parse numerics
        int score = -1;
        try { if (scoreStr != null) score = Integer.parseInt(scoreStr.trim()); } catch (NumberFormatException ignored) {}
        int streak = 0;
        try { streak = Integer.parseInt(streakStr.trim()); } catch (NumberFormatException ignored) {}

        // Score colour and display
        int scoreColor;
        String scoreDisplay;
        if ("rest".equals(status)) {
            scoreColor   = Color.parseColor("#818cf8");
            scoreDisplay = "🌙";
        } else if ("planning".equals(status) || score < 0) {
            scoreColor   = Color.parseColor("#6b7280");
            scoreDisplay = "--";
        } else if (score >= 80) {
            scoreColor   = Color.parseColor("#a78bfa");
            scoreDisplay = score + "%";
        } else if (score >= 50) {
            scoreColor   = Color.parseColor("#fbbf24");
            scoreDisplay = score + "%";
        } else {
            scoreColor   = Color.parseColor("#f87171");
            scoreDisplay = score + "%";
        }

        // Sub-label
        String subLabel = (!pts.isEmpty() && !"planning".equals(status) && !"rest".equals(status))
            ? pts + " pts" : "";

        // Streak
        String streakLabel = streak > 0 ? "🔥 " + streak : "";

        // Build RemoteViews
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_score_day);
        views.setTextViewText(R.id.widget_score,  scoreDisplay);
        views.setTextColor(R.id.widget_score, scoreColor);
        views.setTextViewText(R.id.widget_sub,    subLabel);
        views.setTextViewText(R.id.widget_streak, streakLabel);

        // Right panel: task rows (active/locked) or status label (planning/rest)
        boolean showList = "active".equals(status) || "locked".equals(status);

        if (showList) {
            views.setViewVisibility(R.id.widget_task_list,   View.VISIBLE);
            views.setViewVisibility(R.id.widget_empty_label, View.GONE);

            // Parse tasks from SharedPreferences — no RemoteViewsService needed.
            JSONArray arr = new JSONArray();
            try { arr = new JSONArray(tasksJson); } catch (Exception ignored) {}

            for (int i = 0; i < ROW_IDS.length; i++) {
                if (i < arr.length()) {
                    JSONObject obj = arr.optJSONObject(i);
                    boolean done   = obj != null && obj.optBoolean("done", false);
                    String  title  = obj != null ? obj.optString("title", "") : "";
                    int     weight = obj != null ? obj.optInt("weight", 0) : 0;

                    views.setViewVisibility(ROW_IDS[i], View.VISIBLE);
                    views.setTextViewText(CHECK_IDS[i],  done ? "✓" : "○");
                    views.setTextColor(CHECK_IDS[i],     done ? Color.parseColor("#a78bfa") : Color.parseColor("#555577"));
                    views.setTextViewText(TITLE_IDS[i],  title);
                    views.setTextColor(TITLE_IDS[i],     done ? Color.parseColor("#4a4a6a") : Color.parseColor("#e8e8f0"));
                    views.setTextViewText(WEIGHT_IDS[i], String.valueOf(weight));
                    views.setTextColor(WEIGHT_IDS[i],    Color.parseColor("#555577"));
                } else {
                    views.setViewVisibility(ROW_IDS[i], View.GONE);
                }
            }

        } else {
            views.setViewVisibility(R.id.widget_task_list,   View.GONE);
            views.setViewVisibility(R.id.widget_empty_label, View.VISIBLE);

            String emptyText;
            if ("rest".equals(status))         emptyText = "Rest day 🌙";
            else if ("planning".equals(status)) emptyText = "Planning your day...";
            else                                emptyText = "Open app to sync";

            views.setTextViewText(R.id.widget_empty_label, emptyText);
        }

        // Tap anywhere → open app
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            PendingIntent pi = PendingIntent.getActivity(
                context, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pi);
        }

        mgr.updateAppWidget(id, views);
    }
}
