// Splash, Login, Sign up
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Animated, Easing, Pressable, StyleSheet, Dimensions, ScrollView } from 'react-native';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useApp } from '../state';
import { api } from '../api';
import { GlassButton, Seg, Field, IconButton, H, T } from '../components/UI';
import Icon from '../components/Icons';
import Logo from '../components/Logo';
import HopLoader from '../components/HopLoader';
import { C, F, TOP } from '../theme';

const { width: W, height: HGT } = Dimensions.get('window');

export function Splash() {
  const { s, go, restoreSession } = useApp();
  const [run, setRun] = useState(0);
  const tag = useRef(new Animated.Value(0)).current;
  const btn = useRef(new Animated.Value(0)).current;
  const landed = () => {
    Animated.stagger(150, [
      Animated.timing(tag, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(btn, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  };
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Svg style={StyleSheet.absoluteFill} width={W} height={HGT}>
        <Defs>
          <RadialGradient id="g1" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={C.amber} stopOpacity="0.38" />
            <Stop offset="1" stopColor={C.amber} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="g2" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={C.steel} stopOpacity="0.38" />
            <Stop offset="1" stopColor={C.steel} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={40} cy={HGT * 0.3} r={190} fill="url(#g1)" />
        <Circle cx={W - 20} cy={HGT * 0.72} r={210} fill="url(#g2)" />
      </Svg>
      <Pressable style={{ alignItems: 'center', marginTop: -40 }} onPress={() => { tag.setValue(0); btn.setValue(0); setRun((n) => n + 1); }}>
        <HopLoader key={run} width={Math.min(W * 0.5, 220)} onLanded={landed} />
        <Animated.View style={{ opacity: tag }}>
          <T color={C.tx2} size={16} style={{ marginTop: 8 }}>Your ride is one hop away</T>
        </Animated.View>
      </Pressable>
      <Animated.View style={{ position: 'absolute', left: 24, right: 24, bottom: 56, gap: 14, opacity: btn }}>
        {s.checking ? (
          <T color={C.tx2} style={{ textAlign: 'center' }}>Signing you in…</T>
        ) : s.offline ? (
          <>
            <T color={C.tx2} style={{ textAlign: 'center' }}>Can't reach the server. You're still logged in.</T>
            <GlassButton title="Retry" onPress={restoreSession} />
          </>
        ) : (
          <>
            <GlassButton title="Get started" onPress={() => go('login')} />
            <T color={C.tx2} size={13} style={{ textAlign: 'center' }}>Rider & driver apps in one</T>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const ROLES2 = [{ k: 'rider', label: 'Rider' }, { k: 'driver', label: 'Driver' }];

// Runs login/signup, then opens the right screen for the account (resuming any running ride).
function useSubmit(startSession, call) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      await startSession(await call());
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };
  return { busy, err, submit };
}

const ErrText = ({ children }) => (children ? <T color="#FF8A7A" size={14} style={{ marginTop: 12 }}>{children}</T> : null);

export function Login() {
  const { s, go, set, startSession } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, err, submit } = useSubmit(startSession, () => api.login(email.trim(), password));
  return (
    <ScrollView contentContainerStyle={{ paddingTop: TOP + 6, paddingHorizontal: 24, paddingBottom: 28, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <Logo width={110} />
      <H size={34} style={{ marginTop: 30, marginBottom: 8 }}>Welcome back</H>
      <T color={C.tx2} style={{ marginBottom: 24 }}>Log in to book a hop or start driving.</T>
      <View style={{ gap: 16, marginTop: 20 }}>
        <Field label="Email or mobile number" placeholder="you@example.com or 98765 43210" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} />
        <Field label="Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />
      </View>
      <ErrText>{err}</ErrText>
      <T weight="b" size={14} color={C.steel} style={{ textAlign: 'right', marginTop: 12, marginBottom: 22 }}>Forgot password?</T>
      <GlassButton title={busy ? 'Logging in…' : 'Log in'} onPress={busy ? undefined : submit} />
      <View style={{ flex: 1, minHeight: 30 }} />
      <Pressable onPress={() => go('signup')}>
        <T color={C.tx2} style={{ textAlign: 'center' }}>
          New to Hopz? <T weight="b" color={C.amber}>Create account</T>
        </T>
      </Pressable>
    </ScrollView>
  );
}

export function Signup() {
  const { s, go, set, startSession } = useApp();
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '', vehicle_model: '', plate: '', vehicle_type: 'mini' });
  const up = (k) => (v) => setF((o) => ({ ...o, [k]: v }));
  const driver = s.authRole === 'driver';
  const { busy, err, submit } = useSubmit(startSession, () => {
    if (!f.phone.trim()) throw new Error("Mobile number is required");
    const body = { name: f.name.trim(), email: f.email.trim(), password: f.password, role: s.authRole, phone: f.phone.trim() };
    if (driver) Object.assign(body, { vehicle_type: f.vehicle_type, vehicle_model: f.vehicle_model.trim() || undefined, plate: f.plate.trim() || undefined });
    return api.signup(body);
  });
  return (
    <ScrollView contentContainerStyle={{ paddingTop: TOP - 2, paddingHorizontal: 24, paddingBottom: 28, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <IconButton name="back" label="Back" onPress={() => go('login')} />
      <H size={32} style={{ marginTop: 22, marginBottom: 6 }}>Create your account</H>
      <T color={C.tx2} style={{ marginBottom: 20 }}>Takes under a minute.</T>
      <Seg options={ROLES2} value={s.authRole} onChange={(k) => set({ authRole: k })} />
      <View style={{ gap: 14, marginTop: 18 }}>
        <Field label="Full name" placeholder="Your name" value={f.name} onChangeText={up('name')} />
        <Field label="Mobile number" placeholder="10-digit mobile number" keyboardType="phone-pad" value={f.phone} onChangeText={up('phone')} />
        <Field label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={f.email} onChangeText={up('email')} />
        <Field label="Password" placeholder="At least 8 characters" secureTextEntry value={f.password} onChangeText={up('password')} />
        {driver ? (
          <>
            <Seg options={[{ k: 'auto', label: 'Auto' }, { k: 'mini', label: 'Mini' }, { k: 'sedan', label: 'Sedan' }]} value={f.vehicle_type} onChange={up('vehicle_type')} />
            <Field label="Vehicle model" placeholder="e.g. Maruti Swift" value={f.vehicle_model} onChangeText={up('vehicle_model')} />
            <Field label="Plate" placeholder="MH12 AB 1234" autoCapitalize="characters" value={f.plate} onChangeText={up('plate')} />
          </>
        ) : null}
      </View>
      <ErrText>{err}</ErrText>
      <View style={{ flex: 1, minHeight: 24 }} />
      <GlassButton title={busy ? 'Creating…' : 'Create account'} onPress={busy ? undefined : submit} />
    </ScrollView>
  );
}
