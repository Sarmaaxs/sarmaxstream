"""Edits the generated Android project: permissions, the music service, and app-icon shortcuts.
Run from the `mobile` folder after `npx cap add android` (see .github/workflows/build-apk.yml)."""
import os
import re
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "android"
HOST = "https://sarmaxstreams.vercel.app"
PKG = "com.sarmaxstream.app"

manifest_path = os.path.join(root, "app/src/main/AndroidManifest.xml")
s = open(manifest_path).read()

# permissions
perms = ["android.permission.FOREGROUND_SERVICE", "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
         "android.permission.POST_NOTIFICATIONS", "android.permission.WAKE_LOCK"]
add = "".join('    <uses-permission android:name="%s" />\n' % p for p in perms if p not in s)
s = s.replace("<application", add + "    <application", 1)

# music service
if "AudioKeepAliveService" not in s:
    svc = '        <service android:name=".AudioKeepAliveService" android:exported="false" android:foregroundServiceType="mediaPlayback" />\n'
    s = s.replace("</application>", svc + "    </application>", 1)

# app-icon shortcuts (long-press the icon)
if "android.app.shortcuts" not in s:
    meta = '        <meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts" />\n'
    s = s.replace("</activity>", meta + "    </activity>", 1)
open(manifest_path, "w").write(s)

shortcuts = [("music", "sx_sc_music", "Music", "/music"), ("search", "sx_sc_search", "Search", "/search"),
             ("books", "sx_sc_books", "Books", "/books"), ("anime", "sx_sc_anime", "Anime", "/anime")]

xml_dir = os.path.join(root, "app/src/main/res/xml")
os.makedirs(xml_dir, exist_ok=True)
items = ""
for sid, res, _label, path in shortcuts:
    items += (
        '  <shortcut android:shortcutId="%s" android:enabled="true" android:icon="@mipmap/ic_launcher" '
        'android:shortcutShortLabel="@string/%s">\n'
        '    <intent android:action="android.intent.action.VIEW" android:targetPackage="%s" '
        'android:targetClass="%s.MainActivity" android:data="%s%s" />\n'
        '  </shortcut>\n' % (sid, res, PKG, PKG, HOST, path)
    )
open(os.path.join(xml_dir, "shortcuts.xml"), "w").write(
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">\n' + items + "</shortcuts>\n"
)

strings_path = os.path.join(root, "app/src/main/res/values/strings.xml")
st = open(strings_path).read()
extra = "".join('    <string name="%s">%s</string>\n' % (res, label) for _sid, res, label, _p in shortcuts if res not in st)
st = re.sub(r"</resources>", extra + "</resources>", st, count=1)
open(strings_path, "w").write(st)
print("patched:", manifest_path)
