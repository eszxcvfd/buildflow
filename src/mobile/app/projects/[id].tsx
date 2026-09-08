import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { getSession } from '../../src/storage/session';
import { ProjectDetailScreen } from '../../src/features/projects/ProjectDetailScreen';

export default function ProjectDetailRoute() {
  const [token, setToken] = React.useState<string | null>(null);
  const [restoring, setRestoring] = React.useState(true);
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const projectId = Array.isArray(id) ? id[0] : id;

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
        <Text accessibilityRole="alert" style={styles.hint}>Vui lòng đăng nhập để xem chi tiết dự án</Text>
        <Link href="/" accessibilityLabel="go to login" style={styles.link}>Về đăng nhập</Link>
      </View>
    );
  }

  if (!projectId) {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="alert" style={styles.hint}>Thiếu mã định danh dự án</Text>
        <Link href="/projects" accessibilityLabel="back to projects" style={styles.link}>Về danh sách dự án</Link>
      </View>
    );
  }

  return <ProjectDetailScreen token={token} projectId={projectId} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', padding: 24, gap: 12 },
  hint: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  link: { fontSize: 15, fontWeight: '600', color: '#2563eb' },
});
