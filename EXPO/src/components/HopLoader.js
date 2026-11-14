// Hopz loader / splash animation: the bold SATURDAY-style letters H, O, P draw in, then the little teal Z
// hops from letter to letter (each letter squashes as it lands), jumps to its home, grows to full size
// and glows. Use <HopLoader loop /> while loading, or <HopLoader onLanded={...} /> for a one-shot splash.
import React, { useRef, useEffect, useState } from 'react';
import { View, Dimensions } from 'react-native';
import Svg, { Path, G, Circle } from 'react-native-svg';
import { HOP_PATHS, Z_PATH, TEAL, TEAL_GLOW } from './Logo';

const LEN = 130;
const SW = 6.5; // bold stroke
const LETTERS = [{ cx: 25 }, { cx: 103 }, { cx: 180 }]; // H, O, P centres; the tops are at y = 0, the bottoms at y = 100
const HOME = { x: 259, y: 50 };
const SMALL = 0.42; // size of the Z while it hops
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (u) => 1 - Math.pow(1 - u, 3);

// timeline (ms)
const DRAW = [0, 140, 280]; // H, O, P start drawing
const DRAW_MS = 420;
const START = 480; // the Z appears
const HOPS = [
  { t: 0, d: 380 }, // from off-screen onto H
  { t: 440, d: 380 }, // H to O
  { t: 880, d: 380 }, // O to P
  { t: 1320, d: 520 }, // P to home
];
const END = START + 1320 + 520 + 650;

function frame(t) {
  const s = { draw: DRAW.map((d) => easeOut(clamp((t - d) / DRAW_MS))), squash: [1, 1, 1], z: null, zsy: 1, glow: 0, ring: 0 };
  const topY = -SW - 2; // the Z's feet rest on the top of a letter
  const restY = topY - 50 * SMALL;
  const pts = [{ x: -45, y: -70 }, { x: LETTERS[0].cx, y: restY }, { x: LETTERS[1].cx, y: restY }, { x: LETTERS[2].cx, y: restY }, { x: HOME.x, y: HOME.y }];
  const lt = t - START;
  if (lt >= 0) {
    let k = 0;
    for (let i = 0; i < HOPS.length; i++) if (lt >= HOPS[i].t) k = i;
    const h = HOPS[k];
    const u = clamp((lt - h.t) / h.d);
    const a = pts[k], b = pts[k + 1];
    const arc = k === 3 ? 70 : 38;
    const e = k === 3 ? easeOut(u) : u;
    const x = a.x + (b.x - a.x) * e;
    const y = a.y + (b.y - a.y) * e - arc * 4 * u * (1 - u);
    const scale = k === 3 ? SMALL + (1 - SMALL) * easeOut(u) : SMALL;
    s.z = { x, y, k: scale };
    // squash the letter the Z just landed on (it lands at the end of hops 0, 1 and 2)
    for (let i = 0; i < 3; i++) {
      const landAt = HOPS[i].t + HOPS[i].d;
      const dt = lt - landAt;
      if (dt >= 0 && dt < 260) s.squash[i] = 1 - 0.1 * Math.sin((dt / 260) * Math.PI);
    }
    const homeAt = HOPS[3].t + HOPS[3].d;
    const dz = lt - homeAt;
    if (dz >= 0) {
      if (dz < 200) s.zsy = 1 - 0.14 * Math.sin((dz / 200) * Math.PI);
      s.glow = clamp(dz / 500);
      s.ring = clamp(dz / 600);
    }
  }
  return s;
}

function Stroke({ d, p, color, w, o = 1 }) {
  return <Path d={d} stroke={color} strokeWidth={w} strokeOpacity={o} strokeDasharray={`${LEN} ${LEN * 4}`} strokeDashoffset={LEN * (1 - p)} strokeLinecap="butt" fill="none" />;
}

export default function HopLoader({ width = Dimensions.get('window').width * 0.5, loop = false, onLanded }) {
  const W = 360, H = 200; // view box size: leaves room above the letters for the hops
  const h = (width * H) / W;
  const [t, setT] = useState(0);
  const landed = useRef(false);
  useEffect(() => {
    let raf, t0 = Date.now(), alive = true;
    const tick = () => {
      if (!alive) return;
      let el = Date.now() - t0;
      if (el >= END && loop) { t0 = Date.now(); el = 0; landed.current = false; }
      setT(Math.min(el, END));
      if (el >= START + 1320 + 520 + 250 && !landed.current) { landed.current = true; onLanded && onLanded(); }
      if (el < END || loop) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, []);

  const s = frame(t);
  const z = s.z;
  const zT = z ? `translate(${z.x},${z.y + 50 * z.k * (1 - s.zsy)}) scale(${z.k},${z.k * s.zsy}) translate(-${HOME.x},-${HOME.y})` : null;
  return (
    <View style={{ width, height: h }}>
      <Svg width={width} height={h} viewBox="-34 -92 360 200">
        {HOP_PATHS.map((d, i) => (
          <G key={d} transform={`translate(${LETTERS[i].cx},100) scale(1,${s.squash[i]}) translate(-${LETTERS[i].cx},-100)`}>
            <Stroke d={d} p={s.draw[i]} color="#FFFFFF" w={16} o={0.10} />
            <Stroke d={d} p={s.draw[i]} color="#FFFFFF" w={11} o={0.16} />
            <Stroke d={d} p={s.draw[i]} color="#FFFFFF" w={SW} />
          </G>
        ))}
        {s.ring > 0 ? <Circle cx={HOME.x} cy={HOME.y} r={30 + 40 * s.ring} fill="none" stroke={TEAL_GLOW} strokeWidth="2" opacity={0.5 * (1 - s.ring)} /> : null}
        {z ? (
          <G transform={zT} fill="none">
            <Path d={Z_PATH} stroke={TEAL_GLOW} strokeWidth={16} strokeOpacity={0.1 + 0.12 * (s.glow || 0.2)} strokeLinecap="butt" />
            <Path d={Z_PATH} stroke={TEAL_GLOW} strokeWidth={11} strokeOpacity={0.14 + 0.28 * s.glow} strokeLinecap="butt" />
            <Path d={Z_PATH} stroke={TEAL} strokeWidth={SW} strokeLinecap="butt" />
          </G>
        ) : null}
      </Svg>
    </View>
  );
}
