import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { VARIANT } from '../theme';

// Black liquid-glass surface: blur + dark body + faint gloss + rim. Selections add a coloured outer glow
// (white = common selection, green = chosen / confirm, red = cancel).
// `style` positions/sizes the outer box, `contentStyle` lays out the children.
export default function Glass({ variant = 'dark', radius = 20, style, contentStyle, children, shadow = true }) {
  const v = VARIANT[variant] || VARIANT.dark;
  return (
    <View
      style={[
        { borderRadius: radius },
        shadow && {
          // a faint solid base lets iOS draw a real shadow / glow under the see-through glass
          backgroundColor: 'rgba(0,0,0,0.32)',
          shadowColor: v.glow || '#000000',
          shadowOpacity: v.glow ? (v.glowOpacity != null ? v.glowOpacity : 0.85) : 0.6,
          shadowRadius: v.glow ? (v.glowRadius || 18) : 16,
          shadowOffset: { width: 0, height: v.glow ? 0 : 8 },
          elevation: 12,
        },
        style,
      ]}
    >
      <View style={{ borderRadius: radius, overflow: 'hidden', borderWidth: v.bw || 1, borderColor: v.border, flexGrow: 1 }}>
        <BlurView intensity={v.blur} tint={v.tint || 'dark'} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={v.colors} style={StyleSheet.absoluteFill} />
        {v.inner ? <LinearGradient colors={[v.inner, 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} /> : null}
        {v.gloss ? (
          <LinearGradient colors={v.gloss} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '48%' }} />
        ) : null}
        {v.shine ? (
          <>
            {/* liquid-glass sheen: a soft diagonal highlight, a bright glint band and a lit top edge */}
            <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.26)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)']} locations={[0, 0.35, 0.7]} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.7 }} style={StyleSheet.absoluteFill} />
            <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.13)', 'rgba(255,255,255,0)']} locations={[0.28, 0.4, 0.52]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: 14, right: 14, top: 0, height: 1.5 }} />
            <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.12)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '30%' }} />
          </>
        ) : null}
        <View style={[{ flexGrow: 1 }, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}
