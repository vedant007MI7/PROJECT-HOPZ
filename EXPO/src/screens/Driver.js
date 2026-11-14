// Driver flow: Home (online/offline) -> Incoming request -> Active trip
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Animated, Easing, ScrollView } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useApp, callNumber } from '../state';
import Glass from '../components/Glass';
import Icon from '../components/Icons';
import { GlassButton, IconButton, Chip, Sheet, Card, Row, H, T, Price } from '../components/UI';
import { C, F, TOP } from '../theme';

export function DriverHome() {
  const { s, setOnline } = useApp();
  const toggle = () => setOnline(!s.online);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, []);
  return (
    <View pointerEvents="box-none" style={{ flex: 1 }}>
      <Row style={{ position: 'absolute', left: 20, right: 20, top: TOP, gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T size={13} color={C.tx2}>Driver mode</T>
          <H size={20}>{s.online ? "You're online" : "You're offline"}</H>
        </View>
        <Chip label={s.online ? 'Online' : 'Offline'} on={s.online} height={46} onPress={toggle} icon={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.online ? C.steel : C.tx2 }} />} style={{ minWidth: 112 }} />
      </Row>
      {s.toast ? (
        <View style={{ position: 'absolute', top: TOP + 62, alignSelf: 'center' }}>
          <Glass variant="amber" radius={999} contentStyle={{ paddingHorizontal: 18, paddingVertical: 10 }}>
            <T weight="b" size={14} color={C.amberText}>+₹{s.lastFare} added to today</T>
          </Glass>
        </View>
      ) : null}
      <Sheet bottom={100}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <T size={13} weight="sb" color={C.tx2}>Today's earnings</T>
            <Price size={34} style={{ marginRight: 0 }}>{s.earn.toLocaleString('en-IN')}</Price>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T size={13} weight="sb" color={C.tx2}>Trips</T>
            <H size={22}>{s.trips}</H>
          </View>
        </Row>
        <Glass variant="mid" radius={14} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
          <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
            {s.online ? (
              <Animated.View style={{ position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: C.steel, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.4] }) }] }} />
            ) : null}
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: s.online ? C.steel : C.tx2 }} />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="b" color={C.tx}>{s.online ? 'Looking for rides…' : 'Go online to get requests'}</T>
            <T size={13} color={C.tx2}>{s.online ? 'New requests appear here automatically' : 'You won\'t get requests while offline'}</T>
          </View>
        </Glass>
        <GlassButton title={s.online ? 'Go offline' : 'Go online'} onPress={toggle} icon={<Icon name="power" color={C.amberText} sw={2} />} />
      </Sheet>
    </View>
  );
}

// What the rider chose, in the driver's words.
const payLine = (r) => (r?.payment_method === 'online'
  ? `Payment: online (the rider pays ₹${r.fare} in the app)`
  : `Payment: cash (collect ₹${r?.fare ?? ''} from the rider)`);

export function DriverRequest() {
  const { s, acceptRequest, declineRequest } = useApp();
  const req = s.req || {};
  const typeName = { auto: 'Hopz Auto', mini: 'Hopz Mini', sedan: 'Hopz Sedan' }[req.vehicle_type] || '';
  const C0 = 2 * Math.PI * 28;
  const km = Number(req.distance_km || 0).toFixed(1);
  const tile = { width: 40, height: 40, borderRadius: 13, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' };
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(25,20,100,0.35)' }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: TOP + 34, left: 0, right: 0, alignItems: 'center' }}>
        <T weight="b" size={12} color={C.tx2} style={{ letterSpacing: 2 }}>NEW RIDE REQUEST</T>
        <View style={{ width: 124, height: 124, marginTop: 14 }}>
          <Svg width={124} height={124} viewBox="0 0 64 64" style={{ transform: [{ rotate: '-90deg' }] }}>
            <Circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
            <Circle cx="32" cy="32" r="28" fill="none" stroke={C.amber} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${C0}`} strokeDashoffset={C0 * (1 - s.left / 15)} />
          </Svg>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <H size={34}>{s.left}</H>
          </View>
        </View>
        <Text style={{ fontFamily: F.hd, fontSize: 48, color: C.tx, marginTop: 12, textShadowColor: 'rgba(255,255,255,0.55)', textShadowRadius: 22, textShadowOffset: { width: 0, height: 0 } }}>₹{req.fare}</Text>
        <T size={14} color={C.tx2} style={{ marginTop: 2 }}>{typeName} · {req.payment_method === 'online' ? 'Online payment' : 'Cash'} · {km} km trip</T>
      </View>
      <Sheet bottom={14} contentStyle={{ gap: 10 }}>
        <Glass variant="blue" radius={18} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
          <View style={tile}><Icon name="pin" color={C.amber} /></View>
          <View style={{ flex: 1 }}>
            <T size={12} weight="sb" color={C.tx2}>Pickup · {Number(req.pickup_distance_km || 0).toFixed(1)} km away</T>
            <T weight="b" color={C.tx} numberOfLines={2}>{req.pickup?.text}</T>
          </View>
        </Glass>
        <Glass variant="pink" radius={18} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
          <View style={tile}><Icon name="car" color={C.amber} /></View>
          <View style={{ flex: 1 }}>
            <T size={12} weight="sb" color={C.tx2}>Drop · {km} km trip</T>
            <T weight="b" color={C.tx} numberOfLines={2}>{req.drop?.text}</T>
          </View>
        </Glass>
        <T weight="sb" size={13} color={C.tx2} style={{ marginHorizontal: 4 }}>{payLine(req)}</T>
        <Row style={{ gap: 10 }}>
          <GlassButton variant="steel" title="Decline" style={{ flex: 1 }} onPress={declineRequest} />
          <GlassButton title="Accept" style={{ flex: 1.6 }} onPress={acceptRequest} />
        </Row>
      </Sheet>
    </View>
  );
}

const STAGES = [
  { kicker: 'Pickup', title: 'Head to pickup', btn: "I've arrived" },
  { kicker: 'Arrived at pickup', title: 'Enter rider PIN', btn: 'Verify & start trip' },
  { kicker: 'Drop-off', title: 'Trip in progress', btn: 'Complete trip' },
];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

function PinEntry() {
  const { s, set } = useApp();
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!s.pinErr) return undefined;
    shake.setValue(0);
    Animated.timing(shake, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [s.pinErr]);
  const press = (k) => {
    if (k === 'C') set({ pin: '', pinErr: false });
    else if (k === '⌫') set({ pin: s.pin.slice(0, -1), pinErr: false });
    else if (s.pin.length < 4) set({ pin: s.pin + k, pinErr: false });
  };
  const dx = shake.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [0, -7, 7, -5, 5, 0] });
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View style={{ alignItems: 'center' }}>
        <T weight="b" size={16}>Ask the rider for their 4-digit PIN</T>
        <T size={12.5} color={C.tx2} style={{ marginTop: 2 }}>The trip can only start with the correct PIN</T>
      </View>
      <Animated.View style={{ flexDirection: 'row', gap: 10, transform: [{ translateX: dx }] }}>
        {[0, 1, 2, 3].map((i) => (
          <Glass key={i} variant="mid" radius={14} style={{ width: 46, height: 52, borderWidth: 0 }}
            contentStyle={{ alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 14, borderColor: s.pinErr ? C.err : i === s.pin.length ? C.amber : 'transparent' }}>
            <Text style={{ fontFamily: F.hd, fontSize: 24, color: C.tx }}>{s.pin[i] || ''}</Text>
          </Glass>
        ))}
      </Animated.View>
      <T weight="sb" size={13} color={C.err} style={{ minHeight: 16, textAlign: 'center' }}>
        {s.pinErr ? s.pinMsg || 'Wrong PIN. Ask the rider to check their PIN.' : ''}
      </T>
      <View style={{ width: '100%', gap: 8 }}>
        {[0, 1, 2, 3].map((r) => (
          <Row key={r} style={{ gap: 8 }}>
            {KEYS.slice(r * 3, r * 3 + 3).map((k) => (
              <GlassButton key={k} variant="steel" title={k} height={44} small style={{ flex: 1 }} onPress={() => press(k)} />
            ))}
          </Row>
        ))}
      </View>
    </View>
  );
}

export function DriverTrip() {
  const { s, markArrived, startTrip, completeTrip, cancelDriverRide } = useApp();
  const [busy, setBusy] = useState(false);
  const st = STAGES[s.stage];
  const addr = s.stage === 2 ? s.ride?.drop?.text : s.ride?.pickup?.text;
  const pinStage = s.stage === 1;
  const advance = async () => {
    if (busy) return;
    if (pinStage && s.pin.length < 4) return;
    setBusy(true);
    await (pinStage ? startTrip() : s.stage === 0 ? markArrived() : completeTrip());
    setBusy(false);
  };
  return (
    <View pointerEvents="box-none" style={{ flex: 1 }}>
      <Card style={{ position: 'absolute', left: 12, right: 12, top: TOP - 6 }} contentStyle={{ paddingVertical: 12, paddingHorizontal: 16 }}>
        <T size={12} weight="sb" color={C.tx2}>{s.stage === 2 ? `Drop · ${s.ride?.drop?.text}` : st.kicker}</T>
        <H size={20}>{st.title}</H>
      </Card>
      <Sheet bottom={14} contentStyle={{ gap: 14 }}>
        <Row style={{ gap: 12 }}>
          <Glass variant="amber" radius={24} style={{ width: 48, height: 48 }} contentStyle={{ alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: F.hd, fontSize: 20, color: C.amberText }}>R</Text>
          </Glass>
          <View style={{ flex: 1 }}>
            <T weight="b" size={17}>{s.ride?.rider?.name || 'Rider'}</T>
            <T size={13} color={C.tx2}>{s.ride?.pickup?.text}</T>
          </View>
          <IconButton name="phone" label="Call rider" onPress={() => callNumber(s.ride?.rider?.phone)} />
          <IconButton name="chat" label="Message rider" />
        </Row>
        <T weight="sb" size={13} color={C.tx2}>{payLine(s.ride)}</T>
        {pinStage ? (
          <PinEntry />
        ) : (
          <Glass variant="mid" radius={14} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
            <Icon name="pin" color={C.tx} />
            <T weight="sb" color={C.tx} style={{ flex: 1 }}>{addr}</T>
            <Price>{s.ride?.fare}</Price>
          </Glass>
        )}
        <View style={{ opacity: pinStage && s.pin.length < 4 ? 0.45 : 1 }}>
          <GlassButton title={busy ? 'Please wait…' : st.btn} onPress={advance} />
        </View>
        {s.stage < 2 ? <GlassButton variant="steel" title="Cancel ride" height={46} small onPress={cancelDriverRide} /> : null}
      </Sheet>
    </View>
  );
}

// Shown after the driver completes the trip: what to expect for the money.
export function DriverDone() {
  const { s, go, flashToast } = useApp();
  const r = s.ride || {};
  const online = r.payment_method === 'online';
  const paid = r.payment_status === 'paid';
  const draw = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(draw, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  const finish = () => {
    go('dHome', { ride: null, stage: 0, pin: '', pinErr: false });
    flashToast(r.fare);
  };
  return (
    <ScrollView contentContainerStyle={{ paddingTop: TOP + 10, paddingHorizontal: 24, paddingBottom: 28, alignItems: 'center', flexGrow: 1 }}>
      <Animated.View style={{ transform: [{ scale: draw.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }], opacity: draw }}>
        <Svg width={96} height={96} viewBox="0 0 96 96">
          <Circle cx="48" cy="48" r="44" fill="none" stroke={C.steel} strokeWidth="5" />
          <Path d="M30 49l13 13 24-26" fill="none" stroke={C.tx} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
      <H size={30} style={{ marginTop: 18, marginBottom: 4 }}>Trip completed</H>
      <T color={C.tx2}>{r.drop?.text}</T>
      <Card style={{ width: '100%', marginTop: 22 }} contentStyle={{ padding: 18, gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}><T color={C.tx2}>Distance</T><T weight="sb">{Number(r.distance_km || 0).toFixed(1)} km</T></Row>
        <View style={{ height: 1, backgroundColor: C.line }} />
        <Row style={{ justifyContent: 'space-between' }}><T weight="b">Fare</T><Price size={24}>{r.fare}</Price></Row>
      </Card>
      <Card style={{ width: '100%', marginTop: 12 }} contentStyle={{ padding: 16, gap: 4 }}>
        <T weight="b">{!online ? `Collect ₹${r.fare} in cash` : paid ? 'Payment received ✓' : 'Waiting for the rider to pay…'}</T>
        <T size={13} color={C.tx2}>
          {!online ? 'The rider chose to pay cash.' : paid ? `The rider paid ₹${r.fare} online.` : 'The rider is paying online in the app. This updates by itself.'}
        </T>
      </Card>
      <View style={{ flex: 1, minHeight: 24 }} />
      <GlassButton title="Done" style={{ width: '100%' }} onPress={finish} />
    </ScrollView>
  );
}
