import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../src/auth';

function notify(message: string) {
  if (Platform.OS === 'web') globalThis.alert(message);
  else Alert.alert('Sign in failed', message);
}

export default function LoginScreen() {
  const { token, ready, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (ready && token) return <Redirect href="/dashboard" />;

  const submit = async () => {
    if (!username.trim() || !password) return notify('Enter both username and password.');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.shell}>
          <View style={styles.brandRow}>
            <View style={styles.mark}><Ionicons name="people" size={23} color="#F7F8F2" /></View>
            <Text style={styles.brand}>FIELDNOTE <Text style={styles.brandAccent}>/ PEOPLE</Text></Text>
          </View>
          <View style={styles.intro}>
            <Text style={styles.kicker}>PEOPLE OPERATIONS · 2026</Text>
            <Text style={styles.title}>A clearer view{ '\n' }of your people.</Text>
            <Text style={styles.description}>Manage your team and understand the shape of compensation, all in one place.</Text>
          </View>
          <View style={styles.form}>
            <Text style={styles.formTitle}>Welcome back</Text>
            <Text style={styles.formCaption}>Sign in to your HR workspace.</Text>
            <Text style={styles.label}>USERNAME</Text>
            <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="Your username" placeholderTextColor="#909890" autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Your password" placeholderTextColor="#909890" secureTextEntry onSubmitEditing={submit} />
            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={submit} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.buttonText}>Sign in</Text><Ionicons name="arrow-forward" size={18} color="#FFFFFF" /></>}
            </TouchableOpacity>
            <View style={styles.note}><Ionicons name="shield-checkmark-outline" size={15} color="#177A68" /><Text style={styles.noteText}>Authorized access for HR administrators</Text></View>
          </View>
          <Text style={styles.footer}>HR MANAGER & SALARY ANALYTICS SYSTEM</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F5F2' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 34 },
  shell: { width: '100%', maxWidth: 1040, alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#177A68', alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#1F302B', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  brandAccent: { color: '#78847E', fontWeight: '600' },
  intro: { marginTop: 60, maxWidth: 610 },
  kicker: { color: '#177A68', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#1C2D27', fontSize: 43, lineHeight: 49, fontWeight: '800', marginTop: 15 },
  description: { color: '#65716B', fontSize: 15, lineHeight: 23, maxWidth: 430, marginTop: 14 },
  form: { width: '100%', maxWidth: 450, marginTop: 35, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 25, borderWidth: 1, borderColor: '#E2E7E1' },
  formTitle: { color: '#24352E', fontSize: 22, fontWeight: '800' },
  formCaption: { color: '#77827C', fontSize: 13, marginTop: 5, marginBottom: 23 },
  label: { color: '#52605A', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 13, marginBottom: 8 },
  input: { height: 48, borderWidth: 1, borderColor: '#DCE3DC', borderRadius: 5, paddingHorizontal: 13, color: '#23332D', backgroundColor: '#FBFCFA', fontSize: 14 },
  button: { marginTop: 22, height: 48, borderRadius: 5, backgroundColor: '#177A68', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18 },
  noteText: { color: '#748078', fontSize: 11 },
  footer: { color: '#8A948E', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginTop: 35 },
});