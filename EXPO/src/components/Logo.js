// Hopz wordmark in a SATURDAY-style face: wide hairline capitals, one small break in every letter.
// White "HOP" and a teal glowing "Z". Drawn with SVG so it is crisp at any size.
import React from 'react';
import Svg, { Path, G } from 'react-native-svg';

export const HOP_PATHS = [
  'M0 0V100M50 0V100M0 50H15M35 50H50', // H
  'M78.7 38A25 50 0 0 1 127.3 38M78.7 62A25 50 0 0 0 127.3 62', // O
  'M156 0V100M163 0H182A22 24 0 0 1 182 48H163', // P
];
export const Z_PATH = 'M234 0H284M282 6L264 41M254 59L236 94M234 100H284';
export const TEAL = '#9DFFF0';
export const TEAL_GLOW = '#00E6C8';

export default function Logo({ width = 130, glow = true }) {
  const h = (width * 116) / 300;
  return (
    <Svg width={width} height={h} viewBox="-8 -8 300 116">
      <G fill="none" strokeLinecap="butt" strokeLinejoin="round">
        {glow ? (
          <>
            <G stroke="#FFFFFF" strokeOpacity="0.10" strokeWidth="16">{HOP_PATHS.map((d) => <Path key={`a${d}`} d={d} />)}</G>
            <G stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="11">{HOP_PATHS.map((d) => <Path key={`b${d}`} d={d} />)}</G>
            <Path d={Z_PATH} stroke={TEAL_GLOW} strokeOpacity="0.14" strokeWidth="16" />
            <Path d={Z_PATH} stroke={TEAL_GLOW} strokeOpacity="0.22" strokeWidth="11" />
          </>
        ) : null}
        <G stroke="#FFFFFF" strokeWidth="6.5">{HOP_PATHS.map((d) => <Path key={d} d={d} />)}</G>
        <Path d={Z_PATH} stroke={TEAL} strokeWidth="6.5" />
      </G>
    </Svg>
  );
}
