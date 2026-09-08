import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { getSession } from '../../src/storage/session';
import { ProjectListScreen } from '../../src/features/projects/ProjectListScreen';

export default function ProjectsRoute() {
  const [token, setToken] = React.useState<string | null>(null);
  const [restoring, setRestoring] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await getSession();
      if (mounted) {
        setToken(stored?.accessToken ?? null);
        setRestoring(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (restoring) {
    return (
      <View style={styles.center} accessible accessibilityLabel="loading session">
        <ActivityIndicator accessibilityLabel="session loading indicator" />
      </View>
    );
  }

  if (!token) {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="alert" style={styles.hint}>Vui lòng đăng nhập để xem danh sách dự án</Text>
        <Link href="/" accessibilityLabel="go to login" style={styles.link}>Về đăng nhập</Link>
      </View>
    );
  }

  return <ProjectListScreen token={token} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', padding: 24, gap: 12 },
  hint: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  link: { fontSize: 15, fontWeight: '600', color: '#2563eb' },
});
