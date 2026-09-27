import React from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '@/lib/useSettings';
import { useAuth } from '@/lib/AuthContext';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Volume2, Zap, GitMerge, Gauge, Bell, LogOut, LogIn, User, Activity, Moon } from 'lucide-react';

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

export default function Settings() {
  const { autoplay, setAutoplay, crossfade, setCrossfade, gapless, setGapless, quality, setQuality, notifications, setNotification, playbackSpeed, setPlaybackSpeed, normalization, setNormalization, sleepTimer, setSleepTimer } = useSettings();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">Settings</h1>

      {/* Playback & audio */}
      <section className="glass rounded-2xl p-5 md:p-6">
        <div className="eyebrow text-primary mb-1">Playback & audio</div>
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
        </div>
      </section>

      {/* Account & alerts */}
      <section className="glass rounded-2xl p-5 md:p-6 space-y-5">
        <div className="eyebrow text-primary">Account & alerts</div>
        <div className="flex items-center gap-3">
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
        <div className="divide-y divide-white/5">
          <Row icon={<Bell size={18} />} title="New releases" desc="From artists in your library.">
            <Switch checked={notifications.releases} onCheckedChange={(v) => setNotification('releases', v)} />
          </Row>
          <Row icon={<Bell size={18} />} title="Playlist updates" desc="When playlists you follow change.">
            <Switch checked={notifications.playlists} onCheckedChange={(v) => setNotification('playlists', v)} />
          </Row>
          <Row icon={<Bell size={18} />} title="Product news" desc="Occasional sarmaxstream updates.">
            <Switch checked={notifications.product} onCheckedChange={(v) => setNotification('product', v)} />
          </Row>
        </div>
      </section>

      <p className="text-xs text-muted-foreground text-center">Your preferences are saved on this device.</p>
    </div>
  );
}
