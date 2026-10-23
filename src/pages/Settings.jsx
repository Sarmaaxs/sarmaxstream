import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSettings } from '@/lib/useSettings';
import { useAuth } from '@/lib/AuthContext';
import {
  usePrefs, setPref, ACCENTS, LANGUAGES,
  clearSearchHistory, clearRecentlyPlayed, clearCachedData, exportLocalData, resetEverythingLocal,
} from '@/lib/prefs';
import { toast } from '@/components/ui/use-toast';
import { isNative } from '@/lib/native';
import { canSaveToPhone } from '@/lib/nativeFiles';
import Navbar from '@/components/Navbar';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Volume2, Zap, GitMerge, Gauge, Bell, LogOut, LogIn, User, Activity, Moon,
  Palette, Type, Sparkles, Languages, History, Keyboard, Download, RotateCcw, Database, ShieldCheck, Check, Music4, Lock, Smartphone,
} from 'lucide-react';

function Row({ icon, title, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex items-start gap-3 min-w-0">
        <span className="text-primary mt-0.5">{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          {desc && <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="glass rounded-2xl p-5 md:p-6 scroll-mt-24">
      <div className="eyebrow text-primary mb-1">{title}</div>
      {children}
    </section>
  );
}

const NAV = [
  ...(isNative ? [['android', 'Android app']] : []),
  ['appearance', 'Appearance'],
  ['content', 'Content'],
  ['playback', 'Music'],
  ['notifications', 'Alerts'],
  ['privacy', 'Privacy & data'],
  ['account', 'Account'],
];

export default function Settings() {
  const { pathname } = useLocation();
  const standalone = !pathname.startsWith('/music'); // /music already renders its own navbar
  const {
    autoplay, setAutoplay, crossfade, setCrossfade, gapless, setGapless, quality, setQuality,
    notifications, setNotification, playbackSpeed, setPlaybackSpeed, normalization, setNormalization,
    sleepTimer, setSleepTimer,
  } = useSettings();
  const prefs = usePrefs();
  const { user, isAuthenticated, logout } = useAuth();

  const done = (title) => toast({ title });

  const confirmReset = () => {
    if (!window.confirm('Reset all settings and clear everything this app stores on this device? You will stay signed in.')) return;
    resetEverythingLocal();
    window.location.reload();
  };

  const body = (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Make Sarmaxstream yours. Changes apply instantly.</p>
      </div>

      <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {NAV.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            className="shrink-0 h-8 px-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Appearance */}
      <Section id="appearance" title="Appearance">
        <div className="divide-y divide-white/5">
          <div className="py-4">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-primary mt-0.5"><Palette size={18} /></span>
              <div>
                <div className="text-sm font-medium">Accent color</div>
                <div className="text-xs text-muted-foreground mt-0.5">Buttons, highlights and the progress bar.</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5 pl-[30px]" role="radiogroup" aria-label="Accent color">
              {Object.entries(ACCENTS).map(([key, a]) => {
                const active = prefs.accent === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={a.label}
                    title={a.label}
                    onClick={() => setPref('accent', key)}
                    className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-transform hover:scale-105 ${active ? 'border-white' : 'border-transparent'}`}
                    style={{ background: `hsl(${a.primary})`, color: `hsl(${a.fg})` }}
                  >
                    {active && <Check size={16} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>
          <Row icon={<Type size={18} />} title="Text size" desc="Scales the whole site.">
            <Select value={prefs.textSize} onValueChange={(v) => setPref('textSize', v)}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row icon={<Sparkles size={18} />} title="Animations" desc="Turn off transitions and movement.">
            <Select value={prefs.motion} onValueChange={(v) => setPref('motion', v)}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Match device</SelectItem>
                <SelectItem value="full">Always on</SelectItem>
                <SelectItem value="reduce">Reduced</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </div>
      </Section>

      {/* Content */}
      <Section id="content" title="Content">
        <div className="divide-y divide-white/5">
          <Row icon={<Languages size={18} />} title="Title language" desc="Titles and descriptions for movies & TV, when available.">
            <Select value={prefs.contentLanguage} onValueChange={(v) => { setPref('contentLanguage', v); done('Language updated'); }}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row icon={<History size={18} />} title="Save search history" desc="Remember what you search for on this device.">
            <Switch checked={prefs.saveSearchHistory} onCheckedChange={(v) => { setPref('saveSearchHistory', v); if (!v) clearSearchHistory(); }} />
          </Row>
        </div>
      </Section>

      {/* Android app only */}
      {isNative && (
        <Section id="android" title="Android app">
          <div className="divide-y divide-white/5">
            <Row icon={<Smartphone size={18} />} title="Save songs to your phone" desc={canSaveToPhone() ? 'Downloaded songs are also saved as files in your Music folder, so other apps can play them.' : 'Needs the latest app version. Update the app to turn this on.'}>
              <Switch checked={prefs.saveToPhone !== false} disabled={!canSaveToPhone()} onCheckedChange={(v) => setPref('saveToPhone', v)} />
            </Row>
            <Row icon={<Lock size={18} />} title="Lock the app" desc="Ask for your fingerprint, face or screen lock when you open the app. Also hides the app in the recent-apps list.">
              <Switch
                checked={!!prefs.appLock}
                disabled={!(window.SxNative && window.SxNative.setAppLock)}
                onCheckedChange={(v) => {
                  try {
                    const ok = window.SxNative.setAppLock(v);
                    if (!ok) { toast({ title: 'Set a screen lock first', description: 'Add a PIN, pattern or fingerprint in your phone settings, then try again.' }); return; }
                    setPref('appLock', v);
                  } catch { toast({ title: 'Could not change the lock' }); }
                }}
              />
            </Row>
          </div>
        </Section>
      )}

      {/* Music playback */}
      <Section id="playback" title="Music playback">
        <div className="divide-y divide-white/5">
          <Row icon={<Zap size={18} />} title="Autoplay" desc="Keep playing the next track when yours ends.">
            <Switch checked={autoplay} onCheckedChange={setAutoplay} />
          </Row>
          <div className="py-4">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-primary mt-0.5"><GitMerge size={18} /></span>
              <div className="flex-1">
                <div className="text-sm font-medium">Crossfade</div>
                <div className="text-xs text-muted-foreground mt-0.5">Fade the end of each track into the next.</div>
              </div>
              <div className="text-xs tabular-nums text-muted-foreground shrink-0 w-8 text-right">{crossfade === 0 ? 'Off' : `${crossfade}s`}</div>
            </div>
            <Slider value={[crossfade]} min={0} max={12} step={1} onValueChange={(v) => setCrossfade(v[0])} className="mt-1" />
          </div>
          <Row icon={<Volume2 size={18} />} title="Gapless playback" desc="Play tracks back-to-back without silence.">
            <Switch checked={gapless} onCheckedChange={setGapless} />
          </Row>
          <Row icon={<Gauge size={18} />} title="Audio quality" desc="Higher quality uses more data.">
            <Select value={quality} onValueChange={setQuality}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <div className="py-4">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-primary mt-0.5"><Gauge size={18} /></span>
              <div className="flex-1">
                <div className="text-sm font-medium">Playback speed</div>
                <div className="text-xs text-muted-foreground mt-0.5">Speed up or slow down any track.</div>
              </div>
              <div className="text-xs tabular-nums text-muted-foreground shrink-0 w-12 text-right">{playbackSpeed.toFixed(2)}x</div>
            </div>
            <Slider value={[playbackSpeed]} min={0.5} max={2} step={0.05} onValueChange={(v) => setPlaybackSpeed(v[0])} className="mt-1" />
          </div>
          <Row icon={<Activity size={18} />} title="Audio normalization" desc="Keep volume steady across tracks (disables crossfade dips).">
            <Switch checked={normalization} onCheckedChange={setNormalization} />
          </Row>
          <Row icon={<Moon size={18} />} title="Sleep timer" desc="Pause playback after a set time.">
            <Select value={String(sleepTimer)} onValueChange={(v) => setSleepTimer(Number(v))}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Off</SelectItem>
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="45">45 min</SelectItem>
                <SelectItem value="60">60 min</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row icon={<Keyboard size={18} />} title="Keyboard shortcuts" desc="Space, arrows, M and L control the player.">
            <Switch checked={prefs.shortcuts} onCheckedChange={(v) => setPref('shortcuts', v)} />
          </Row>
        </div>
      </Section>

      {/* Notifications */}
      <Section id="notifications" title="Alerts">
        <div className="divide-y divide-white/5">
          <Row icon={<Bell size={18} />} title="New releases" desc="From artists in your library.">
            <Switch checked={notifications.releases} onCheckedChange={(v) => setNotification('releases', v)} />
          </Row>
          <Row icon={<Bell size={18} />} title="Playlist updates" desc="When playlists you follow change.">
            <Switch checked={notifications.playlists} onCheckedChange={(v) => setNotification('playlists', v)} />
          </Row>
          <Row icon={<Bell size={18} />} title="Product news" desc="Occasional Sarmaxstream updates.">
            <Switch checked={notifications.product} onCheckedChange={(v) => setNotification('product', v)} />
          </Row>
        </div>
      </Section>

      {/* Privacy & data */}
      <Section id="privacy" title="Privacy & data">
        <div className="divide-y divide-white/5">
          <Row icon={<History size={18} />} title="Search history" desc="Delete your recent searches.">
            <Button variant="outline" size="sm" className="glass glass-hover" onClick={() => { clearSearchHistory(); done('Search history cleared'); }}>Clear</Button>
          </Row>
          <Row icon={<Music4 size={18} />} title="Recently played" desc="Delete your recent music list.">
            <Button variant="outline" size="sm" className="glass glass-hover" onClick={() => { clearRecentlyPlayed(); done('Recently played cleared'); }}>Clear</Button>
          </Row>
          <Row icon={<Database size={18} />} title="Cached data" desc="Frees space. Pages reload fresh data next visit.">
            <Button variant="outline" size="sm" className="glass glass-hover" onClick={() => { const n = clearCachedData(); done(n ? 'Cache cleared' : 'Nothing to clear'); }}>Clear</Button>
          </Row>
          <Row icon={<Download size={18} />} title="Download my data" desc="Settings and history stored on this device (JSON).">
            <Button variant="outline" size="sm" className="glass glass-hover" onClick={() => { exportLocalData(); done('Download started'); }}>Export</Button>
          </Row>
          <Row icon={<RotateCcw size={18} />} title="Reset everything" desc="Restore defaults and wipe local data. You stay signed in.">
            <Button variant="outline" size="sm" className="text-red-300 border-red-500/30 hover:bg-red-500/10 hover:text-red-200" onClick={confirmReset}>Reset</Button>
          </Row>
        </div>
      </Section>

      {/* Account */}
      <Section id="account" title="Account">
        <div className="flex items-center gap-3 mt-3">
          <div className="w-12 h-12 rounded-full glass flex items-center justify-center text-primary shrink-0"><User size={20} /></div>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{isAuthenticated ? (user?.full_name || 'Listener') : 'Not signed in'}</div>
            <div className="text-xs text-muted-foreground truncate">{isAuthenticated ? (user?.email || '') : 'Sign in to save your library and playlists.'}</div>
          </div>
          {isAuthenticated ? (
            <Button variant="outline" size="sm" onClick={() => logout()} className="glass glass-hover shrink-0">
              <LogOut size={16} className="mr-1.5" /> Log out
            </Button>
          ) : (
            <Button asChild size="sm" className="shrink-0">
              <Link to="/login"><LogIn size={16} className="mr-1.5" /> Log in</Link>
            </Button>
          )}
        </div>
        {isAuthenticated && (
          <div className="divide-y divide-white/5 mt-2">
            <Row icon={<ShieldCheck size={18} />} title="Account & deletion" desc="Profile details and permanent account deletion.">
              <Button asChild variant="outline" size="sm" className="glass glass-hover"><Link to="/watchlist#account">Manage</Link></Button>
            </Row>
          </div>
        )}
      </Section>

      <p className="text-xs text-muted-foreground text-center">Preferences are saved on this device.</p>
    </div>
  );

  if (!standalone) return body;
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-nav pb-page px-4 sm:px-6">{body}</main>
    </div>
  );
}
