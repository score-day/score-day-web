package com.scoreday.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class ScoreDayTaskFactory implements RemoteViewsService.RemoteViewsFactory {

    private static final String PREFS     = "CapacitorStorage";
    private static final String KEY_TASKS = "sd_tasks";

    private final Context context;
    private final List<TaskItem> tasks = new ArrayList<>();

    ScoreDayTaskFactory(Context context) {
        this.context = context;
    }

    @Override
    public void onCreate() {
        loadTasks();
    }

    @Override
    public void onDataSetChanged() {
        // Called on a background thread — safe to read SharedPreferences.
        loadTasks();
    }

    @Override
    public void onDestroy() {
        tasks.clear();
    }

    @Override
    public int getCount() {
        return tasks.size();
    }

    @Override
    public RemoteViews getViewAt(int position) {
        if (position < 0 || position >= tasks.size()) return null;
        TaskItem task = tasks.get(position);

        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_task_row);

        if (task.done) {
            rv.setTextViewText(R.id.task_check, "✓");
            rv.setTextColor(R.id.task_check, Color.parseColor("#a78bfa"));   // violet
            rv.setTextColor(R.id.task_title, Color.parseColor("#7a7a9a"));   // dimmed
        } else {
            rv.setTextViewText(R.id.task_check, "○");
            rv.setTextColor(R.id.task_check, Color.parseColor("#555577"));   // muted
            rv.setTextColor(R.id.task_title, Color.parseColor("#c4b5fd"));   // light violet
        }

        rv.setTextViewText(R.id.task_title, task.title);
        rv.setTextViewText(R.id.task_weight, String.valueOf(task.weight));
        rv.setTextColor(R.id.task_weight, Color.parseColor("#555577"));

        return rv;
    }

    @Override
    public RemoteViews getLoadingView() {
        return null; // use system default
    }

    @Override
    public int getViewTypeCount() {
        return 1;
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public boolean hasStableIds() {
        return false;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void loadTasks() {
        tasks.clear();
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_TASKS, "[]");
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                tasks.add(new TaskItem(
                    obj.optBoolean("done", false),
                    obj.optString("title", ""),
                    obj.optInt("weight", 0)
                ));
            }
        } catch (Exception ignored) {}
    }

    static class TaskItem {
        final boolean done;
        final String  title;
        final int     weight;

        TaskItem(boolean done, String title, int weight) {
            this.done   = done;
            this.title  = title;
            this.weight = weight;
        }
    }
}
