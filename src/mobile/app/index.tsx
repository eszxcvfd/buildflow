import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { fetchStatus, ApiStatus, login, logout, fetchMe } from '../src/api/client';
import { storeToken, getStoredToken, clearStoredToken } from '../src/storage/token';

export default function StatusScreen() {
  const [data, setData] = useState<ApiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('worker1@example.com');
  const [password, setPassword] = useState('Password123!');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchStatus();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const refreshAuth = async (t: string | null) => {
    if (!t) {
      setUser(null);
      setToken(null);
      return;
    }
    try {
      const me = await fetchMe(t);
      setUser({ id: me.id, email: me.email });
      setToken(t);
    } catch {
      clearStoredToken();
      setUser(null);
      setToken(null);
    }
  };

  useEffect(() => {
    void load();
    const stored = getStoredToken();
    if (stored) void refreshAuth(stored);
  }, []);

  const handleLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await login({ email: email.trim().toLowerCase(), password });
      storeToken(res.token);
      setToken(res.token);
      setUser({ id: res.user.id, email: res.user.email });
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setAuthError(null);
    setAuthLoading(true);
    const t = getStoredToken() ?? token;
    try {
      if (t) await logout(t);
    } catch (e) {
      // Treat 401 as already logged out
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('401') && !msg.includes('Unauthorized')) {
        setAuthError(msg);
      }
    } finally {
      clearStoredToken();
      setUser(null);
      setToken(null);
      setAuthLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }} accessible accessibilityLabel="status screen">
      <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
        Buildflow Mobile Status
      </Text>
      {loading && <ActivityIndicator accessibilityLabel="loading" />}
      {error && (
        <View accessibilityRole="alert" style={{ backgroundColor: '#fee', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: 'red' }}>Error: {error}</Text>
        </View>
      )}
      {data && (
        <View style={{ backgroundColor: '#f0f0f0', padding: 12, borderRadius: 8 }}>
          <Text>Status: {data.status}</Text>
          <Text>Version: {data.version}</Text>
          <Text>Service: {data.service}</Text>
          <Text>Timestamp: {data.timestamp}</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="retry status fetch"
        onPress={load}
        style={{ marginTop: 16, backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center' }}
      >
        <Text style={{ color: 'white' }}>Retry</Text>
      </Pressable>

      <View style={{ marginTop: 32, borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>Authentication</Text>
        {user ? (
          <>
            <Text style={{ marginBottom: 8 }}>Signed in as {user.email}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Logout"
              onPress={handleLogout}
              disabled={authLoading}
              style={{ backgroundColor: authLoading ? '#888' : '#dc2626', padding: 12, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>{authLoading ? 'Logging out…' : 'Logout'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ marginBottom: 4, fontWeight: '600' }}>Email</Text>
            <TextInput
              accessibilityLabel="email input"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10, marginBottom: 12 }}
            />
            <Text style={{ marginBottom: 4, fontWeight: '600' }}>Password</Text>
            <TextInput
              accessibilityLabel="password input"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10, marginBottom: 12 }}
            />
            {authError && (
              <View accessibilityRole="alert" style={{ backgroundColor: '#fee', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                <Text style={{ color: '#a00' }}>{authError}</Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              onPress={handleLogin}
              disabled={authLoading}
              style={{ backgroundColor: authLoading ? '#888' : '#111', padding: 12, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>{authLoading ? 'Signing in…' : 'Sign in'}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
