// Loading-screen logo: the Z hops over h, o and p (squeezing each letter), lands in its place and glows.
// Use <HopLoader loop /> while the app is loading, or <HopLoader onLanded={...} /> for a one-shot splash.
import React, { useEffect, useRef, useState } from 'react';
import { View, Dimensions } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';

const HALF = 61, HOME = { x: 411, y: -50 };
const LET = {
  h: { cx: 35, top: -161, A: 0.24 },
  o: { cx: 152, top: -111, A: 0.30 },
  p: { cx: 284, top: -111, A: 0.30 },
};
const pt = (k) => ({ x: LET[k].cx, y: LET[k].top - HALF });
const Z = 'M366 -100 H456 L366 0 H456';

function build(first) {
  const legs = [first ? { k: 'f', from: { x: -70, y: -360 }, to: pt('h'), dur: 700, fall: true } : { k: 'f', from: HOME, to: pt('h'), dur: 880, ap: 190 }];
  legs.push(
    { k: 'c', at: 'h', dur: 210 },
    { k: 'f', to: pt('o'), dur: 430, ap: 62 }, { k: 'c', at: 'o', dur: 200 },
    { k: 'f', to: pt('p'), dur: 430, ap: 62 }, { k: 'c', at: 'p', dur: 200 },
    { k: 'f', to: HOME, dur: 600, ap: 85 }, { k: 'c', at: 'home', dur: 600 }, { k: 'w', dur: 800 },
  );
  let t = 0;
  legs.forEach((l) => { l.st = t; t += l.dur; });
  return { legs, T: t, homeSt: legs.find((l) => l.at === 'home').st };
}
const FIRST = build(true), LOOP = build(false);

const wob = (u, k, w) => Math.min(1, u / 0.04) * Math.exp(-k * u) * Math.cos(w * u);
const endPos = (legs, i) => {
  const l = legs[i];
  if (l.k === 'f') return l.to;
  if (l.k === 'c' && l.at !== 'home') return pt(l.at);
  return HOME;
};

function stateAt(g, loop) {
  let cyc, t, first;
  if (g < FIRST.T || !loop) { cyc = FIRST; t = Math.min(g, FIRST.T - 0.01); first = true; }
  else { cyc = LOOP; t = (g - FIRST.T) % LOOP.T; first = false; }
  const legs = cyc.legs;
  let i = 0;
  while (i < legs.length - 1 && t >= legs[i].st + legs[i].dur) i++;
  const L = legs[i], u = (t - L.st) / L.dur;
  const z = { x: HOME.x, y: HOME.y, rot: 0, sx: 1, sy: 1, bottom: false };
  if (L.k === 'f') {
    const from = L.from || (i > 0 ? endPos(legs, i - 1) : HOME), to = L.to, s = u;
    const y = L.fall ? from.y + (to.y - from.y) * s * s : from.y + (to.y - from.y) * s - 4 * (L.ap || 0) * s * (1 - s);
    z.x = from.x + (to.x - from.x) * s; z.y = y;
    const d = to.x - from.x >= 0 ? 1 : -1;
    z.rot = -16 * d * Math.sin(Math.PI * s);
    z.sy = 1 + 0.13 * Math.sin(Math.PI * s); z.sx = 1 - 0.07 * Math.sin(Math.PI * s);
  } else if (L.k === 'c' && L.at !== 'home') {
    const lt = LET[L.at], r = wob((t - L.st) / 1000, 4.5, 11), sL = 1 - lt.A * r;
    z.x = lt.cx; z.y = lt.top * sL - HALF; z.sy = 1 - 0.6 * lt.A * r; z.sx = 1 + 0.35 * lt.A * r;
  } else {
    const r = wob(Math.max(0, (t - cyc.homeSt) / 1000), 5, 12);
    z.sy = 1 - 0.34 * r; z.sx = 1 + 0.2 * r; z.bottom = true;
  }
  const ls = {};
  ['h', 'o', 'p'].forEach((k) => {
    let hit = null;
    legs.forEach((l) => { if (l.k === 'c' && l.at === k && l.st <= t) hit = l.st; });
    ls[k] = hit === null ? 1 : 1 - LET[k].A * wob((t - hit) / 1000, 4.5, 11);
  });
  // glow: flash on landing, then breathing. In one-shot mode the breathing keeps going on real time.
  let gl = 0, ring = 0, ringR = 0;
  const tg = !loop && g > FIRST.T ? g : t;
  if (tg >= cyc.homeSt) {
    const ug = (tg - cyc.homeSt) / 1000;
    gl = Math.min(1, ug * 5) * (0.86 + 0.14 * Math.sin(ug * 3.2)) + 0.75 * Math.exp(-ug * 5);
    if (ug < 0.65) { ring = 0.55 * (1 - ug / 0.65); ringR = 36 + (ug / 0.65) * 95; }
  } else if (!first && i === 0) gl = 0.95 * Math.exp(-t / 90);
  return { z, ls, gl, ring, ringR, fade: first ? Math.min(1, g / 520) : 1, rise: first ? Math.max(0, 1 - g / 520) : 0 };
}

export default function HopLoader({ width = Dimensions.get('window').width * 0.5, loop = false, onLanded }) {
  const [g, setG] = useState(0);
  const landed = useRef(false);
  useEffect(() => {
    let raf, start = null, alive = true;
    const tick = (now) => {
      if (!alive) return;
      if (start === null) start = now;
      const el = now - start;
      setG(el);
      if (!landed.current && el >= FIRST.homeSt) { landed.current = true; onLanded && onLanded(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, []);

  const S = stateAt(g, loop), z = S.z;
  const height = (width * 480) / 680;
  const cyB = z.bottom ? HOME.y + HALF : HOME.y;
  const gv = Math.min(S.gl, 1.6), extra = Math.max(0, S.gl - 1) * 30;
  const letter = (k) => {
    const cx = LET[k].cx, sy = S.ls[k], sx = 1 + (1 - sy) * 0.45;
    return `translate(${cx},0) scale(${sx},${sy}) translate(${-cx},0)`;
  };
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox="-110 -380 680 480">
        <Defs>
          <LinearGradient id="hlh" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="335" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" /><Stop offset="1" stopColor="#DCE4FF" />
          </LinearGradient>
          <LinearGradient id="hlz" gradientUnits="userSpaceOnUse" x1="366" y1="-100" x2="456" y2="0">
            <Stop offset="0" stopColor="#FFB08A" /><Stop offset="1" stopColor="#FF4F8B" />
          </LinearGradient>
        </Defs>
        {[[40, 0.10], [32, 0.14], [24, 0.22]].map(([w, o]) => (
          <G key={`sh${w}`} opacity={S.fade} transform={`translate(0,${S.rise * 10 + 12})`} fill="none" stroke="#0A0550" strokeOpacity={o} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
            <G transform={letter('h')}><Path d="M0 -150 V0 M0 -58 C0 -108 70 -108 70 -58 V0" /></G>
            <G transform={letter('o')}><Circle cx="152" cy="-50" r="50" /></G>
            <G transform={letter('p')}><Path d="M234 -100 V50" /><Circle cx="284" cy="-50" r="50" /></G>
          </G>
        ))}
        <G opacity={S.fade} transform={`translate(0,${S.rise * 10})`} fill="none" stroke="url(#hlh)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round">
          <G transform={letter('h')}><Path d="M0 -150 V0 M0 -58 C0 -108 70 -108 70 -58 V0" /></G>
          <G transform={letter('o')}><Circle cx="152" cy="-50" r="50" /></G>
          <G transform={letter('p')}><Path d="M234 -100 V50" /><Circle cx="284" cy="-50" r="50" /></G>
        </G>
        {S.ring > 0 ? <Circle cx="411" cy="-50" r={S.ringR} fill="none" stroke="#FF8AB0" strokeWidth="3" opacity={S.ring} /> : null}
        <G opacity={g < 80 ? g / 80 : 1} transform={`translate(${z.x - HOME.x},${z.y - HOME.y + 12}) translate(411,-50) rotate(${z.rot}) translate(-411,50)`}>
          <G transform={`translate(411,${cyB}) scale(${z.sx},${z.sy}) translate(-411,${-cyB})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {[[40, 0.10], [32, 0.14], [24, 0.22]].map(([w, o]) => (<Path key={`zs${w}`} d={Z} stroke="#0A0550" strokeOpacity={o} strokeWidth={w} />))}
          </G>
        </G>
        <G fill="none" stroke="#FF8AB0" strokeLinecap="round" strokeLinejoin="round">
          <Path d={Z} strokeOpacity={Math.min(0.9, 0.10 * gv)} strokeWidth={66 + extra} />
          <Path d={Z} strokeOpacity={Math.min(0.9, 0.16 * gv)} strokeWidth={50 + extra} />
          <Path d={Z} strokeOpacity={Math.min(0.9, 0.26 * gv)} strokeWidth={36 + extra} />
        </G>
        <G opacity={g < 80 ? g / 80 : 1} transform={`translate(${z.x - HOME.x},${z.y - HOME.y}) translate(411,-50) rotate(${z.rot}) translate(-411,50)`}>
          <G transform={`translate(411,${cyB}) scale(${z.sx},${z.sy}) translate(-411,${-cyB})`}>
            <Path d={Z} fill="none" stroke="url(#hlz)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
          </G>
        </G>
      </Svg>
    </View>
  );
}
