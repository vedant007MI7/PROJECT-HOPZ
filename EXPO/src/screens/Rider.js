// Rider flow: Home -> Destination -> Ride options -> Searching -> Driver on the way -> Trip -> Done
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Animated, Easing, StyleSheet, Alert } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useApp, callNumber, VEH, SUGGESTIONS, PLACES, baseFare, registerPlace } from '../state';
import { searchPlaces, placeCoords, searchEnabled } from '../places';
import Glass from '../components/Glass';
import Icon, { Star } from '../components/Icons';
import { GlassButton, IconButton, Chip, Sheet, Card, Row, H, T, Price, PressScale } from '../components/UI';
import { C, F, TOP } from '../theme';

// ---------------- Home ----------------
export function RiderHome() {
  const { s, go } = useApp();
  const name = s.user?.name || '';
  return (
    <View pointerEvents="box-none" style={{ flex: 1 }}>
      <Row style={{ position: 'absolute', left: 20, right: 20, top: TOP, gap: 12 }}>
        <IconButton variant="amber" onPress={() => go('profile')} label="Profile">
          <Text style={{ fontFamily: F.hd, fontSize: 18, color: '#fff' }}>{(name[0] || '?').toUpperCase()}</Text>
        </IconButton>
        <View style={{ flex: 1 }}>
          <T size={13} color={C.tx2}>Hey {name.split(' ')[0]}</T>
          <H size={18}>Where to today?</H>
        </View>
        <IconButton name="bell" label="Notifications" />
      </Row>
      <Sheet bottom={100} contentStyle={{ gap: 16 }}>
        <PressScale onPress={() => go('rDest', { q: '', fromRide: false })}>
          <Glass variant="steel" radius={16} style={{ height: 58 }} contentStyle={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 12 }}>
            <Icon name="search" color="#fff" />
            <T weight="b" size={16} color="#fff">Where to?</T>
          </Glass>
        </PressScale>
        <Row style={{ gap: 10 }}>
          {PLACES.map((p) => (
            <Chip key={p.label} label={p.label} height={46} style={{ flex: 1 }} icon={<Icon name="pin" size={18} color="#fff" />} onPress={() => go('rRide', { dest: p.dest })} />
          ))}
        </Row>
        <Glass variant="light" radius={16} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }}>
          <Icon name="shield" color={C.steelText} />
          <View style={{ flex: 1 }}>
            <T weight="b" size={15} color={C.steelText}>Matched with the nearest driver</T>
            <T size={13} color={C.steelText}>Pickup: {s.fix.text}</T>
          </View>
        </Glass>
      </Sheet>
    </View>
  );
}

// ---------------- Destination picker ----------------
export function Destination() {
  const { s, go, set } = useApp();
  const q = (s.q || '').trim().toLowerCase();
  const list = SUGGESTIONS.filter((d) => !q || (d.name + ' ' + d.sub).toLowerCase().includes(q));
  const pick = (name) => go('rRide', { dest: name, q: '' });

  // Live search (Ola Maps), debounced so we don't call it on every keystroke.
  const [found, setFound] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const typed = (s.q || '').trim();
  useEffect(() => {
    if (!searchEnabled || typed.length < 3) { setFound([]); setErr(''); return undefined; }
    let alive = true;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await searchPlaces(typed, s.fix);
        if (alive) { setFound(r); setErr(r.length ? '' : 'No places found'); }
      } catch (e) {
        if (alive) { setFound([]); setErr(`Search failed: ${e.message || 'unknown error'}`); }
      } finally {
        if (alive) setBusy(false);
      }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [typed]);

  const pickFound = async (p) => {
    try {
      const at = p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : await placeCoords(p.id);
      registerPlace({ name: p.name, sub: p.sub, ...at });
      pick(p.name);
    } catch (e) {
      setErr(e.message || 'Could not select that place');
    }
  };
  return (
    <View style={{ flex: 1, paddingTop: TOP - 2, paddingHorizontal: 20 }}>
      <Row style={{ gap: 12, marginBottom: 16 }}>
        <IconButton name="back" label="Back" onPress={() => go(s.fromRide ? 'rRide' : 'rHome')} />
        <H size={24}>Where to?</H>
      </Row>
      <Card style={{ marginBottom: 16 }} contentStyle={{ gap: 12 }}>
        <Row style={{ gap: 12 }}>
          <View style={dot(C.amber)} />
          <T weight="sb" color={C.tx2}>{s.fix.text}</T>
        </Row>
        <Row style={{ gap: 12 }}>
          <View style={[dot(C.steel), { borderRadius: 3 }]} />
          <TextInput
            value={s.q}
            onChangeText={(t) => set({ q: t })}
            placeholder="Search destination"
            placeholderTextColor="rgba(186,199,203,0.7)"
            style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(220,236,246,0.24)', backgroundColor: C.inset, color: C.tx, paddingHorizontal: 14, fontSize: 16, fontFamily: F.m }}
          />
        </Row>
      </Card>
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        {typed.length >= 3 && !searchEnabled && (
          <T size={13} color={C.tx2} style={{ marginHorizontal: 4 }}>Search key not loaded: check EXPO_PUBLIC_OLA_MAPS_KEY in .env, then restart with npx expo start -c</T>
        )}
        {typed.length >= 3 && searchEnabled && (
          <>
            <T weight="b" size={13} color={C.tx2} style={{ marginHorizontal: 4 }}>{busy ? 'Searching…' : 'Search results'}</T>
            {found.map((d) => (
              <PressScale key={d.id || d.name} onPress={() => pickFound(d)} to={0.98}>
                <Glass variant="flat" radius={20} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 13 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="pin" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T weight="b" numberOfLines={1}>{d.name}</T>
                    <T size={13} color={C.tx2} numberOfLines={1}>{d.sub}</T>
                  </View>
                </Glass>
              </PressScale>
            ))}
            {!!err && !busy && <T size={13} color={C.tx2} style={{ marginHorizontal: 4 }}>{err}</T>}
          </>
        )}
        <T weight="b" size={13} color={C.tx2} style={{ marginHorizontal: 4, marginTop: 4 }}>Suggestions</T>
        {list.map((d) => (
          <PressScale key={d.name} onPress={() => pick(d.name)} to={0.98}>
            <Glass variant="flat" radius={20} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 13 }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="pin" />
              </View>
              <View style={{ flex: 1 }}>
                <T weight="b" numberOfLines={1}>{d.name}</T>
                <T size={13} color={C.tx2}>{d.sub}</T>
              </View>
            </Glass>
          </PressScale>
        ))}
      </ScrollView>
    </View>
  );
}
const dot = (c) => ({ width: 10, height: 10, borderRadius: 5, backgroundColor: c });

// ---------------- Ride options ----------------
export function RideOptions() {
  const { s, set, go, vehicle, estimate, requestRide } = useApp();
  const [booking, setBooking] = useState(false);
  return (
    <View pointerEvents="box-none" style={{ flex: 1 }}>
      <Card style={{ position: 'absolute', left: 12, right: 12, top: TOP - 6 }} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
        <IconButton name="back" label="Back" size={40} onPress={() => go('rHome')} />
        <View style={{ alignItems: 'center', gap: 3 }}>
          <View style={dot(C.amber)} />
          <View style={{ width: 2, height: 14, backgroundColor: 'rgba(220,236,246,0.24)' }} />
          <View style={[dot(C.steel), { borderRadius: 3 }]} />
        </View>
        <View style={{ flex: 1, gap: 10 }}>
          <T weight="sb" numberOfLines={1}>{s.fix.text}</T>
          <Pressable onPress={() => go('rDest', { q: '', fromRide: true })}>
            <Row style={{ gap: 8 }}>
              <T weight="b" color={C.amber} numberOfLines={1} style={{ flex: 1 }}>{s.dest}</T>
              <Icon name="edit" size={16} color={C.amber} sw={2} />
            </Row>
          </Pressable>
        </View>
      </Card>
      <Sheet bottom={14} contentStyle={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <H size={18}>Choose your ride</H>
          <T size={13} color={C.tx2}>{vehicle.km.toFixed(1)} km · ~{Math.max(3, Math.round((vehicle.km / 25) * 60))} min</T>
        </Row>
        <View style={{ gap: 8 }}>
          {VEH.map((v) => {
            const on = v.id === s.vehicle;
            return (
              <PressScale key={v.id} onPress={() => set({ vehicle: v.id })} to={0.98}>
                <Glass variant={on ? 'steel' : 'mid'} radius={14} style={on ? { borderRadius: 14 } : null} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 }}>
                  <View style={{ width: 54, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={v.icon} size={30} color="#fff" sw={1.6} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T weight="b" size={16} color="#fff">{v.name}</T>
                    <T size={13} color="#DCE6EA">{v.sub}</T>
                  </View>
                  <Price size={16}>{estimate(v.id)}</Price>
                </Glass>
              </PressScale>
            );
          })}
        </View>
        <Row style={{ gap: 8 }}>
          <Chip label="Cash" on={s.payMethod === 'cash'} height={44} style={{ flex: 1 }} onPress={() => set({ payMethod: 'cash' })} />
          <Chip label="Pay online" on={s.payMethod === 'online'} height={44} style={{ flex: 1 }} onPress={() => set({ payMethod: 'online' })} />
        </Row>
        <GlassButton title={booking ? 'Booking…' : `Confirm ${vehicle.name} · ₹${vehicle.fare}`} onPress={booking ? undefined : async () => { setBooking(true); await requestRide(); setBooking(false); }} />
      </Sheet>
    </View>
  );
}

// ---------------- Searching ----------------
export function Searching() {
  const { s, vehicle, cancelRide } = useApp();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, []);
  return (
    <View pointerEvents="box-none" style={{ flex: 1 }}>
      <Sheet bottom={14} contentStyle={{ gap: 16 }}>
        <Row style={{ gap: 14 }}>
          <View style={{ width: 48, height: 48 }}>
            <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: C.steel, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] }) }] }} />
            <View style={{ position: 'absolute', left: 12, top: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: C.amber }} />
          </View>
          <View style={{ flex: 1 }}>
            <H size={20}>Finding your driver</H>
            <T size={14} color={C.tx2}>Matching you with the nearest {vehicle.name}</T>
          </View>
        </Row>
        <View style={{ gap: 8 }}>
          <View style={{ height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <View style={{ height: 12, width: '70%', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        </View>
        <Row style={{ justifyContent: 'space-between' }}>
          <T color={C.tx2}>{s.dest}</T>
          <Price>{vehicle.fare}</Price>
        </Row>
        <GlassButton variant="steel" title="Cancel request" onPress={cancelRide} />
      </Sheet>
    </View>
  );
}

const DriverRow = ({ driver }) => (
  <Row style={{ gap: 14 }}>
    <Glass variant="amber" radius={28} style={{ width: 56, height: 56 }} contentStyle={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: F.hd, fontSize: 22, color: '#fff' }}>{(driver?.name || '?')[0].toUpperCase()}</Text>
    </Glass>
    <View style={{ flex: 1 }}>
      <T weight="b" size={17}>{driver?.name}</T>
      <T size={13} color={C.tx2}>{driver?.vehicle_model || 'Hopz driver'}</T>
    </View>
    <View style={{ alignItems: 'flex-end' }}>
      <T weight="b" size={15} style={{ letterSpacing: 0.6 }}>{driver?.plate || ''}</T>
      <T size={12} color={C.tx2}>{driver?.phone || ''}</T>
    </View>
  </Row>
);

// ---------------- Driver on the way ----------------
export function DriverEnRoute() {
  const { s, cancelRide } = useApp();
  const here = s.ride?.status === 'arrived';
  return (
    <View pointerEvents="box-none" style={{ flex: 1 }}>
      <Sheet bottom={14} contentStyle={{ gap: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <H size={20}>{here ? 'Your driver is here' : 'Driver is on the way'}</H>
          <Glass variant="light" radius={999} contentStyle={{ paddingHorizontal: 12, paddingVertical: 6 }}>
            <T weight="b" size={13} color={C.steelText}>{here ? 'Arrived' : 'On the way'}</T>
          </Glass>
        </Row>
        <DriverRow driver={s.ride?.driver} />
        <Row style={{ gap: 10, alignItems: 'stretch' }}>
          <Glass variant="mid" radius={16} style={{ flex: 1 }} contentStyle={{ paddingVertical: 10, paddingHorizontal: 14 }}>
            <T size={12} weight="sb" color={C.tx2}>Your ride PIN · driver enters it to start</T>
            <Text style={{ fontFamily: F.hd, fontSize: 26, color: C.tx, letterSpacing: 10, marginTop: 2 }}>{s.ride?.start_pin}</Text>
          </Glass>
          <IconButton name="phone" label="Call driver" size={56} onPress={() => callNumber(s.ride?.driver?.phone)} />
          <IconButton name="chat" label="Message driver" size={56} />
        </Row>
        <Row style={{ gap: 10 }}>
          <GlassButton variant="steel" title="Cancel ride" height={52} small style={{ flex: 1 }} onPress={cancelRide} />
        </Row>
      </Sheet>
    </View>
  );
}

// ---------------- Trip in progress ----------------
export function Trip() {
  const { s, vehicle } = useApp();
  const totalKm = s.ride?.distance_km || 1;
  const mins = Math.max(1, Math.ceil(((100 - s.progress) / 100) * Math.max(3, (totalKm / 25) * 60)));
  const km = Math.max(0.2, ((100 - s.progress) / 100) * totalKm).toFixed(1);
  return (
    <View pointerEvents="box-none" style={{ flex: 1 }}>
      <Card style={{ position: 'absolute', left: 12, right: 12, top: TOP - 6 }} contentStyle={{ paddingVertical: 12, paddingHorizontal: 16 }}>
        <T size={12} weight="sb" color={C.tx2}>On trip to</T>
        <T weight="b" size={16} numberOfLines={1}>{s.dest}</T>
      </Card>
      <Sheet bottom={14} contentStyle={{ gap: 14 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <H size={26}>{mins} min</H>
          <T size={14} color={C.tx2}>{km} km left</T>
        </Row>
        <View style={{ height: 8, borderRadius: 8, backgroundColor: 'rgba(8,18,26,0.5)', overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${s.progress}%`, borderRadius: 8, backgroundColor: C.amber }} />
        </View>
        <Row style={{ gap: 12 }}>
          <Glass variant="amber" radius={22} style={{ width: 44, height: 44 }} contentStyle={{ alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: F.hd, color: '#fff' }}>{(s.ride?.driver?.name || '?')[0].toUpperCase()}</Text>
          </Glass>
          <View style={{ flex: 1 }}>
            <T weight="b">{s.ride?.driver?.name} · {s.ride?.driver?.vehicle_model}</T>
            <T size={13} color={C.tx2}>{s.ride?.driver?.plate}</T>
          </View>
          <Price size={16}>{vehicle.fare}</Price>
        </Row>
        <Row style={{ gap: 10 }}>
          <GlassButton variant="steel" title="Share trip" height={52} small style={{ flex: 1 }} icon={<Icon name="share" size={18} color="#fff" />} />
          <GlassButton variant="steel" title="Safety" height={52} small style={{ flex: 1 }} icon={<Icon name="shield" size={18} color="#fff" />} />
        </Row>
      </Sheet>
    </View>
  );
}

// ---------------- Trip complete ----------------
export function TripDone() {
  const { s, set, vehicle, finishRide, startPayment } = useApp();
  const [saving, setSaving] = useState(false);
  const online = s.ride?.payment_method === 'online';
  const paid = s.ride?.payment_status === 'paid';
  const done = async () => { setSaving(true); await finishRide(); setSaving(false); };
  const fare = vehicle.fare;
  const base = baseFare(vehicle.id);
  const dist = fare - base;
  const draw = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(draw, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  const tips = [0, 10, 20, 50];
  return (
    <ScrollView contentContainerStyle={{ paddingTop: TOP + 10, paddingHorizontal: 24, paddingBottom: 28, alignItems: 'center', flexGrow: 1 }}>
      <Animated.View style={{ transform: [{ scale: draw.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }], opacity: draw }}>
        <Svg width={96} height={96} viewBox="0 0 96 96">
          <Circle cx="48" cy="48" r="44" fill="none" stroke={C.steel} strokeWidth="5" />
          <Path d="M30 49l13 13 24-26" fill="none" stroke={C.tx} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
      <H size={30} style={{ marginTop: 18, marginBottom: 4 }}>You've arrived</H>
      <T color={C.tx2}>{s.ride?.drop?.text || s.dest}</T>
      <Card style={{ width: '100%', marginTop: 22 }} contentStyle={{ padding: 18, gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}><T color={C.tx2}>Base fare</T><Price size={15} style={{ color: C.tx2, fontFamily: F.r }}>{base}</Price></Row>
        <Row style={{ justifyContent: 'space-between' }}><T color={C.tx2}>Distance ({vehicle.km.toFixed(1)} km)</T><Price size={15} style={{ color: C.tx2, fontFamily: F.r }}>{dist}</Price></Row>
        <View style={{ height: 1, backgroundColor: 'rgba(220,236,246,0.24)' }} />
        <Row style={{ justifyContent: 'space-between' }}><T weight="b">Total</T><Price size={24}>{fare}</Price></Row>
      </Card>
      {online && !paid ? (
        <GlassButton title={`Pay ₹${fare} online`} style={{ width: '100%', marginTop: 16 }} onPress={startPayment} />
      ) : (
        <Card style={{ width: '100%', marginTop: 12 }} contentStyle={{ padding: 14 }}>
          <T weight="sb">{online ? 'Paid online ✓' : `Pay ₹${fare} in cash to your driver`}</T>
        </Card>
      )}
      <T weight="b" style={{ marginTop: 22 }}>Rate {s.ride?.driver?.name?.split(' ')[0] || 'your driver'}</T>
      <Row style={{ gap: 6, marginTop: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => set({ rating: n })} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', transform: [{ scale: n === s.rating ? 1.15 : 1 }] }}>
            <Star size={36} filled={n <= s.rating} color={n <= s.rating ? C.amber : C.tx2} />
          </Pressable>
        ))}
      </Row>
      <Row style={{ gap: 8, marginTop: 10, width: '100%' }}>
        {tips.map((t) => (
          <Chip key={t} label={t === 0 ? 'No tip' : `₹${t}`} on={s.tip === t} height={44} style={{ flex: 1 }} onPress={() => set({ tip: t })} />
        ))}
      </Row>
      <View style={{ flex: 1, minHeight: 24 }} />
      <GlassButton title={saving ? 'Saving…' : 'Complete'} style={{ width: '100%' }} onPress={saving ? undefined : () => (online && !paid
        ? Alert.alert('Payment pending', 'You have not paid for this ride yet.', [{ text: 'Back', style: 'cancel' }, { text: 'Leave anyway', onPress: done }])
        : done())} />
    </ScrollView>
  );
}
