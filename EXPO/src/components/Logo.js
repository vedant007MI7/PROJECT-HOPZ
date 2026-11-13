// Hopz wordmark: steel "hop" + glowing amber "z". Drawn with SVG so it is crisp at any size.
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
  const c1 = light ? '#1F3B52' : '#EAF5FB';
  const c2 = light ? '#4F7C9B' : '#A9CAE0';
  return (
    <Svg width={width} height={h} viewBox="-50 -180 560 250">
      <Defs>
        <LinearGradient id="lh" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="335" y2="0">
          <Stop offset="0" stopColor={c1} />
          <Stop offset="1" stopColor={c2} />
        </LinearGradient>
        <LinearGradient id="lz" gradientUnits="userSpaceOnUse" x1="366" y1="-100" x2="456" y2="0">
          <Stop offset="0" stopColor="#FFD9A8" />
          <Stop offset="1" stopColor="#F29A38" />
        </LinearGradient>
      </Defs>
      <G fill="none" strokeLinecap="round" strokeLinejoin="round">
        <G stroke="url(#lh)" strokeWidth="22">{HOP}</G>
        {glow ? (
          <>
            <Path d={Z} stroke="#F7A851" strokeOpacity="0.10" strokeWidth="66" />
            <Path d={Z} stroke="#F7A851" strokeOpacity="0.16" strokeWidth="50" />
            <Path d={Z} stroke="#F7A851" strokeOpacity="0.26" strokeWidth="36" />
          </>
        ) : null}
        <Path d={Z} stroke="url(#lz)" strokeWidth="22" />
      </G>
    </Svg>
  );
}
