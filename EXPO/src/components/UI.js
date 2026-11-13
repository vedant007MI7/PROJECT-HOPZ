import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated, Easing, TextInput, StyleSheet } from 'react-native';
import Glass from './Glass';
import Icon from './Icons';
import { C, F } from '../theme';

// ---------- animated press wrapper ----------
export function PressScale({ onPress, children, style, to = 0.96, disabled }) {
  const sc = useRef(new Animated.Value(1)).current;
  const go = (v) => Animated.spring(sc, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale: sc }] }, style]}>
      <Pressable disabled={disabled} onPressIn={() => go(to)} onPressOut={() => go(1)} onPress={onPress}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ---------- buttons ----------
export function GlassButton({ title, onPress, variant = 'amber', icon, height = 56, style, small }) {
  const amber = variant === 'amber';
  return (
    <PressScale onPress={onPress} style={style}>
      <Glass
        variant={variant}
        radius={16}
        style={{ height }}
        contentStyle={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, gap: 8 }}
      >
        {icon}
        <Text numberOfLines={1} style={[s.btnTxt, small && { fontSize: 13 }, amber ? s.amberTxt : s.steelTxt]}>
          {title}
        </Text>
      </Glass>
    </PressScale>
  );
}

export function IconButton({ name, onPress, label, size = 46, children, variant = 'steel' }) {
  return (
    <PressScale onPress={onPress} to={0.92}>
      <Glass variant={variant} radius={size / 2} style={{ width: size, height: size }} contentStyle={{ alignItems: 'center', justifyContent: 'center' }}>
        {children || <Icon name={name} color="#fff" />}
      </Glass>
    </PressScale>
  );
}

export function Chip({ label, icon, on, onPress, style, height = 42 }) {
  return (
    <PressScale onPress={onPress} to={0.95} style={style}>
      <Glass variant={on ? 'light' : 'steel'} radius={999} style={{ height }} contentStyle={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 }}>
        {icon}
        <Text numberOfLines={1} style={[s.chipTxt, on && { color: C.steelText, textShadowColor: 'transparent' }]}>
          {label}
        </Text>
      </Glass>
    </PressScale>
  );
}

// ---------- segmented control (Rider / Driver) ----------
export function Seg({ options, value, onChange }) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.k === value;
        return (
          <Pressable key={o.k} onPress={() => onChange(o.k)} style={{ flex: 1 }}>
            {on ? (
              <Glass variant="amber" radius={13} style={{ height: 46 }} contentStyle={{ alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[s.segTxt, s.amberTxt]}>{o.label}</Text>
              </Glass>
            ) : (
              <View style={{ height: 46, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[s.segTxt, { color: '#C4D0D4' }]}>{o.label}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- text input ----------
export function Field({ label, ...props }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor="rgba(186,199,203,0.7)" style={s.input} {...props} />
    </View>
  );
}

// ---------- text helpers ----------
export const H = ({ children, size = 24, style }) => <Text style={[{ fontFamily: F.hd, color: C.tx, fontSize: size, letterSpacing: -0.4 }, style]}>{children}</Text>;
export const T = ({ children, size = 15, color = C.tx, weight = 'r', style, ...p }) => (
  <Text style={[{ fontFamily: F[weight], color, fontSize: size }, style]} {...p}>
    {children}
  </Text>
);
// Prices use the app text font (DM Sans) and sit 5px off the right edge
export const Price = ({ children, size = 16, style, color = C.tx }) => (
  <Text style={[{ fontFamily: F.b, color, fontSize: size, marginRight: 5 }, style]}>₹{children}</Text>
);

// ---------- screen entrance ----------
export function FadeIn({ children }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// ---------- bottom sheet that slides up ----------
export function Sheet({ bottom = 14, children, style, contentStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: 12, right: 12, bottom, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] },
        style,
      ]}
    >
      <Glass variant="dark" radius={20} contentStyle={[{ padding: 18, gap: 14 }, contentStyle]}>
        {children}
      </Glass>
    </Animated.View>
  );
}

export function Card({ children, style, contentStyle, variant = 'dark' }) {
  return (
    <Glass variant={variant} radius={20} style={style} contentStyle={[{ padding: 14 }, contentStyle]}>
      {children}
    </Glass>
  );
}

export function Row({ children, style }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

const s = StyleSheet.create({
  btnTxt: { fontFamily: F.b, fontSize: 15 },
  amberTxt: { color: '#fff', textShadowColor: 'rgba(100,40,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  steelTxt: { color: '#fff', textShadowColor: 'rgba(0,18,36,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  chipTxt: { fontFamily: F.b, fontSize: 14, color: '#fff', textShadowColor: 'rgba(0,18,36,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  seg: { flexDirection: 'row', backgroundColor: C.inset, borderRadius: 16, padding: 4, gap: 4, borderWidth: 1, borderColor: 'rgba(220,236,246,0.14)' },
  segTxt: { fontFamily: F.b, fontSize: 14 },
  fieldLabel: { fontFamily: F.b, fontSize: 13, color: '#C4D0D4' },
  input: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(220,236,246,0.24)', backgroundColor: C.inset, color: C.tx, paddingHorizontal: 16, fontSize: 16, fontFamily: F.m },
});
