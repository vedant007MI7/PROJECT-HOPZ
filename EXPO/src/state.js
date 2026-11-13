import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import { api, setToken, loadToken, hasToken, setUnauthorizedHandler } from './api';

// ---------- places & pricing (fare is only an estimate; the server computes the real one) ----------
// Fallback when GPS is denied or unavailable: a fixed Koregaon Park point.
export const HOME = { text: 'Koregaon Park, Pune', lat: 18.5362, lng: 73.894 };

// Current GPS fix as { text, lat, lng }, or HOME if permission is denied / no fix.
export async function currentPlace() {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return HOME;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude: lat, longitude: lng } = pos.coords;
    let text = 'Current location';
    try {
      const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const parts = [a?.name, a?.district || a?.subregion, a?.city].filter(Boolean);
      if (parts.length) text = parts.join(', ');
    } catch {
      // Geocoding is optional; keep the generic label.
    }
    return { text, lat, lng };
  } catch {
    return HOME;
  }
}

export const VEH = [
  { id: 'auto', name: 'Hopz Auto', sub: '3 seats', icon: 'auto' },
  { id: 'mini', name: 'Hopz Mini', sub: '4 seats', icon: 'car' },
  { id: 'sedan', name: 'Hopz Sedan', sub: '4 seats', icon: 'car' },
];
const RATES = { auto: { base: 30, perKm: 12 }, mini: { base: 50, perKm: 14 }, sedan: { base: 80, perKm: 18 } };
export const baseFare = (type) => RATES[type].base;
export const estimateFare = (type, km) => Math.round(RATES[type].base + RATES[type].perKm * km);

const toRad = (d) => (d * Math.PI) / 180;
export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export const SUGGESTIONS = [
  { name: 'Phoenix Marketcity', sub: 'Viman Nagar', lat: 18.5619, lng: 73.9168 },
  { name: 'Magarpatta City', sub: 'Hadapsar', lat: 18.5158, lng: 73.9272 },
  { name: 'Pune Airport', sub: 'Lohegaon', lat: 18.5793, lng: 73.9089 },
  { name: 'FC Road', sub: 'Deccan', lat: 18.5236, lng: 73.8412 },
  { name: 'Baner Road', sub: 'Baner', lat: 18.559, lng: 73.7868 },
  { name: 'Shaniwar Wada', sub: 'Old city', lat: 18.5195, lng: 73.8553 },
  { name: 'Hinjewadi IT Park', sub: 'Phase 1', lat: 18.5912, lng: 73.7389 },
  { name: 'Viman Nagar', sub: 'Pune', lat: 18.5679, lng: 73.9143 },
  // Udaipur, so testing at home gives short, realistic rides.
  { name: 'City Palace', sub: 'Udaipur', lat: 24.5764, lng: 73.6835 },
  { name: 'Lake Pichola', sub: 'Udaipur', lat: 24.5732, lng: 73.679 },
  { name: 'Fateh Sagar Lake', sub: 'Udaipur', lat: 24.5967, lng: 73.6724 },
  { name: 'Udaipur City Station', sub: 'Udaipur', lat: 24.5748, lng: 73.704 },
  { name: 'Sukhadia Circle', sub: 'Udaipur', lat: 24.5873, lng: 73.6916 },
  { name: 'Saheliyon Ki Bari', sub: 'Udaipur', lat: 24.5995, lng: 73.6834 },
];
export const PLACES = [
  { label: 'Home', dest: 'Baner Road' },
  { label: 'Work', dest: 'Magarpatta City' },
  { label: 'Gym', dest: 'Viman Nagar' },
];
export const placeByName = (name) => SUGGESTIONS.find((p) => p.name === name) || SUGGESTIONS[0];

// ---------- how a ride's server status maps to a screen ----------
const RIDER_SCREEN = { requested: 'rSearch', accepted: 'rDriver', arrived: 'rDriver', started: 'rTrip', completed: 'rDone' };
const DRIVER_STAGE = { accepted: 0, arrived: 1, started: 2 };
const RIDER_LIVE = ['rSearch', 'rDriver', 'rTrip'];
const POLL_MS = 2500;

// Opens the phone's dialer.
export function callNumber(phone) {
  if (!phone) return Alert.alert('No phone number', 'This person has not added a phone number.');
  Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Cannot place call', 'This device cannot open the dialer.'));
}

const istDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// ---------- app state ----------
const INIT = {
  user: null, screen: 'splash', role: 'rider', authRole: 'rider',
  vehicle: 'mini', dest: 'Phoenix Marketcity', q: '', fromRide: false,
  ride: null, req: null, progress: 0, rating: 4, tip: 0,
  online: false, quiet: false, left: 15, stage: 0, earn: 0, trips: 0, toast: false, lastFare: 0,
  pin: '', pinErr: false, pinMsg: '',
  fix: HOME, fixed: false, // rider's current GPS place, and whether it has been read yet
  checking: false, offline: false, // a saved login is being checked / the server could not be reached
};

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [s, setS] = useState(INIT);
  const sRef = useRef(s);
  sRef.current = s;
  const toastTimer = useRef(null);
  const dismissed = useRef(new Set());

  const set = (p) => setS((o) => ({ ...o, ...p }));
  const go = (screen, extra = {}) => setS((o) => ({ ...o, quiet: false, screen, ...extra }));
  const fail = (title) => (e) => Alert.alert(title, e.message);

  // Estimate before booking, the server's own numbers once a ride exists.
  const km = s.ride ? s.ride.distance_km : haversineKm(s.fix, placeByName(s.dest));
  const vehicle = (() => {
    const v = VEH.find((x) => x.id === (s.ride ? s.ride.vehicle_type : s.vehicle)) || VEH[1];
    return { ...v, fare: s.ride ? s.ride.fare : estimateFare(v.id, km), km };
  })();
  const estimate = (id) => estimateFare(id, haversineKm(s.fix, placeByName(s.dest)));

  // ----- rider's real position: used for fare estimates, and to default the destination to the nearest suggestion -----
  useEffect(() => {
    if (s.role !== 'rider' || !s.user || s.fixed) return;
    let alive = true;
    currentPlace().then((fix) => {
      if (!alive) return;
      const nearest = SUGGESTIONS.reduce((a, b) => (haversineKm(fix, b) < haversineKm(fix, a) ? b : a));
      setS((o) => (o.fixed ? o : { ...o, fix, fixed: true, dest: o.dest === INIT.dest ? nearest.name : o.dest }));
    });
    return () => { alive = false; };
  }, [s.role, s.user, s.fixed]);

  // ----- session -----
  const startSession = async ({ user, token }) => {
    setToken(token);
    dismissed.current = new Set();
    const next = { user, role: user.role, quiet: true, online: false, ride: null, req: null };
    let screen = user.role === 'rider' ? 'rHome' : 'dHome';
    try {
      if (user.role === 'driver') {
        const me = await api.me();
        next.online = !!me.driver_profile?.is_online;
      }
      // Pick up a ride that is still running (e.g. after the app was reloaded).
      const live = user.role === 'driver' ? ['accepted', 'arrived', 'started'] : ['requested', 'accepted', 'arrived', 'started'];
      const active = (await api.rides('?limit=10')).find((r) => live.includes(r.status));
      if (active) {
        next.ride = active;
        if (user.role === 'driver') Object.assign(next, { stage: DRIVER_STAGE[active.status], pin: '', pinErr: false });
        else Object.assign(next, { dest: active.drop.text, vehicle: active.vehicle_type });
        screen = user.role === 'driver' ? 'dTrip' : RIDER_SCREEN[active.status];
      }
    } catch {
      // Fall back to the home screen; the first poll will sort it out.
    }
    go(screen, next);
  };

  const logout = () => {
    setToken(null); // also clears the stored token
    dismissed.current = new Set();
    go('login', { user: null, ride: null, req: null, online: false });
  };

  // ----- rider actions -----
  const requestRide = async () => {
    const d = placeByName(s.dest);
    try {
      const pickup = await currentPlace();
      const ride = await api.createRide({ pickup, drop: { text: d.name, lat: d.lat, lng: d.lng }, vehicle_type: s.vehicle });
      go('rSearch', { ride });
    } catch (e) {
      fail('Could not book')(e);
    }
  };

  const cancelRide = async () => {
    try {
      await api.cancel(s.ride.id);
      go('rHome', { ride: null });
    } catch (e) {
      fail('Could not cancel')(e);
    }
  };

  const finishRide = async () => {
    const { ride, rating, tip } = sRef.current;
    try {
      await api.rate(ride.id, { stars: rating, tip });
    } catch (e) {
      // Already rated is fine; anything else the rider should see.
      if (!/already/i.test(e.message)) return fail('Could not save rating')(e);
    }
    go('rHome', { ride: null, rating: 4, tip: 0 });
  };

  // ----- driver actions -----
  const setOnline = async (on) => {
    try {
      if (on) {
        const here = await currentPlace();
        await api.location(here.lat, here.lng);
      }
      await api.setOnline(on);
      set({ online: on, quiet: false });
    } catch (e) {
      fail(on ? 'Could not go online' : 'Could not go offline')(e);
    }
  };

  const acceptRequest = async () => {
    try {
      const ride = await api.accept(s.req.id);
      go('dTrip', { ride, req: null, stage: 0, pin: '', pinErr: false });
    } catch (e) {
      fail('Could not accept')(e);
      go('dHome', { req: null });
    }
  };

  const declineRequest = () => {
    const id = s.req.id;
    dismissed.current.add(id);
    go('dHome', { req: null });
    api.decline(id).catch(() => {});
  };

  const markArrived = async () => {
    try {
      set({ ride: await api.arrived(s.ride.id), stage: 1 });
    } catch (e) {
      fail('Could not update')(e);
    }
  };

  const startTrip = async () => {
    try {
      set({ ride: await api.start(s.ride.id, s.pin), stage: 2, pin: '', pinErr: false, pinMsg: '' });
    } catch (e) {
      set({ pinErr: true, pinMsg: e.message, pin: '' });
    }
  };

  const completeTrip = async () => {
    try {
      const done = await api.complete(s.ride.id);
      go('dHome', { ride: null, stage: 0, pin: '', pinErr: false });
      flashToast(done.fare);
    } catch (e) {
      fail('Could not complete')(e);
    }
  };

  const cancelDriverRide = async () => {
    try {
      await api.cancel(s.ride.id);
      go('dHome', { ride: null, stage: 0 });
    } catch (e) {
      fail('Could not cancel')(e);
    }
  };

  const loadStats = async () => {
    try {
      const e = await api.earnings();
      const today = istDay(new Date().toISOString());
      set({ earn: e.today, trips: e.rides.filter((r) => istDay(r.completed_at) === today).length });
    } catch {
      // Keep whatever is on screen.
    }
  };

  function flashToast(fare) {
    set({ toast: true, lastFare: fare });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => set({ toast: false }), 3200);
  }

  // ----- driver GPS: while online, send the real position every 5 s (also during a trip) -----
  useEffect(() => {
    if (s.role !== 'driver' || !s.online) return undefined;
    let alive = true;
    const send = async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (alive) await api.location(pos.coords.latitude, pos.coords.longitude);
      } catch {
        // Missed one beat; the next tick retries.
      }
    };
    const iv = setInterval(send, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, [s.role, s.online]);

  // ----- polling: the server decides what screen each phone is on -----
  useEffect(() => {
    let alive = true;
    const stops = [];
    const poll = (fn) => {
      const run = () => fn().catch(() => {});
      run();
      const iv = setInterval(run, POLL_MS);
      stops.push(() => clearInterval(iv));
    };

    if (s.role === 'rider' && s.ride && RIDER_LIVE.includes(s.screen)) {
      poll(async () => {
        const ride = await api.ride(s.ride.id);
        if (!alive) return;
        if (ride.status === 'cancelled') {
          if (ride.cancelled_by === 'system') Alert.alert('No drivers found', 'No driver accepted your request. Please try again in a moment.');
          else Alert.alert('Ride cancelled', ride.cancelled_by === 'driver' ? 'Your driver cancelled this ride.' : 'This ride was cancelled.');
          return go('rHome', { ride: null });
        }
        const next = RIDER_SCREEN[ride.status];
        setS((o) => (o.ride?.id !== ride.id || !RIDER_LIVE.includes(o.screen) ? o : o.screen === next ? { ...o, ride } : { ...o, ride, quiet: false, screen: next }));
      });
    } else if (s.screen === 'dHome' && s.role === 'driver') {
      loadStats();
      if (s.online) {
        poll(async () => {
          const list = await api.requests();
          if (!alive) return;
          const pick = list.find((r) => !dismissed.current.has(r.id));
          if (pick) setS((o) => (o.screen === 'dHome' ? { ...o, quiet: false, screen: 'dRequest', req: pick, left: 15 } : o));
        });
      }
    } else if (s.screen === 'dRequest') {
      // Leave if someone else took it / the rider cancelled; run the countdown.
      poll(async () => {
        const list = await api.requests();
        if (!alive) return;
        if (!list.some((r) => r.id === sRef.current.req?.id)) setS((o) => (o.screen === 'dRequest' ? { ...o, screen: 'dHome', req: null } : o));
      });
      const tick = setInterval(() => {
        const o = sRef.current;
        if (o.left <= 1) {
          dismissed.current.add(o.req?.id);
          setS((p) => ({ ...p, screen: 'dHome', req: null, left: 15 }));
        } else {
          setS((p) => ({ ...p, left: p.left - 1 }));
        }
      }, 1000);
      stops.push(() => clearInterval(tick));
    } else if (s.screen === 'dTrip' && s.ride) {
      poll(async () => {
        const ride = await api.ride(s.ride.id);
        if (!alive) return;
        if (ride.status === 'cancelled') {
          Alert.alert('Ride cancelled', 'The rider cancelled this ride.');
          go('dHome', { ride: null, stage: 0 });
        }
      });
    }

    if (s.screen === 'rTrip' && s.ride?.started_at) {
      // Rough progress: elapsed time against a ~25 km/h average.
      const prog = setInterval(() => {
        setS((o) => {
          if (!o.ride?.started_at) return o;
          const total = Math.max(180, (o.ride.distance_km / 25) * 3600);
          const elapsed = (Date.now() - new Date(o.ride.started_at).getTime()) / 1000;
          return { ...o, progress: Math.min(95, (elapsed / total) * 100) };
        });
      }, 1000);
      stops.push(() => clearInterval(prog));
    }

    return () => {
      alive = false;
      stops.forEach((f) => f());
    };
  }, [s.screen, s.role, s.online, s.ride?.id]);

  // On launch: reuse the stored token. The server rejecting it (401) logs us out.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!sRef.current.user) return;
      Alert.alert('Session expired', 'Please log in again.');
      logout();
    });
    restoreSession();
    return () => clearTimeout(toastTimer.current);
  }, []);

  // Reuse the saved login. A 401 logs out (handled above); if the server just can't be reached,
  // the login is kept and the splash screen offers a retry.
  async function restoreSession() {
    const stored = await loadToken();
    if (!stored) return;
    setToken(stored);
    set({ checking: true, offline: false });
    try {
      await startSession({ user: await api.me(), token: stored });
      set({ checking: false });
    } catch {
      set({ checking: false, offline: hasToken() });
    }
  }

  const actions = {
    startSession, restoreSession, logout, requestRide, cancelRide, finishRide,
    setOnline, acceptRequest, declineRequest, markArrived, startTrip, completeTrip, cancelDriverRide,
  };
  return <Ctx.Provider value={{ s, set, go, vehicle, estimate, flashToast, ...actions }}>{children}</Ctx.Provider>;
}
