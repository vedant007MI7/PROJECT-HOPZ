import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { LinearGradient as Grad } from 'expo-linear-gradient';
import { BG } from '../theme';

// macOS Big Sur style wallpaper: blue into violet with pink and orange waves along the bottom.
export default function Wallpaper() {
  return (
    <>
      <Grad colors={BG} locations={[0, 0.4, 0.72, 1]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFill} />
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 330 660" preserveAspectRatio="xMidYMax slice" pointerEvents="none">
        <Defs>
          <LinearGradient id="wa" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#E8408F" />
            <Stop offset="0.55" stopColor="#FF5A7A" />
            <Stop offset="1" stopColor="#FF9A4A" />
          </LinearGradient>
          <LinearGradient id="wb" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#5A3FDC" />
            <Stop offset="1" stopColor="#8A3FD8" />
          </LinearGradient>
        </Defs>
        <Path d="M0 360 C80 340 150 400 230 440 C285 468 312 490 330 500 L330 660 L0 660Z" fill="url(#wb)" />
        <Path d="M0 440 C60 410 130 450 200 500 C255 540 300 556 330 556 L330 660 L0 660Z" fill="url(#wa)" />
        <Path d="M0 575 C90 548 160 590 230 606 C275 616 310 612 330 606 L330 660 L0 660Z" fill="#FFB14D" opacity="0.9" />
      </Svg>
    </>
  );
}
