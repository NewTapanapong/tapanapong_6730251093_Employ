import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../src/auth';

export default function IndexRoute() {
  const { token, ready } = useAuth();
  if (!ready) return <View style={styles.loading}><ActivityIndicator color="#1769AA" /></View>;
  return <Redirect href={token ? '/dashboard' : '/login'} />;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F7FC' } });