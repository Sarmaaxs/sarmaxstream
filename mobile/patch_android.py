"""Edits the generated Android project: permissions, music service, widget, app-icon shortcuts.
Run from the `mobile` folder after `npx cap add android` (see .github/workflows/build-apk.yml)."""
import os
import re
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "android"
HOST = "https://sarmaxstreams.vercel.app"
PKG = "com.sarmaxstream.app"
res = os.path.join(root, "app/src/main/res")


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w").write(text)


# ------------------------------------------------------------------ manifest
manifest_path = os.path.join(root, "app/src/main/AndroidManifest.xml")
s = open(manifest_path).read()

perms = ["android.permission.FOREGROUND_SERVICE", "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
         "android.permission.POST_NOTIFICATIONS", "android.permission.WAKE_LOCK", "android.permission.USE_BIOMETRIC"]
add = "".join('    <uses-permission android:name="%s" />\n' % p for p in perms if p not in s)
s = s.replace("<application", add + "    <application", 1)

if "AudioKeepAliveService" not in s:
    svc = '        <service android:name=".AudioKeepAliveService" android:exported="false" android:foregroundServiceType="mediaPlayback" />\n'
    s = s.replace("</application>", svc + "    </application>", 1)

if "SxWidgetProvider" not in s:
    rcv = (
        '        <receiver android:name=".SxWidgetProvider" android:exported="false">\n'
        '            <intent-filter>\n'
        '                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />\n'
        '            </intent-filter>\n'
        '            <meta-data android:name="android.appwidget.provider" android:resource="@xml/sx_widget_info" />\n'
        '        </receiver>\n'
    )
    s = s.replace("</application>", rcv + "    </application>", 1)

if "android.app.shortcuts" not in s:
    meta = '        <meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts" />\n'
    s = s.replace("</activity>", meta + "    </activity>", 1)
open(manifest_path, "w").write(s)

# ------------------------------------------------------------------ shortcuts (long-press the icon)
shortcuts = [("music", "sx_sc_music", "Music", "/music"), ("search", "sx_sc_search", "Search", "/search"),
             ("books", "sx_sc_books", "Books", "/books"), ("anime", "sx_sc_anime", "Anime", "/anime")]
items = ""
for sid, rid, _label, path in shortcuts:
    items += (
        '  <shortcut android:shortcutId="%s" android:enabled="true" android:icon="@mipmap/ic_launcher" '
        'android:shortcutShortLabel="@string/%s">\n'
        '    <intent android:action="android.intent.action.VIEW" android:targetPackage="%s" '
        'android:targetClass="%s.MainActivity" android:data="%s%s" />\n'
        '  </shortcut>\n' % (sid, rid, PKG, PKG, HOST, path)
    )
write(os.path.join(res, "xml/shortcuts.xml"),
      '<?xml version="1.0" encoding="utf-8"?>\n'
      '<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">\n' + items + "</shortcuts>\n")

# ------------------------------------------------------------------ home-screen widget
write(os.path.join(res, "xml/sx_widget_info.xml"),
      '<?xml version="1.0" encoding="utf-8"?>\n'
      '<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"\n'
      '    android:minWidth="250dp" android:minHeight="110dp"\n'
      '    android:targetCellWidth="4" android:targetCellHeight="2"\n'
      '    android:updatePeriodMillis="0" android:initialLayout="@layout/sx_widget"\n'
      '    android:resizeMode="horizontal|vertical" android:widgetCategory="home_screen"\n'
      '    android:description="@string/sx_widget_desc" />\n')
write(os.path.join(res, "drawable/sx_widget_bg.xml"),
      '<?xml version="1.0" encoding="utf-8"?>\n'
      '<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n'
      '    <solid android:color="#F20B0B0D" />\n'
      '    <corners android:radius="22dp" />\n'
      '</shape>\n')
write(os.path.join(res, "drawable/sx_widget_btn.xml"),
      '<?xml version="1.0" encoding="utf-8"?>\n'
      '<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n'
      '    <solid android:color="#26FFFFFF" />\n'
      '    <corners android:radius="14dp" />\n'
      '</shape>\n')


def btn(bid, text, last=False):
    return (
        '        <TextView android:id="@+id/%s" android:layout_width="0dp" android:layout_height="40dp" '
        'android:layout_weight="1" android:layout_marginEnd="%s" android:gravity="center" '
        'android:background="@drawable/sx_widget_btn" android:text="%s" android:textColor="#FFFFFF" '
        'android:textSize="13sp" android:textStyle="bold" android:clickable="true" />\n' % (bid, "0dp" if last else "6dp", text)
    )


write(os.path.join(res, "layout/sx_widget.xml"),
      '<?xml version="1.0" encoding="utf-8"?>\n'
      '<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"\n'
      '    android:layout_width="match_parent" android:layout_height="match_parent"\n'
      '    android:orientation="vertical" android:padding="14dp" android:background="@drawable/sx_widget_bg">\n'
      '    <TextView android:layout_width="wrap_content" android:layout_height="wrap_content" '
      'android:text="Sarmaxstream" android:textColor="#D4FF1A" android:textSize="14sp" android:textStyle="bold" />\n'
      '    <TextView android:id="@+id/sx_np" android:layout_width="match_parent" android:layout_height="wrap_content" '
      'android:layout_marginTop="2dp" android:layout_marginBottom="10dp" android:maxLines="1" android:ellipsize="end" '
      'android:text="Nothing playing" android:textColor="#CCFFFFFF" android:textSize="13sp" />\n'
      '    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal">\n'
      + btn("sx_btn_music", "Music") + btn("sx_btn_search", "Search") + btn("sx_btn_books", "Books") + btn("sx_btn_anime", "Anime", True) +
      '    </LinearLayout>\n'
      '</LinearLayout>\n')

# ------------------------------------------------------------------ strings
strings_path = os.path.join(res, "values/strings.xml")
st = open(strings_path).read()
wanted = [(rid, label) for _sid, rid, label, _p in shortcuts] + [("sx_widget_desc", "Quick buttons and what is playing")]
extra = "".join('    <string name="%s">%s</string>\n' % (rid, label) for rid, label in wanted if rid not in st)
st = re.sub(r"</resources>", extra + "</resources>", st, count=1)
open(strings_path, "w").write(st)
print("patched:", manifest_path)
