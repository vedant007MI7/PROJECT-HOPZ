import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Glass from './Glass';
import Icon from './Icons';
import { useApp } from '../state';
import { F } from '../theme';

// Floating oval liquid-glass island: Home / Activity (or Earnings) / Profile
export default function Nav() {
  const { s, go } = useApp();
  const rider = s.role === 'rider';
  const home = rider ? 'rHome' : 'dHome';
  const mid = rider ? 'rActivity' : 'dEarn';
  const tabs = [
    { key: 'home', label: 'Home', icon: 'home', on: s.screen === home, press: () => go(home, { quiet: true }) },
    { key: 'mid', label: rider ? 'Activity' : 'Earnings', icon: rider ? 'clock' : 'wallet', on: s.screen === mid, press: () => go(mid) },
    { key: 'me', label: 'Profile', icon: 'user', on: s.screen === 'profile', press: () => go('profile') },
  ];
  return (
    <View style={{ position: 'absolute', left: 22, right: 22, bottom: 20 }}>
      <Glass variant="steel" radius={999} contentStyle={{ flexDirection: 'row', padding: 7, gap: 4 }}>
        {tabs.map((t) => (
          <Pressable key={t.key} onPress={t.press} style={{ flex: 1 }}>
            {t.on ? (
              <Glass variant="amber" radius={999} style={{ height: 58 }} contentStyle={s2.tab}>
                <Icon name={t.icon} color="#fff" size={22} />
                <Text style={[s2.lbl, { color: '#fff', textShadowColor: 'rgba(100,40,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 }]}>{t.label}</Text>
              </Glass>
            ) : (
              <View style={[s2.tab, { height: 58 }]}>
                <Icon name={t.icon} color="#DCE6EA" size={22} />
                <Text style={[s2.lbl, { color: '#DCE6EA' }]}>{t.label}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </Glass>
    </View>
  );
}

const s2 = {
  tab: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  lbl: { fontFamily: F.b, fontSize: 11.5 },
};
