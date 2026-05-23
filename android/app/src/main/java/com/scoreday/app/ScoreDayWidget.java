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

/**
 * Score Day · V4 Bento Bold widget provider.
 *
 * Drives the bento layout (widget_score_day.xml):
 *   - Score hero tile (lime / amber / red depending on score range)
 *   - Streak tile (amber)
 *   - Tier tile (indigo) — derived from score
 *   - Tasks tile (up to 4 rows)
 *
 * Reads the same SharedPreferences keys as the original provider so the
 * Capacitor side does not need to change.
 */
public class ScoreDayWidget extends AppWidgetProvider {

    static final String ACTION_REFRESH = "com.scoreday.app.WIDGET_REFRESH";

    private static final String PREFS      = "CapacitorStorage";
    private static final String KEY_SCORE  = "sd_score";
    private static final String KEY_STREAK = "sd_streak";
    private static final String KEY_STATUS = "sd_status";
    private static final String KEY_PTS    = "sd_pts";
    private static final String KEY_TASKS  = "sd_tasks";

    // ── Palette (V4 Bento Bold) ────────────────────────────────────────
    private static final int LIME       = Color.parseColor("#22c55e");
    private static final int AMBER      = Color.parseColor("#fbbf24");
    private static final int CORAL      = Color.parseColor("#f87171");
    private static final int INDIGO     = Color.parseColor("#a5b4fc");
    private static final int FG_PRIMARY = Color.parseColor("#e7e7ec");
    private static final int FG_MUTED   = Color.parseColor("#7a7a86");
    private static final int FG_DIM     = Color.parseColor("#5a5a66");
    private static final int FG_DEAD    = Color.parseColor("#3a3a44");
    private static final int RING_DIM   = Color.parseColor("#2c2d36");

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
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || ACTION_REFRESH.equals(action)) {
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

        int score = -1;
        try { if (scoreStr != null) score = Integer.parseInt(scoreStr.trim()); } catch (NumberFormatException ignored) {}
        int streak = 0;
        try { streak = Integer.parseInt(streakStr.trim()); } catch (NumberFormatException ignored) {}

        // ── Score colour and display ───────────────────────────────────
        int    scoreColor;
        String scoreNum;
        String scoreUnit;

        if ("rest".equals(status)) {
            scoreColor = INDIGO;
            scoreNum   = "🌙";
            scoreUnit  = "";
        } else if ("planning".equals(status) || score < 0) {
            scoreColor = FG_MUTED;
            scoreNum   = "—";
            scoreUnit  = "";
        } else if (score >= 75) {
            scoreColor = LIME;
            scoreNum   = String.valueOf(score);
            scoreUnit  = "%";
        } else if (score >= 50) {
            scoreColor = AMBER;
            scoreNum   = String.valueOf(score);
            scoreUnit  = "%";
        } else {
            scoreColor = CORAL;
            scoreNum   = String.valueOf(score);
            scoreUnit  = "%";
        }

        // ── Tier (streak-based) ────────────────────────────────────────
        String tier;
        int    tierColor;
        if ("rest".equals(status) || "planning".equals(status) || score < 0) {
            tier      = "—";
            tierColor = FG_DIM;
        } else if (streak >= 180) {
            tier      = "S";
            tierColor = INDIGO;
        } else if (streak >= 90) {
            tier      = "A";
            tierColor = INDIGO;
        } else if (streak >= 30) {
            tier      = "B";
            tierColor = AMBER;
        } else {
            tier      = "C";
            tierColor = CORAL;
        }

        String subLabel = (!pts.isEmpty() && !"planning".equals(status) && !"rest".equals(status))
            ? pts + " pts" : "";

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_score_day);

        // ── Score hero ─────────────────────────────────────────────────
        views.setTextViewText(R.id.widget_score,      scoreNum);
        views.setTextColor   (R.id.widget_score,      scoreColor);
        views.setTextViewText(R.id.widget_score_unit, scoreUnit);
        views.setTextViewText(R.id.widget_sub,        subLabel);
        views.setTextColor   (R.id.widget_live_dot,   scoreColor);

        // ── Streak tile ────────────────────────────────────────────────
        views.setTextViewText(R.id.widget_streak_value, streak > 0 ? String.valueOf(streak) : "0");
        views.setTextColor   (R.id.widget_streak_value, streak > 0 ? AMBER : FG_DIM);

        // ── Tier tile ──────────────────────────────────────────────────
        views.setTextViewText(R.id.widget_tier_value, tier);
        views.setTextColor   (R.id.widget_tier_value, tierColor);
        views.setTextViewText(R.id.widget_tier_delta, "");  // could be wired to a tier-delta pref later

        // ── Right tile content: task list OR empty state ───────────────
        boolean showList = "active".equals(status) || "locked".equals(status);

        if (showList) {
            views.setViewVisibility(R.id.widget_task_list,   View.VISIBLE);
            views.setViewVisibility(R.id.widget_empty_label, View.GONE);

            JSONArray arr = new JSONArray();
            try { arr = new JSONArray(tasksJson); } catch (Exception ignored) {}

            int dotColor = "locked".equals(status) ? FG_MUTED : LIME;

            for (int i = 0; i < ROW_IDS.length; i++) {
                if (i < arr.length()) {
                    JSONObject obj = arr.optJSONObject(i);
                    boolean done   = obj != null && obj.optBoolean("done", false);
                    String  title  = obj != null ? obj.optString("title", "") : "";
                    int     weight = obj != null ? obj.optInt("weight", 0) : 0;

                    views.setViewVisibility(ROW_IDS[i], View.VISIBLE);

                    // Check glyph: filled dot when done, hollow ring when not.
                    views.setTextViewText(CHECK_IDS[i], done ? "●" : "○");
                    views.setTextColor   (CHECK_IDS[i], done ? dotColor : RING_DIM);

                    views.setTextViewText(TITLE_IDS[i], title);
                    views.setTextColor   (TITLE_IDS[i], done ? FG_DIM : FG_PRIMARY);

                    views.setTextViewText(WEIGHT_IDS[i], "+" + weight);
                    views.setTextColor   (WEIGHT_IDS[i], done ? FG_DIM : FG_PRIMARY);
                } else {
                    views.setViewVisibility(ROW_IDS[i], View.GONE);
                }
            }
        } else {
            views.setViewVisibility(R.id.widget_task_list,   View.GONE);
            views.setViewVisibility(R.id.widget_empty_label, View.VISIBLE);

            String emptyText;
            if      ("rest".equals(status))     emptyText = "Recovery scheduled · streak preserved";
            else if ("planning".equals(status)) emptyText = "Planning your day…";
            else                                emptyText = "Open app to sync";

            views.setTextViewText(R.id.widget_empty_label, emptyText);
        }

        // ── Refresh button ─────────────────────────────────────────────
        Intent refreshIntent = new Intent(context, ScoreDayWidget.class);
        refreshIntent.setAction(ACTION_REFRESH);
        PendingIntent refreshPi = PendingIntent.getBroadcast(
            context, 1, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_refresh, refreshPi);

        // ── Tap anywhere → open app ────────────────────────────────────
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
