// Activity (rider), Earnings (driver), Profile (both)
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, ScrollView, Animated, Easing, Pressable } from 'react-native';
import { useApp } from '../state';
import { api } from '../api';
import Glass from '../components/Glass';
import Icon from '../components/Icons';
import { GlassButton, Card, Row, H, T, Price } from '../components/UI';
import { C, F, TOP } from '../theme';

const VEH_LABEL = { auto: 'Auto', mini: 'Mini', sedan: 'Sedan' };
const fmtWhen = (iso) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// Loads once on mount; shows nothing until the data (or an error) arrives.
function useLoad(fn) {
  const [state, setState] = useState({ data: null, err: '' });
  useEffect(() => {
    let live = true;
    fn().then((data) => live && setState({ data, err: '' })).catch((e) => live && setState({ data: null, err: e.message }));
    return () => { live = false; };
  }, []);
  return state;
}
const Empty = ({ children }) => <T color={C.tx2} style={{ textAlign: 'center', marginTop: 20 }}>{children}</T>;

export function Activity() {
  const { data, err } = useLoad(() => api.rides('?status=completed&limit=50'));
  const trips = data || [];
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonth = trips.filter((r) => new Date(r.completed_at) >= monthStart);
  const spent = thisMonth.reduce((a, r) => a + r.fare, 0);
  return (
    <ScrollView contentContainerStyle={{ paddingTop: TOP + 6, paddingHorizontal: 20, paddingBottom: 130, gap: 10 }}>
      <H size={32} style={{ marginBottom: 6 }}>Activity</H>
      <Row style={{ gap: 10, marginBottom: 6 }}>
        <Card style={{ flex: 1 }}>
          <T size={12} weight="sb" color={C.tx2}>Trips this month</T>
          <H size={26}>{thisMonth.length}</H>
        </Card>
        <Card style={{ flex: 1 }}>
          <T size={12} weight="sb" color={C.tx2}>Spent</T>
          <Price size={26} style={{ fontFamily: F.b }}>{spent.toLocaleString('en-IN')}</Price>
        </Card>
      </Row>
      {err ? <Empty>{err}</Empty> : data && !trips.length ? <Empty>No completed trips yet.</Empty> : null}
      {trips.map((r) => (
        <Card key={r.id} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="pin" />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="b" numberOfLines={1}>{r.drop.text}</T>
            <T size={13} color={C.tx2}>{fmtWhen(r.completed_at)} · {VEH_LABEL[r.vehicle_type]}</T>
          </View>
          <Price>{r.fare}</Price>
        </Card>
      ))}
    </ScrollView>
  );
}

export function Earnings() {
  const { data, err } = useLoad(() => api.earnings());
  const rides = data?.rides || [];
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  // Monday-first weekday index, in Asia/Kolkata like the backend's "today"/"week".
  const dayIdx = (iso) => (new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getDay() + 6) % 7;
  const vals = days.map(() => 0);
  rides.forEach((r) => { vals[dayIdx(r.completed_at)] += r.fare; });
  const todayIdx = dayIdx(new Date().toISOString());
  const maxV = Math.max(1400, ...vals);
  const total = (data?.week || 0).toLocaleString('en-IN');
  return (
    <ScrollView contentContainerStyle={{ paddingTop: TOP + 6, paddingHorizontal: 20, paddingBottom: 130, gap: 10 }}>
      <H size={32}>Earnings</H>
      <T color={C.tx2} style={{ marginBottom: 6 }}>This week</T>
      <Card contentStyle={{ padding: 18 }}>
        <Price size={36} style={{ marginRight: 0 }}>{total}</Price>
        <Row style={{ alignItems: 'flex-end', gap: 10, height: 140, marginTop: 18 }}>
          {days.map((d, i) => (
            <Bar key={i} label={d} ratio={Math.max(0.05, vals[i] / maxV)} today={i === todayIdx} delay={i * 70} />
          ))}
        </Row>
      </Card>
      {err ? <Empty>{err}</Empty> : data && !rides.length ? <Empty>No completed rides this week.</Empty> : null}
      {rides.map((r) => (
        <Card key={r.id} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flex: 1 }}>
            <T weight="b" numberOfLines={1}>{r.pickup.text} → {r.drop.text}</T>
            <T size={13} color={C.tx2}>{fmtWhen(r.completed_at)}</T>
          </View>
          <Price>{r.fare}</Price>
        </Card>
      ))}
    </ScrollView>
  );
}

function Bar({ label, ratio, today, delay }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 800, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, []);
  return (
    <View style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
      <Animated.View style={{ width: '100%', borderRadius: 10, backgroundColor: today ? C.amber : C.steel, height: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.round(ratio * 88)}%`] }) }} />
      <T size={12} weight="sb" color={C.tx2}>{label}</T>
    </View>
  );
}

export function Profile() {
  const { s, logout } = useApp();
  const rider = s.role === 'rider';
  const u = s.user || {};
  const { data: rides } = useLoad(() => api.rides('?status=completed&limit=100'));
  const { data: me } = useLoad(() => (rider ? Promise.resolve(null) : api.me()));
  const rating = me?.driver_profile?.rating;
  const rows = rider ? ['Payment methods', 'Saved places', 'Safety & trusted contacts', 'Help & support'] : ['Vehicle & documents', 'Payout account', 'Ride preferences', 'Help & support'];
  return (
    <ScrollView contentContainerStyle={{ paddingTop: TOP + 6, paddingHorizontal: 20, paddingBottom: 130, gap: 14 }}>
      <Row style={{ gap: 16 }}>
        <Glass variant="amber" radius={36} style={{ width: 72, height: 72 }} contentStyle={{ alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.hd, fontSize: 30, color: '#fff' }}>{(u.name || '?')[0].toUpperCase()}</Text>
        </Glass>
        <View>
          <H size={24}>{u.name}</H>
          <T color={C.tx2} size={14}>{(rider ? 'Rider' : 'Driver') + (u.phone ? ' · ' + u.phone : '')}</T>
        </View>
      </Row>
      <Row style={{ gap: 10 }}>
        {[...(rider ? [] : [[rating?.average != null ? rating.average.toFixed(1) + ' ★' : '–', rating?.count ? `Rating (${rating.count})` : 'Rating']]), [rides ? String(rides.length) : '–', 'Trips'], [u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '–', 'Joined']].map(([a, b]) => (
          <Card key={b} style={{ flex: 1 }} contentStyle={{ alignItems: 'center', padding: 12 }}>
            <H size={20}>{a}</H>
            <T size={12} color={C.tx2}>{b}</T>
          </Card>
        ))}
      </Row>
      <Card contentStyle={{ padding: 4 }}>
        {rows.map((r) => (
          <Pressable key={r} style={{ flexDirection: 'row', alignItems: 'center', padding: 15 }}>
            <T weight="sb" style={{ flex: 1 }}>{r}</T>
            <Icon name="chevron" size={18} color={C.tx2} />
          </Pressable>
        ))}
        <Pressable onPress={logout} style={{ padding: 15 }}>
          <T weight="b" color={C.tx2}>Log out</T>
        </Pressable>
      </Card>
    </ScrollView>
  );
}
