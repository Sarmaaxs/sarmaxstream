package com.sarmaxstream.app;

import android.Manifest;
import android.app.KeyguardManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.RequiresApi;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.HashMap;

/**
 * Makes the app behave like a real native app. This file is copied over the generated
 * MainActivity by .github/workflows/build-apk.yml.
 *
 *  1. POP-UP SHIELD      pop-ups / outside redirects from video players are swallowed (never reach Chrome)
 *  2. BACK BUTTON        asks the page what to do; on Home it sends the app to the background, never closes it
 *  3. BACKGROUND AUDIO   while music plays a foreground service keeps the app (and the sound) alive
 *  4. COMES BACK         remembers the last page and reopens it after hours; recovers if Android killed the web view
 *  5. NOTIFICATION       cover art, Previous / Pause / Next and a seek bar (see AudioKeepAliveService)
 *  6. VIDEO              real full-screen (landscape) for video players, and the screen stays on while watching
 *  7. SHORTCUTS + WIDGET long-press the app icon, or add the home-screen widget
 *  8. REAL FILES         music and books can be saved to the phone's Music / Download folders
 *  9. APP LOCK           optional fingerprint / screen-lock when the app is opened
 * 10. SHARE              the Android share sheet
 */
public class MainActivity extends BridgeActivity {
  private static final String[] OWN_HOSTS = { "sarmaxstreams.vercel.app", "localhost" };
  // Per-launch secret for the JS bridge. Only our own pages receive it (see onPageFinished),
  // so a third-party video iframe that finds the raw bridge still cannot call anything on it.
  private static final String BRIDGE_TOKEN = newBridgeToken();

  private static String newBridgeToken() {
    byte[] b = new byte[16];
    new java.security.SecureRandom().nextBytes(b);
    StringBuilder sb = new StringBuilder();
    for (byte x : b) sb.append(String.format("%02x", x));
    return sb.toString();
  }

  private static boolean tokOk(String t) {
    return t != null && java.security.MessageDigest.isEqual(BRIDGE_TOKEN.getBytes(), t.getBytes());
  }

  // Ad scripts love intent: / market: links that jump out to Play Store or another app.
  private static boolean isBlockedScheme(String s) {
    if (s == null) return false;
    s = s.toLowerCase(java.util.Locale.ROOT);
    return "intent".equals(s) || "market".equals(s) || "android-app".equals(s);
  }

  // The only outside links we open on purpose (a real tap on the Telegram support link).
  private static boolean isOpenExternally(String host) {
    return "t.me".equals(host) || "telegram.me".equals(host);
  }

  private void openExternal(Uri u) {
    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
  }

  private static final long RESTORE_MAX_AGE = 7L * 24 * 60 * 60 * 1000;
  private static final long LOCK_AFTER_MS = 30L * 1000;
  private static final int REQ_UNLOCK = 4711;

  static volatile MainActivity current;
  private volatile boolean keepAlive = false;
  private String pendingIntentUrl = null;
  private View customView = null;
  private WebChromeClient.CustomViewCallback customCallback = null;
  private String restoreUrl = null;
  private boolean restoreDone = false;

  // app lock
  private View lockView = null;
  private boolean authInProgress = false;
  private long pausedAt = 0;

  // files being written for the web page
  private static class SxFile {
    OutputStream os;
    Uri uri;
    String label = "";
  }
  private final HashMap<Integer, SxFile> openFiles = new HashMap<Integer, SxFile>();
  private int nextFileId = 1;

  private static boolean isOwnHost(String host) {
    if (host == null) return true; // mailto:, tel:, blob:, about:blank ... not a website
    for (String h : OWN_HOSTS) {
      if (host.equals(h) || host.endsWith("." + h)) return true;
    }
    return false;
  }

  private static boolean isOwnUrl(String url) {
    try {
      Uri u = Uri.parse(url);
      String s = u.getScheme();
      return ("https".equals(s) || "http".equals(s)) && isOwnHost(u.getHost());
    } catch (Exception e) { return false; }
  }

  private static boolean isRoot(String url) {
    try {
      String p = Uri.parse(url).getPath();
      return p == null || p.isEmpty() || "/".equals(p);
    } catch (Exception e) { return true; }
  }

  /** Runs a piece of JavaScript in the web page (used by the notification buttons). */
  static void callJs(final String js) {
    final MainActivity a = current;
    if (a == null) return;
    a.runOnUiThread(new Runnable() {
      @Override public void run() {
        try { a.getBridge().getWebView().evaluateJavascript(js, null); } catch (Exception ignored) { }
      }
    });
  }

  private SharedPreferences prefs() { return getSharedPreferences("sx_state", MODE_PRIVATE); }

  // ---------------------------------------------------------------- full-screen video

  private void sxShowCustom(View view, WebChromeClient.CustomViewCallback cb) {
    if (customView != null) { cb.onCustomViewHidden(); return; }
    customView = view;
    customCallback = cb;
    ((ViewGroup) getWindow().getDecorView()).addView(view,
        new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    getWindow().getDecorView().setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
  }

  private void sxHideCustom() {
    if (customView == null) return;
    ((ViewGroup) getWindow().getDecorView()).removeView(customView);
    customView = null;
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
    if (customCallback != null) {
      try { customCallback.onCustomViewHidden(); } catch (Exception ignored) { }
      customCallback = null;
    }
  }

  // ---------------------------------------------------------------- app lock

  private boolean lockEnabled() { return prefs().getBoolean("applock", false); }

  private boolean deviceSecure() {
    try {
      KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
      return km != null && km.isDeviceSecure();
    } catch (Exception e) { return false; }
  }

  private void sxShowLock() {
    if (lockView != null) return;
    FrameLayout f = new FrameLayout(this);
    f.setBackgroundColor(Color.parseColor("#0B0B0D"));
    f.setClickable(true); // swallow all touches
    LinearLayout box = new LinearLayout(this);
    box.setOrientation(LinearLayout.VERTICAL);
    box.setGravity(Gravity.CENTER);
    TextView t = new TextView(this);
    t.setText("Sarmaxstream is locked");
    t.setTextColor(Color.WHITE);
    t.setTextSize(18f);
    t.setGravity(Gravity.CENTER);
    t.setPadding(0, 0, 0, 32);
    Button b = new Button(this);
    b.setText("Unlock");
    b.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View v) { sxAuthenticate(); }
    });
    box.addView(t);
    box.addView(b);
    f.addView(box, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER));
    ((ViewGroup) getWindow().getDecorView()).addView(f,
        new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    lockView = f;
    sxAuthenticate();
  }

  private void sxUnlock() {
    authInProgress = false;
    pausedAt = 0;
    if (lockView != null) {
      try { ((ViewGroup) getWindow().getDecorView()).removeView(lockView); } catch (Exception ignored) { }
      lockView = null;
    }
  }

  private void sxAuthenticate() {
    if (authInProgress) return;
    if (!deviceSecure()) { sxUnlock(); return; } // no screen lock set on the phone: nothing to ask
    authInProgress = true;
    try {
      if (Build.VERSION.SDK_INT >= 30) {
        BiometricPrompt prompt = new BiometricPrompt.Builder(this)
            .setTitle("Unlock Sarmaxstream")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
            .build();
        prompt.authenticate(new CancellationSignal(), getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
          @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) { sxUnlock(); }
          @Override public void onAuthenticationError(int code, CharSequence msg) { authInProgress = false; }
        });
      } else {
        KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        Intent i = km != null ? km.createConfirmDeviceCredentialIntent("Unlock Sarmaxstream", null) : null;
        if (i == null) { sxUnlock(); return; }
        startActivityForResult(i, REQ_UNLOCK);
      }
    } catch (Exception e) {
      authInProgress = false;
    }
  }

  @Override
  public void onActivityResult(int requestCode, int resultCode, Intent data) {
    if (requestCode == REQ_UNLOCK) {
      authInProgress = false;
      if (resultCode == RESULT_OK) sxUnlock();
      return;
    }
    super.onActivityResult(requestCode, resultCode, data);
  }

  // ---------------------------------------------------------------- what the web page can call

  /** window.SxNative in the web page. */
  private class SxNative {
    @JavascriptInterface
    public void keepScreenOn(String tok, final boolean on) {
      if (!tokOk(tok)) return;
      MainActivity.this.runOnUiThread(new Runnable() {
        @Override public void run() {
          if (on) MainActivity.this.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
          else MainActivity.this.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
      });
    }

    /** Song, play state and position changed: update notification, lock screen and widget. */
    @JavascriptInterface
    public void setMedia(String tok, boolean isPlaying, String title, String artist, String art, long durMs, long posMs) {
      if (!tokOk(tok)) return;
      keepAlive = isPlaying;
      try {
        String np = (title == null ? "" : title) + (artist != null && !artist.isEmpty() ? " \u2014 " + artist : "");
        prefs().edit().putString("np", np).apply();
        SxWidgetProvider.refresh(MainActivity.this);
        AudioKeepAliveService svc = AudioKeepAliveService.instance;
        if (svc != null) {
          svc.update(title, artist, art, isPlaying, durMs, posMs);
        } else if (isPlaying) {
          Intent i = new Intent(MainActivity.this, AudioKeepAliveService.class);
          i.putExtra("title", title);
          i.putExtra("artist", artist);
          i.putExtra("art", art);
          i.putExtra("playing", true);
          i.putExtra("dur", durMs);
          i.putExtra("pos", posMs);
          ContextCompat.startForegroundService(MainActivity.this, i);
        }
      } catch (Exception ignored) { /* never crash because of a notification */ }
    }

    /** Older web versions: only play / stop. */
    @JavascriptInterface
    public void setPlaying(String tok, boolean playing, String title, String artist) {
      if (!tokOk(tok)) return;
      keepAlive = playing;
      try {
        if (playing) {
          setMedia(tok, true, title, artist, "", 0, 0);
        } else {
          stopService(new Intent(MainActivity.this, AudioKeepAliveService.class));
        }
      } catch (Exception ignored) { }
    }

    // ----- saving real files (Music / Download folders) -----

    @JavascriptInterface
    public synchronized int beginFile(String tok, String name, String mime, String kind) {
      if (!tokOk(tok)) return -1;
      try {
        String safe = (name == null || name.isEmpty() ? "file" : name).replaceAll("[\\\\/:*?\"<>|]", "_");
        SxFile f = new SxFile();
        if (Build.VERSION.SDK_INT >= 29) {
          ContentResolver cr = getContentResolver();
          ContentValues v = new ContentValues();
          v.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
          v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
          Uri collection;
          if ("music".equals(kind)) {
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, "Music/Sarmaxstream");
            collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
            f.label = "Music/Sarmaxstream";
          } else {
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, "Download/Sarmaxstream");
            collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            f.label = "Download/Sarmaxstream";
          }
          v.put(MediaStore.MediaColumns.IS_PENDING, 1);
          Uri uri = cr.insert(collection, v);
          if (uri == null) return -1;
          f.uri = uri;
          f.os = cr.openOutputStream(uri);
        } else {
          File dir = new File(getExternalFilesDir(null), "Sarmaxstream");
          dir.mkdirs();
          f.os = new FileOutputStream(new File(dir, safe));
          f.label = "Android/data/" + getPackageName() + "/files/Sarmaxstream";
        }
        if (f.os == null) return -1;
        int id = nextFileId++;
        openFiles.put(id, f);
        return id;
      } catch (Exception e) {
        return -1;
      }
    }

    @JavascriptInterface
    public synchronized boolean appendFile(String tok, int id, String base64) {
      if (!tokOk(tok)) return false;
      SxFile f = openFiles.get(id);
      if (f == null) return false;
      try {
        f.os.write(Base64.decode(base64, Base64.DEFAULT));
        return true;
      } catch (Exception e) {
        return false;
      }
    }

    /** Finishes the file. Returns the folder it was saved in, or "" if it failed. */
    @JavascriptInterface
    public synchronized String endFile(String tok, int id, boolean ok) {
      if (!tokOk(tok)) return "";
      SxFile f = openFiles.remove(id);
      if (f == null) return "";
      try { f.os.close(); } catch (Exception ignored) { ok = false; }
      try {
        if (f.uri != null) {
          ContentResolver cr = getContentResolver();
          if (ok) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.IS_PENDING, 0);
            cr.update(f.uri, v, null, null);
          } else {
            cr.delete(f.uri, null, null);
          }
        }
      } catch (Exception ignored) { }
      return ok ? f.label : "";
    }

    // ----- app lock -----

    @JavascriptInterface
    public boolean setAppLock(String tok, final boolean on) {
      if (!tokOk(tok)) return false;
      if (on && !deviceSecure()) return false; // the phone has no PIN / pattern / fingerprint yet
      prefs().edit().putBoolean("applock", on).apply();
      MainActivity.this.runOnUiThread(new Runnable() {
        @Override public void run() {
          if (on) MainActivity.this.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE); // blank in recent apps
          else MainActivity.this.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
      });
      return true;
    }

    @JavascriptInterface
    public boolean isAppLockEnabled(String tok) {
      if (!tokOk(tok)) return false; return lockEnabled(); }

    // ----- share sheet -----

    @JavascriptInterface
    public void share(String tok, final String text) {
      if (!tokOk(tok)) return;
      MainActivity.this.runOnUiThread(new Runnable() {
        @Override public void run() {
          try {
            Intent s = new Intent(Intent.ACTION_SEND);
            s.setType("text/plain");
            s.putExtra(Intent.EXTRA_TEXT, text);
            MainActivity.this.startActivity(Intent.createChooser(s, "Share"));
          } catch (Exception ignored) { }
        }
      });
    }
  }

  // ---------------------------------------------------------------- lifecycle

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    current = this;

    final WebView webView = getBridge().getWebView();
    final WebSettings settings = webView.getSettings();
    settings.setSupportMultipleWindows(false);               // window.open() can never create a window
    settings.setJavaScriptCanOpenWindowsAutomatically(false); // no pop-ups without a tap
    settings.setMediaPlaybackRequiresUserGesture(false);      // lets the next song start in the background

    // where did the person stop last time?
    try {
      String u = prefs().getString("url", null);
      long t = prefs().getLong("t", 0);
      if (u != null && System.currentTimeMillis() - t < RESTORE_MAX_AGE && isOwnUrl(u) && !isRoot(u)) restoreUrl = u;
    } catch (Exception ignored) { }

    // opened from an app-icon shortcut or the widget?
    try {
      Uri d = getIntent() != null ? getIntent().getData() : null;
      if (d != null && isOwnUrl(d.toString())) pendingIntentUrl = d.toString();
    } catch (Exception ignored) { }

    webView.addJavascriptInterface(new SxNative(), "SxRaw"); // wrapped by src/lib/nativeBridge.js

    // real full-screen for video players (the default web view cannot do it)
    webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
      @Override
      public void onShowCustomView(View view, WebChromeClient.CustomViewCallback callback) { sxShowCustom(view, callback); }

      @Override
      public void onHideCustomView() { sxHideCustom(); }
    });

    webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri u = request.getUrl();
        String scheme = u.getScheme();
        boolean isHttp = "http".equals(scheme) || "https".equals(scheme);
        if (request.isForMainFrame() && isBlockedScheme(scheme)) return true;
        if (isHttp && request.isForMainFrame() && !isOwnHost(u.getHost())) {
          if (Build.VERSION.SDK_INT >= 24 && request.hasGesture() && isOpenExternally(u.getHost())) openExternal(u);
          return true; // swallow: do nothing (no Chrome, no new tab)
        }
        return super.shouldOverrideUrlLoading(view, request);
      }

      @Override
      @SuppressWarnings("deprecation")
      public boolean shouldOverrideUrlLoading(WebView view, String url) {
        Uri u = Uri.parse(url);
        String scheme = u.getScheme();
        boolean isHttp = "http".equals(scheme) || "https".equals(scheme);
        if (isBlockedScheme(scheme)) return true;
        if (isHttp && !isOwnHost(u.getHost())) return true;
        return super.shouldOverrideUrlLoading(view, url);
      }

      @Override
      public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        // hand the bridge token to OUR pages only (evaluateJavascript runs in the main frame, never in iframes)
        if (url != null && isOwnUrl(url)) view.evaluateJavascript("window.__sxTok='" + BRIDGE_TOKEN + "';", null);
        if (pendingIntentUrl != null && url != null && isOwnUrl(url)) {
          String target = pendingIntentUrl;
          pendingIntentUrl = null;
          restoreDone = true;
          view.loadUrl(target);
          return;
        }
        // Fallback: the page itself normally restores the last screen. If it is still on the start
        // page a moment later, open the saved page directly.
        if (restoreUrl != null && !restoreDone && url != null && isOwnUrl(url) && isRoot(url)) {
          restoreDone = true;
          final String target = restoreUrl;
          view.postDelayed(new Runnable() {
            @Override public void run() {
              String cur = view.getUrl();
              if (cur != null && isRoot(cur)) view.loadUrl(target);
            }
          }, 1500);
        }
      }

      @Override
      @RequiresApi(api = Build.VERSION_CODES.O)
      public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
        // Android reclaimed memory and killed the web view: rebuild it instead of crashing,
        // the last page is reopened by the code above.
        runOnUiThread(new Runnable() { @Override public void run() { recreate(); } });
        return true;
      }
    });

    // Back button: ask the page what to do.
    getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
      @Override
      public void handleOnBackPressed() {
        if (lockView != null) { moveTaskToBack(true); return; } // locked: never go "behind" the lock screen
        if (customView != null) { sxHideCustom(); return; }      // leave full-screen video first
        webView.evaluateJavascript("(function(){return window.__sxBack?window.__sxBack():'minimize'})()", value -> {
          if (value == null || value.contains("minimize") || value.contains("null")) moveTaskToBack(true);
        });
      }
    });

    // Android 13+: allow the "playing" notification to show
    if (Build.VERSION.SDK_INT >= 33
        && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 7);
    }

    // app lock: hide recent-apps preview and ask right away when the app starts
    if (lockEnabled()) {
      getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
      sxShowLock();
    }
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    try {
      Uri d = intent != null ? intent.getData() : null;
      if (d != null && isOwnUrl(d.toString())) getBridge().getWebView().loadUrl(d.toString());
    } catch (Exception ignored) { }
  }

  @Override
  public void onDestroy() {
    if (current == this) current = null;
    super.onDestroy();
  }

  private void saveState() {
    try {
      String u = getBridge().getWebView().getUrl();
      if (u != null && isOwnUrl(u) && !u.contains("/login") && !u.contains("/register") && !u.contains("/reset-password")) {
        prefs().edit().putString("url", u).putLong("t", System.currentTimeMillis()).apply();
      }
    } catch (Exception ignored) { }
  }

  /** While music plays, do not let Android freeze the web view when the screen turns off or the app is left. */
  private void keepWebViewAlive() {
    if (!keepAlive) return;
    try {
      WebView w = getBridge().getWebView();
      w.onResume();
      w.resumeTimers();
    } catch (Exception ignored) { }
  }

  @Override
  public void onResume() {
    super.onResume();
    if (lockEnabled() && lockView == null && !authInProgress && pausedAt > 0
        && System.currentTimeMillis() - pausedAt > LOCK_AFTER_MS) {
      sxShowLock();
    }
  }

  @Override
  public void onPause() {
    super.onPause();
    if (!authInProgress && lockView == null) pausedAt = System.currentTimeMillis();
    saveState();
    keepWebViewAlive();
  }

  @Override
  public void onStop() {
    super.onStop();
    saveState();
    keepWebViewAlive();
  }
}
