import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getAuth, isTokenExpired, clearAuth, type StoredAuth } from '../src/auth/storage';

export default function HomeScreen() {
  const router = useRouter();
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [expired, setExpired] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void (async () => {
      const a = await getAuth();
      if (!a) {
        router.replace('/login');
        return;
      }
      if (isTokenExpired(a)) {
        setExpired(true);
        setChecking(false);
        return;
      }
      setAuth(a);
      setChecking(false);
    })();
  }, [router]);

  if (checking) {
    return (
      <View style={styles.container} accessible accessibilityLabel="loading session">
        <ActivityIndicator accessibilityLabel="loading" />
      </View>
    );
  }

  if (expired) {
    return (
      <View style={styles.container} accessible accessibilityLabel="session expired">
        <View accessibilityRole="alert" style={styles.errorBox}>
          <Text style={styles.errorText}>Phiên hết hạn, vui lòng đăng nhập lại</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="back to login"
          onPress={() => { void clearAuth(); router.replace('/login'); }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Về trang đăng nhập</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} accessible accessibilityLabel="dashboard">
      <Text accessibilityRole="header" style={styles.title}>
        Chào mừng, {auth?.user.fullName}
      </Text>
      <Text style={styles.subtitle}>
        {auth?.user.email} · vai trò: {auth?.roles.map((r) => r.code).join(', ') || '—'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="logout"
        onPress={() => { void clearAuth(); router.replace('/login'); }}
        style={[styles.button, styles.buttonSecondary]}
      >
        <Text style={[styles.buttonText, { color: '#374151' }]}>Đăng xuất</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fafafa' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  errorBox: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#92400e', fontSize: 14, textAlign: 'center' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
