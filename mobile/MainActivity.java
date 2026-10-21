package com.sarmaxstream.app;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.RequiresApi;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Makes the app behave like a real native app. This file is copied over the generated
 * MainActivity by .github/workflows/build-apk.yml.
 *
 *  1. POP-UP SHIELD      pop-ups / outside redirects from video players are swallowed (never reach Chrome)
 *  2. BACK BUTTON        asks the page what to do; on Home it sends the app to the background, never closes it
 *  3. BACKGROUND AUDIO   while music plays a foreground service keeps the app (and the sound) alive
 *  4. COMES BACK         remembers the last page and reopens it after hours; recovers if Android killed the web view
 */
public class MainActivity extends BridgeActivity {
  private static final String[] OWN_HOSTS = { "sarmaxstreams.vercel.app", "localhost" };
  private static final long RESTORE_MAX_AGE = 7L * 24 * 60 * 60 * 1000;

  private volatile boolean keepAlive = false;
  private String restoreUrl = null;
  private boolean restoreDone = false;

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

  /** The web page calls this (window.SxNative.setPlaying) when music starts or stops. */
  private class SxNative {
    @JavascriptInterface
    public void setPlaying(boolean playing, String title, String artist) {
      keepAlive = playing;
      try {
        if (playing) {
          if (AudioKeepAliveService.instance != null) {
            AudioKeepAliveService.instance.show(title, artist);
          } else {
            Intent i = new Intent(MainActivity.this, AudioKeepAliveService.class);
            i.putExtra("title", title);
            i.putExtra("artist", artist);
            ContextCompat.startForegroundService(MainActivity.this, i);
          }
        } else {
          stopService(new Intent(MainActivity.this, AudioKeepAliveService.class));
        }
      } catch (Exception ignored) { /* never crash because of a notification */ }
    }
  }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    final WebView webView = getBridge().getWebView();
    final WebSettings settings = webView.getSettings();
    settings.setSupportMultipleWindows(false);               // window.open() can never create a window
    settings.setJavaScriptCanOpenWindowsAutomatically(false); // no pop-ups without a tap
    settings.setMediaPlaybackRequiresUserGesture(false);      // lets the next song start in the background

    // where did the person stop last time?
    try {
      SharedPreferences sp = getSharedPreferences("sx_state", MODE_PRIVATE);
      String u = sp.getString("url", null);
      long t = sp.getLong("t", 0);
      if (u != null && System.currentTimeMillis() - t < RESTORE_MAX_AGE && isOwnUrl(u) && !isRoot(u)) restoreUrl = u;
    } catch (Exception ignored) { }

    webView.addJavascriptInterface(new SxNative(), "SxNative");

    webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri u = request.getUrl();
        String scheme = u.getScheme();
        boolean isHttp = "http".equals(scheme) || "https".equals(scheme);
        if (isHttp && request.isForMainFrame() && !isOwnHost(u.getHost())) {
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
        if (isHttp && !isOwnHost(u.getHost())) return true;
        return super.shouldOverrideUrlLoading(view, url);
      }

      @Override
      public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
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
  }

  private void saveState() {
    try {
      String u = getBridge().getWebView().getUrl();
      if (u != null && isOwnUrl(u) && !u.contains("/login") && !u.contains("/register") && !u.contains("/reset-password")) {
        getSharedPreferences("sx_state", MODE_PRIVATE).edit().putString("url", u).putLong("t", System.currentTimeMillis()).apply();
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
  public void onPause() {
    super.onPause();
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
