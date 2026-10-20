import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../src/auth';

export default function LoginScreen() {
  const { token, user, ready, login } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (ready && token && user) return <Redirect href={{ pathname: '/dashboard', params: { role: user.role } }} />;

  const submit = async () => {
    if (!identifier.trim() || !password) {
      setError('Enter your username or email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const authenticatedUser = await login(identifier.trim(), password);
      router.replace({ pathname: '/dashboard', params: { role: authenticatedUser.role } });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.shell}>
          <View style={styles.brandRow}>
            <View style={styles.mark}><Ionicons name="people" size={23} color="#FFFFFF" /></View>
            <Text style={styles.brand}>TAPANAPONG <Text style={styles.brandAccent}>/ HR</Text></Text>
          </View>
          <View style={styles.intro}>
            <Text style={styles.kicker}>HR MANAGEMENT · 2026</Text>
            <Text style={styles.title}>People first.{ '\n' }Insightful pay.</Text>
            <Text style={styles.description}>Manage employee records and explore salary patterns in one workspace.</Text>
          </View>
          <View style={styles.form}>
            <Text style={styles.formTitle}>Welcome back</Text>
            <Text style={styles.formCaption}>Sign in to your HR workspace.</Text>
            <Text style={styles.label}>USERNAME OR EMAIL</Text>
            <TextInput style={styles.input} value={identifier} onChangeText={setIdentifier} placeholder="Username or email" placeholderTextColor="#909890" autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Your password" placeholderTextColor="#909890" secureTextEntry onSubmitEditing={submit} />
            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={submit} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.buttonText}>Sign in</Text><Ionicons name="arrow-forward" size={18} color="#FFFFFF" /></>}
            </TouchableOpacity>
            <View style={styles.note}><Ionicons name="shield-checkmark-outline" size={15} color="#1769AA" /><Text style={styles.noteText}>Authorized access for HR administrators</Text></View>
          </View>
          <Text style={styles.footer}>HR MANAGER & SALARY ANALYTICS SYSTEM</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F7FC' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 34 },
  shell: { width: '100%', maxWidth: 1040, alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#1769AA', alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#172B45', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  brandAccent: { color: '#718096', fontWeight: '600' },
  intro: { marginTop: 60, maxWidth: 610 },
  kicker: { color: '#1769AA', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#172B45', fontSize: 43, lineHeight: 49, fontWeight: '800', marginTop: 15 },
  description: { color: '#5D6B7D', fontSize: 15, lineHeight: 23, maxWidth: 430, marginTop: 14 },
  form: { width: '100%', maxWidth: 450, marginTop: 35, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 25, borderWidth: 1, borderColor: '#DCE5F0' },
  formTitle: { color: '#21334D', fontSize: 22, fontWeight: '800' },
  formCaption: { color: '#718096', fontSize: 13, marginTop: 5, marginBottom: 23 },
  label: { color: '#52647A', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 13, marginBottom: 8 },
  input: { height: 48, borderWidth: 1, borderColor: '#D7E2EF', borderRadius: 5, paddingHorizontal: 13, color: '#21334D', backgroundColor: '#F8FBFF', fontSize: 14 },
  errorText: { color: '#A23D35', fontSize: 12, lineHeight: 18, marginTop: 11 },
  button: { marginTop: 22, height: 48, borderRadius: 5, backgroundColor: '#1769AA', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18 },
  noteText: { color: '#718096', fontSize: 11 },
  footer: { color: '#8492A6', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginTop: 35 },
});