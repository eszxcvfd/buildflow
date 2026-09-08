import React from 'react';
import {
  View, Text, Pressable, ActivityIndicator, FlatList, StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { listProjects, LoginError, type ProjectSummary } from '../../api/client';

export function ProjectListScreen({ token }: { token: string }) {
  const [projects, setProjects] = React.useState<ProjectSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<LoginError | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listProjects(token);
      setProjects(result);
    } catch (e) {
      setError(e instanceof LoginError ? e : new LoginError('Không thể kết nối máy chủ, vui lòng thử lại', 0));
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading && projects.length === 0) {
    return (
      <View style={styles.center} accessible accessibilityLabel="loading projects">
        <ActivityIndicator accessibilityLabel="projects loading indicator" />
      </View>
    );
  }

  if (error?.status === 401) {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="alert" style={styles.hint}>Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại</Text>
        <Pressable
          accessibilityRole="button" accessibilityLabel="go to login"
          onPress={() => router.push('/')} style={[styles.button, styles.secondaryButton]}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Về đăng nhập</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <View accessibilityRole="alert" style={styles.errorBox}>
          <Text style={styles.errorText}>{error.message}</Text>
        </View>
        <Pressable
          accessibilityRole="button" accessibilityLabel="retry projects"
          accessibilityState={{ busy: loading }}
          onPress={load} style={[styles.button, styles.secondaryButton]}
        >
          {loading ? <ActivityIndicator size="small" color="#374151" /> : <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử lại</Text>}
        </Pressable>
      </View>
    );
  }

  if (projects.length === 0) {
    return (
      <View style={styles.center}>
        <Text accessibilityLabel="no projects" style={styles.hint}>Bạn chưa là thành viên dự án nào</Text>
        <Pressable
          accessibilityRole="button" accessibilityLabel="retry projects"
          onPress={load} style={[styles.button, styles.secondaryButton]}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button" accessibilityLabel={`project ${item.code}`}
            onPress={() => router.push(`/projects/${item.id}`)}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.code}>{item.code}</Text>
              <Text style={[styles.badge, styles.badgeIdle]}>{item.status}</Text>
            </View>
            <Text style={styles.name}>{item.name}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', padding: 24, gap: 12 },
  hint: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 12, width: '100%' },
  errorText: { color: '#b91c1c', fontSize: 14, textAlign: 'center' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryButton: { backgroundColor: '#e5e7eb' },
  secondaryButtonText: { color: '#374151' },
  list: { flex: 1, backgroundColor: '#f9fafb' },
  listContent: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 6, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 13, fontWeight: '700', color: '#374151' },
  badge: { fontSize: 12, fontWeight: '700', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, overflow: 'hidden' },
  badgeIdle: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  name: { fontSize: 16, fontWeight: '600', color: '#111827' },
});
