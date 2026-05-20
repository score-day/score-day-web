package com.scoreday.app;

import android.content.Intent;
import android.widget.RemoteViewsService;

public class ScoreDayWidgetService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new ScoreDayTaskFactory(getApplicationContext());
    }
}
