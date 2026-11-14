// Splash, Login, Sign up
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Animated, Easing, Pressable, StyleSheet, Dimensions, ScrollView, Alert } from 'react-native';
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

const ErrText = ({ children }) => (children ? <T color={C.err} size={14} style={{ marginTop: 12 }}>{children}</T> : null);

export function Login() {
  const { s, go, set, startSession } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, err, submit } = useSubmit(startSession, () => api.login(email.trim(), password));
  return (
    <ScrollView contentContainerStyle={{ paddingTop: TOP + 30, paddingHorizontal: 22, paddingBottom: 28, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center' }}>
        <Logo width={150} />
        <H size={30} style={{ marginTop: 26, textAlign: 'center' }}>Welcome back</H>
        <T color={C.tx2} style={{ marginTop: 6, marginBottom: 6, textAlign: 'center' }}>Log in to book a hop or start driving.</T>
      </View>
      <View style={{ gap: 14, marginTop: 28 }}>
        <Field icon="user" label="Email or mobile number" placeholder="you@example.com or 98765 43210" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} />
        <Field icon="shield" label="Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />
      </View>
      <ErrText>{err}</ErrText>
      <Pressable onPress={() => { set({ resetId: email.trim() }); go('forgot'); }}>
        <T weight="b" size={14} color={C.amber} style={{ textAlign: 'right', marginTop: 12, marginBottom: 22 }}>Forgot password?</T>
      </Pressable>
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

// Forgot password, step 1: ask for the phone number (or email) and send a 6-digit code.
export function ForgotPassword() {
  const { s, go, set } = useApp();
  const [id, setId] = useState(s.resetId || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const send = async () => {
    if (!id.trim()) return setErr('Enter your mobile number or email');
    setBusy(true);
    setErr('');
    try {
      await api.forgotPassword(id.trim());
      set({ resetId: id.trim() });
      go('reset');
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };
  return (
    <ScrollView contentContainerStyle={{ paddingTop: TOP - 2, paddingHorizontal: 24, paddingBottom: 28, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <IconButton name="back" label="Back" onPress={() => go('login')} />
      <H size={32} style={{ marginTop: 22, marginBottom: 6 }}>Forgot password?</H>
      <T color={C.tx2} style={{ marginBottom: 24 }}>Enter your mobile number and we'll send you a 6-digit code. You can use your email instead.</T>
      <Field label="Mobile number or email" placeholder="98765 43210 or you@example.com" autoCapitalize="none" autoCorrect={false} value={id} onChangeText={setId} />
      <ErrText>{err}</ErrText>
      <View style={{ flex: 1, minHeight: 24 }} />
      <GlassButton title={busy ? 'Sending…' : 'Send code'} onPress={busy ? undefined : send} />
    </ScrollView>
  );
}

// Step 2: the code and a new password.
export function ResetPassword() {
  const { s, go } = useApp();
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const submit = async () => {
    if (!/^\d{6}$/.test(code.trim())) return setErr('Enter the 6-digit code');
    if (pw.length < 8) return setErr('Password must be at least 8 characters');
    setBusy(true);
    setErr('');
    try {
      await api.resetPassword({ identifier: s.resetId, code: code.trim(), new_password: pw });
      Alert.alert('Password updated', 'You can log in with your new password now.');
      go('login');
      return;
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };
  const resend = async () => {
    setNote('');
    setErr('');
    try {
      await api.forgotPassword(s.resetId);
      setNote('If a code was not sent just now, wait a minute and try again.');
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <ScrollView contentContainerStyle={{ paddingTop: TOP - 2, paddingHorizontal: 24, paddingBottom: 28, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <IconButton name="back" label="Back" onPress={() => go('forgot')} />
      <H size={32} style={{ marginTop: 22, marginBottom: 6 }}>Enter the code</H>
      <T color={C.tx2} style={{ marginBottom: 24 }}>We sent a 6-digit code to {s.resetId}. It works for 10 minutes.</T>
      <View style={{ gap: 16 }}>
        <Field label="6-digit code" placeholder="123456" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
        <Field label="New password" placeholder="At least 8 characters" secureTextEntry value={pw} onChangeText={setPw} />
      </View>
      <ErrText>{err}</ErrText>
      {note ? <T color={C.tx2} size={13} style={{ marginTop: 12 }}>{note}</T> : null}
      <Pressable onPress={resend}>
        <T weight="b" size={14} color={C.amber} style={{ textAlign: 'right', marginTop: 12 }}>Resend code</T>
      </Pressable>
      <View style={{ flex: 1, minHeight: 24 }} />
      <GlassButton title={busy ? 'Updating…' : 'Reset password'} onPress={busy ? undefined : submit} />
    </ScrollView>
  );
}
