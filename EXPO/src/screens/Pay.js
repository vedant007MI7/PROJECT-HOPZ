// Razorpay checkout inside a WebView (works in Expo Go; the native SDK would need a dev build).
// The page opens checkout and reports back with postMessage. The server then verifies the payment.
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useApp } from '../state';
import { IconButton, Row, H } from '../components/UI';
import { C, TOP } from '../theme';

const j = (v) => JSON.stringify(v == null ? '' : v);

const page = (o, user) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;background:#0b1620;color:#dce6ea;font-family:-apple-system,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}</style>
</head><body><p>Opening secure checkout…</p>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
function send(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));}
window.onload=function(){
  try{
    var rzp=new Razorpay({
      key:${j(o.key_id)}, amount:${Number(o.amount)}, currency:${j(o.currency)}, order_id:${j(o.order_id)},
      name:'Hopz', description:'Ride fare',
      prefill:{name:${j(user?.name)}, email:${j(user?.email)}},
      theme:{color:${j(C.amber)}},
      handler:function(r){send({ok:r});},
      modal:{ondismiss:function(){send({dismissed:true});}}
    });
    rzp.open();
  }catch(e){send({error:'Could not open checkout'});}
};
</script></body></html>`;

export default function Pay() {
  const { s, confirmPayment, cancelPayment } = useApp();
  const o = s.payOrder;
  if (!o) return null;
  const onMessage = (e) => {
    let m;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.ok) confirmPayment(m.ok);
    else if (m.dismissed || m.error) cancelPayment();
  };
  return (
    <View style={{ flex: 1, paddingTop: TOP }}>
      <Row style={{ gap: 12, paddingHorizontal: 16, paddingBottom: 10 }}>
        <IconButton name="back" label="Back" size={40} onPress={cancelPayment} />
        <H size={18}>Pay ₹{Math.round(o.amount / 100)}</H>
      </Row>
      <WebView
        originWhitelist={['*']}
        source={{ html: page(o, s.user) }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        javaScriptCanOpenWindowsAutomatically
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => <ActivityIndicator style={{ position: 'absolute', top: '45%', alignSelf: 'center' }} color={C.amber} />}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
}
