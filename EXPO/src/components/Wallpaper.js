import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path, Rect, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

// The PC desktop wallpaper look: teal, orange, cream and red waves on a near-black base.
export default function Wallpaper() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 330 660" preserveAspectRatio="xMidYMid slice" pointerEvents="none">
      <Defs>
        <LinearGradient id="wt" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#17C1B5" /><Stop offset="1" stopColor="#0A5E6E" /></LinearGradient>
        <LinearGradient id="wo" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#F08A2E" /><Stop offset="1" stopColor="#B8481E" /></LinearGradient>
        <LinearGradient id="wc" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#F3E3C0" /><Stop offset="1" stopColor="#C9A67A" /></LinearGradient>
        <LinearGradient id="wr" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#E0402A" /><Stop offset="1" stopColor="#7A1410" /></LinearGradient>
        <LinearGradient id="wb" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#0B141C" /><Stop offset="1" stopColor="#1A0E0C" /></LinearGradient>
      </Defs>
      <Rect width="330" height="660" fill="url(#wb)" />
      <Path d="M-10 120 C60 80 120 180 190 230 C250 270 300 250 340 200 L340 330 C270 380 200 340 130 300 C70 265 20 300 -10 340Z" fill="url(#wt)" />
      <Path d="M-10 250 C70 230 140 330 220 380 C280 415 320 400 340 380 L340 520 C260 540 190 480 120 440 C60 410 20 430 -10 470Z" fill="url(#wo)" />
      <Path d="M120 330 C190 350 250 420 340 410 L340 470 C250 490 170 430 100 395Z" fill="url(#wc)" opacity="0.9" />
      <Path d="M200 -10 C230 60 280 90 340 60 L340 190 C290 200 230 150 200 100Z" fill="url(#wr)" />
      <Path d="M-10 460 C60 480 140 560 230 580 C280 590 320 575 340 560 L340 670 L-10 670Z" fill="#1C100E" />
      <Path d="M-10 560 C70 540 150 600 230 620 L340 600 L340 670 L-10 670Z" fill="#7A2A1E" opacity="0.85" />
    </Svg>
  );
}

// Dark corner vignette laid over every screen (touches pass through).
export function Vignette() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id="vg" cx="50%" cy="48%" rx="80%" ry="72%" fx="50%" fy="48%">
          <Stop offset="0.5" stopColor="#000000" stopOpacity="0" />
          <Stop offset="0.82" stopColor="#000000" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#000000" stopOpacity="0.85" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#vg)" />
    </Svg>
  );
}
