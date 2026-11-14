// Hopz wordmark: light almond "hop" + glowing rose "z" with a soft shadow (light = dark "hop" for light backgrounds). Drawn with SVG so it is crisp at any size.
import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';

const HOP = (
  <>
    <Path d="M0 -150 V0 M0 -58 C0 -108 70 -108 70 -58 V0" />
    <Circle cx="152" cy="-50" r="50" />
    <Path d="M234 -100 V50" />
    <Circle cx="284" cy="-50" r="50" />
  </>
);
const Z = 'M366 -100 H456 L366 0 H456';

export default function Logo({ width = 200, light = false, glow = true }) {
  const h = (width * 250) / 560;
  const c1 = light ? '#0E0B26' : '#FFFFFF';
  const c2 = light ? '#2A2656' : '#DCE4FF';
  const z1 = light ? '#6F7FFF' : '#FFB08A';
  const z2 = light ? '#2456D6' : '#FF4F8B';
  const gl = light ? '#7FA6FF' : '#FF8AB0';
  const sh = light ? '#1E1E6E' : '#0A0550';
  const k = light ? 0.7 : 1;
  return (
    <Svg width={width} height={h} viewBox="-50 -180 560 250">
      <Defs>
        <LinearGradient id="lh" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="335" y2="0">
          <Stop offset="0" stopColor={c1} />
          <Stop offset="1" stopColor={c2} />
        </LinearGradient>
        <LinearGradient id="lz" gradientUnits="userSpaceOnUse" x1="366" y1="-100" x2="456" y2="0">
          <Stop offset="0" stopColor={z1} />
          <Stop offset="1" stopColor={z2} />
        </LinearGradient>
      </Defs>
      <G fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* soft shadow under the whole logo */}
        <G transform="translate(0,12)">
          <G stroke={sh} strokeOpacity={0.10 * k} strokeWidth="40">{HOP}<Path d={Z} /></G>
          <G stroke={sh} strokeOpacity={0.14 * k} strokeWidth="32">{HOP}<Path d={Z} /></G>
          <G stroke={sh} strokeOpacity={0.22 * k} strokeWidth="24">{HOP}<Path d={Z} /></G>
        </G>
        <G stroke="url(#lh)" strokeWidth="22">{HOP}</G>
        {glow ? (
          <>
            <Path d={Z} stroke={gl} strokeOpacity="0.14" strokeWidth="66" />
            <Path d={Z} stroke={gl} strokeOpacity="0.2" strokeWidth="50" />
            <Path d={Z} stroke={gl} strokeOpacity="0.3" strokeWidth="36" />
          </>
        ) : null}
        <Path d={Z} stroke="url(#lz)" strokeWidth="22" />
      </G>
    </Svg>
  );
}
