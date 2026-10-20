package com.sarmaxstream.app;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Keeps people inside the app.
 *
 * Embedded video players love to open pop-up tabs or redirect the whole page. Normally the Android
 * app hands those to Chrome. Here the app swallows them: the player thinks its pop-up was sent,
 * and nothing happens. Only our own site (and plain mailto:/tel: links) may navigate the app.
 *
 * This file is copied over the generated MainActivity by .github/workflows/build-apk.yml.
 */
public class MainActivity extends BridgeActivity {
  private static final String[] OWN_HOSTS = { "sarmaxstreams.vercel.app", "localhost" };

  private static boolean isOwn(String host) {
    if (host == null) return true; // mailto:, tel:, blob:, about:blank ... not a website
    for (String h : OWN_HOSTS) {
      if (host.equals(h) || host.endsWith("." + h)) return true;
    }
    return false;
  }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    final WebView web = getBridge().getWebView();
    final WebSettings s = web.getSettings();
    s.setSupportMultipleWindows(false);          // window.open() can never create a new window
    s.setJavaScriptCanOpenWindowsAutomatically(false); // no pop-ups without a tap

    web.setWebViewClient(new BridgeWebViewClient(getBridge()) {
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri u = request.getUrl();
        String scheme = u.getScheme();
        boolean web = "http".equals(scheme) || "https".equals(scheme);
        if (web && request.isForMainFrame() && !isOwn(u.getHost())) {
          return true; // swallow: do nothing (no Chrome, no new tab)
        }
        return super.shouldOverrideUrlLoading(view, request);
      }

      @Override
      @SuppressWarnings("deprecation")
      public boolean shouldOverrideUrlLoading(WebView view, String url) {
        Uri u = Uri.parse(url);
        String scheme = u.getScheme();
        boolean web = "http".equals(scheme) || "https".equals(scheme);
        if (web && !isOwn(u.getHost())) return true;
        return super.shouldOverrideUrlLoading(view, url);
      }
    });
  }
}
