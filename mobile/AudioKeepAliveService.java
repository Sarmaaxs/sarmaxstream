package com.sarmaxstream.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service that runs while music plays. It shows the "playing" notification and keeps the
 * process (and the web view with the music) from being frozen or killed when the app is in the
 * background or the screen is off. It stops as soon as the music stops.
 */
public class AudioKeepAliveService extends Service {
  static volatile AudioKeepAliveService instance;
  private static final String CHANNEL = "sx_playback";
  private PowerManager.WakeLock wakeLock;

  @Override
  public void onCreate() {
    super.onCreate();
    instance = this;
    try {
      PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
      if (pm != null) {
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "sarmaxstream:audio");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire(6L * 60 * 60 * 1000); // safety limit: 6 hours
      }
    } catch (Exception ignored) { }
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String title = intent != null ? intent.getStringExtra("title") : null;
    String artist = intent != null ? intent.getStringExtra("artist") : null;
    show(title, artist);
    return START_NOT_STICKY;
  }

  void show(String title, String artist) {
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationChannel ch = new NotificationChannel(CHANNEL, "Music playing", NotificationManager.IMPORTANCE_LOW);
      ch.setShowBadge(false);
      NotificationManager nm = getSystemService(NotificationManager.class);
      if (nm != null) nm.createNotificationChannel(ch);
    }
    Intent open = new Intent(this, MainActivity.class);
    open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    Notification n = new NotificationCompat.Builder(this, CHANNEL)
        .setSmallIcon(android.R.drawable.ic_media_play)
        .setContentTitle(title != null && !title.isEmpty() ? title : "Sarmaxstream")
        .setContentText(artist != null && !artist.isEmpty() ? artist : "Playing in the background")
        .setContentIntent(pi)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .build();
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
    } else {
      startForeground(1, n);
    }
  }

  @Override
  public void onDestroy() {
    instance = null;
    try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) { }
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) { return null; }
}
