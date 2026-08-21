import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { fetchStatus, ApiStatus } from '../src/api/client';

export default function StatusScreen() {
  const [data, setData] = useState<ApiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    void load();
  }, []);

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
    </View>
  );
}
