import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { VARIANT } from '../theme';

// Liquid-glass surface: blur + tinted gradient + glossy top half + bright rim + soft shadow.
// `style` positions/sizes the outer box, `contentStyle` lays out the children.
export default function Glass({ variant = 'dark', radius = 20, style, contentStyle, children, shadow = true }) {
  const v = VARIANT[variant] || VARIANT.dark;
  return (
    <View
      style={[
        { borderRadius: radius },
        shadow && {
          shadowColor: variant === 'amber' ? '#5F8C89' : '#363F3F',
          shadowOpacity: variant === 'amber' ? 0.4 : 0.18,
          shadowRadius: variant === 'amber' ? 14 : 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
        style,
      ]}
    >
      <View style={{ borderRadius: radius, overflow: 'hidden', borderWidth: v.bw || 1, borderColor: v.border, flexGrow: 1 }}>
        <BlurView intensity={v.blur} tint={v.tint || 'light'} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={v.colors} style={StyleSheet.absoluteFill} />
        {v.gloss ? (
          <LinearGradient colors={v.gloss} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '48%' }} />
        ) : null}
        <View style={[{ flexGrow: 1 }, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}
