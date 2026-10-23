package com.sarmaxstream.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Foreground service that runs while music plays.
 *  - "now playing" notification with cover art and Previous / Play-Pause / Next buttons
 *  - a media session, so the lock screen and the notification show a seek bar and headset buttons work
 *  - keeps the process (and the web view with the music) from being frozen when the screen is off
 */
public class AudioKeepAliveService extends Service {
  static volatile AudioKeepAliveService instance;
  private static final String CHANNEL = "sx_playback";
  private static final String ACT_PREV = "sx.prev";
  private static final String ACT_TOGGLE = "sx.toggle";
  private static final String ACT_NEXT = "sx.next";

  private final Handler main = new Handler(Looper.getMainLooper());
  private PowerManager.WakeLock wakeLock;
  private MediaSession session;
  private String title = "";
  private String artist = "";
  private String artRequested = "";
  private Bitmap art;
  private boolean playing = true;
  private long durMs = 0;
  private long posMs = 0;

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
    try {
      session = new MediaSession(this, "sarmaxstream");
      session.setCallback(new MediaSession.Callback() {
        @Override public void onPlay() { MainActivity.callJs("window.__sxMedia && window.__sxMedia('play')"); }
        @Override public void onPause() { MainActivity.callJs("window.__sxMedia && window.__sxMedia('pause')"); }
        @Override public void onSkipToNext() { MainActivity.callJs("window.__sxMedia && window.__sxMedia('next')"); }
        @Override public void onSkipToPrevious() { MainActivity.callJs("window.__sxMedia && window.__sxMedia('prev')"); }
        @Override public void onSeekTo(long pos) {
          MainActivity.callJs("window.__sxMedia && window.__sxMedia('seek:" + (pos / 1000.0) + "')");
        }
      });
      session.setActive(true);
    } catch (Exception e) {
      session = null;
    }
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String action = intent != null ? intent.getAction() : null;
    if (action != null) {
      // a button of the notification was pressed: pass it to the web page
      String cmd = ACT_PREV.equals(action) ? "prev" : ACT_NEXT.equals(action) ? "next" : "toggle";
      MainActivity.callJs("window.__sxMedia && window.__sxMedia('" + cmd + "')");
      return START_NOT_STICKY;
    }
    if (intent != null) {
      update(intent.getStringExtra("title"), intent.getStringExtra("artist"), intent.getStringExtra("art"),
          intent.getBooleanExtra("playing", true), intent.getLongExtra("dur", 0), intent.getLongExtra("pos", 0));
    } else {
      update("", "", "", true, 0, 0);
    }
    return START_NOT_STICKY;
  }

  /** Called from the web page (through MainActivity) whenever the song, play state or position changes. */
  void update(final String t, final String a, final String artUrl, final boolean isPlaying, final long dur, final long pos) {
    main.post(new Runnable() {
      @Override public void run() {
        title = t != null ? t : "";
        artist = a != null ? a : "";
        playing = isPlaying;
        durMs = Math.max(0, dur);
        posMs = Math.max(0, pos);
        loadArt(artUrl);
        publish();
      }
    });
  }

  private void loadArt(final String url) {
    if (url == null || url.isEmpty()) { artRequested = ""; art = null; return; }
    if (url.equals(artRequested)) return;
    if (!url.startsWith("https://")) return;
    artRequested = url;
    art = null;
    new Thread(new Runnable() {
      @Override public void run() {
        Bitmap b = null;
        try {
          HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
          c.setConnectTimeout(6000);
          c.setReadTimeout(8000);
          InputStream in = c.getInputStream();
          b = BitmapFactory.decodeStream(in);
          in.close();
          if (b != null && (b.getWidth() > 600 || b.getHeight() > 600)) {
            float k = 600f / Math.max(b.getWidth(), b.getHeight());
            b = Bitmap.createScaledBitmap(b, Math.max(1, Math.round(b.getWidth() * k)), Math.max(1, Math.round(b.getHeight() * k)), true);
          }
        } catch (Exception ignored) { }
        final Bitmap fb = b;
        if (fb != null) {
          main.post(new Runnable() {
            @Override public void run() {
              if (url.equals(artRequested)) { art = fb; publish(); }
            }
          });
        }
      }
    }).start();
  }

  private PendingIntent button(String action, int code) {
    Intent i = new Intent(this, AudioKeepAliveService.class);
    i.setAction(action);
    return PendingIntent.getService(this, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  @SuppressWarnings("deprecation")
  private void publish() {
    // lock screen / system media controls (cover, title, seek bar)
    if (session != null) {
      try {
        MediaMetadata.Builder mb = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, durMs);
        if (art != null) mb.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, art);
        session.setMetadata(mb.build());
        long actions = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SEEK_TO;
        session.setPlaybackState(new PlaybackState.Builder()
            .setActions(actions)
            .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, posMs, playing ? 1f : 0f)
            .build());
      } catch (Exception ignored) { }
    }

    if (Build.VERSION.SDK_INT >= 26) {
      NotificationChannel ch = new NotificationChannel(CHANNEL, "Music playing", NotificationManager.IMPORTANCE_LOW);
      ch.setShowBadge(false);
      NotificationManager nm = getSystemService(NotificationManager.class);
      if (nm != null) nm.createNotificationChannel(ch);
    }
    Intent open = new Intent(this, MainActivity.class);
    open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    Notification.Builder b = Build.VERSION.SDK_INT >= 26
        ? new Notification.Builder(this, CHANNEL)
        : new Notification.Builder(this);
    b.setSmallIcon(android.R.drawable.ic_media_play)
        .setContentTitle(!title.isEmpty() ? title : "Sarmaxstream")
        .setContentText(!artist.isEmpty() ? artist : "Playing in the background")
        .setContentIntent(pi)
        .setOngoing(playing)
        .setOnlyAlertOnce(true)
        .setCategory(Notification.CATEGORY_TRANSPORT)
        .setVisibility(Notification.VISIBILITY_PUBLIC)
        .addAction(android.R.drawable.ic_media_previous, "Previous", button(ACT_PREV, 1))
        .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
            playing ? "Pause" : "Play", button(ACT_TOGGLE, 2))
        .addAction(android.R.drawable.ic_media_next, "Next", button(ACT_NEXT, 3));
    if (art != null) b.setLargeIcon(art);
    Notification.MediaStyle style = new Notification.MediaStyle().setShowActionsInCompactView(0, 1, 2);
    if (session != null) style.setMediaSession(session.getSessionToken());
    b.setStyle(style);
    Notification n = b.build();

    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
    } else {
      startForeground(1, n);
    }
  }

  @Override
  public void onDestroy() {
    instance = null;
    try { if (session != null) { session.setActive(false); session.release(); } } catch (Exception ignored) { }
    try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) { }
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) { return null; }
}
