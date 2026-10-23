package com.sarmaxstream.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

/** Home-screen widget: shows what is playing and has quick buttons for Music, Search, Books and Anime. */
public class SxWidgetProvider extends AppWidgetProvider {
  private static final String HOST = "https://sarmaxstreams.vercel.app";

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
    for (int id : ids) manager.updateAppWidget(id, build(context));
  }

  static RemoteViews build(Context ctx) {
    RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.sx_widget);
    String np = "";
    try {
      SharedPreferences sp = ctx.getSharedPreferences("sx_state", Context.MODE_PRIVATE);
      np = sp.getString("np", "");
    } catch (Exception ignored) { }
    rv.setTextViewText(R.id.sx_np, np != null && !np.isEmpty() ? np : "Nothing playing");
    rv.setOnClickPendingIntent(R.id.sx_btn_music, link(ctx, "/music", 1));
    rv.setOnClickPendingIntent(R.id.sx_btn_search, link(ctx, "/search", 2));
    rv.setOnClickPendingIntent(R.id.sx_btn_books, link(ctx, "/books", 3));
    rv.setOnClickPendingIntent(R.id.sx_btn_anime, link(ctx, "/anime", 4));
    rv.setOnClickPendingIntent(R.id.sx_np, link(ctx, "/music", 5));
    return rv;
  }

  private static PendingIntent link(Context ctx, String path, int code) {
    Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(HOST + path));
    i.setClass(ctx, MainActivity.class);
    i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  /** Called by the app when the song changes. */
  static void refresh(Context ctx) {
    try {
      AppWidgetManager m = AppWidgetManager.getInstance(ctx);
      int[] ids = m.getAppWidgetIds(new ComponentName(ctx, SxWidgetProvider.class));
      for (int id : ids) m.updateAppWidget(id, build(ctx));
    } catch (Exception ignored) { }
  }
}
