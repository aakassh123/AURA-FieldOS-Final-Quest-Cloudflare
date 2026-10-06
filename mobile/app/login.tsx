import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(''); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) return setError(error.message);
    router.replace('/(tabs)');
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1220', padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: '#14B8A6', fontSize: 15, fontWeight: '800', letterSpacing: 1.5 }}>AURA FIELDOS</Text>
      <Text style={{ color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 10 }}>Work from the field.</Text>
      <Text style={{ color: '#94A3B8', fontSize: 15, marginTop: 8, marginBottom: 28 }}>Sales, visits, tasks and location — in one focused mobile workspace.</Text>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Work email" placeholderTextColor="#64748B" style={inputStyle} />
      <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor="#64748B" style={inputStyle} />
      {error ? <Text style={{ color: '#FCA5A5', marginBottom: 14 }}>{error}</Text> : null}
      <Pressable onPress={submit} disabled={loading} style={{ backgroundColor: '#14B8A6', padding: 16, borderRadius: 14, alignItems: 'center' }}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#06201D', fontWeight: '800', fontSize: 16 }}>Sign in</Text>}
      </Pressable>
    </View>
  );
}

const inputStyle = { backgroundColor: '#162033', color: '#fff', borderWidth: 1, borderColor: '#26334A', padding: 15, borderRadius: 14, marginBottom: 12 } as const;
