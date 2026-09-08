import React from 'react';
import {
  View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { getProject, listProjectMembers, LoginError, type ProjectSummary, type ProjectMember } from '../../api/client';

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('vi-VN');
}

function Field({ label, value, labelId }: { label: string; value: string; labelId: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text accessibilityLabel={labelId} style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export function ProjectDetailScreen({ token, projectId }: { token: string; projectId: string }) {
  const [project, setProject] = React.useState<ProjectSummary | null>(null);
  const [members, setMembers] = React.useState<ProjectMember[] | null>(null);
  const [membersError, setMembersError] = React.useState<LoginError | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<LoginError | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setMembersError(null);
    try {
      const result = await getProject(token, projectId);
      setProject(result);
      // Detail 200 proves in-scope membership, so the members read (same
      // scope) is expected to 200 as well. A 403 here can only mean a
      // mid-flight revoke — surfaced inline, never leaking other data.
      try {
        setMembers(await listProjectMembers(token, projectId));
      } catch (e) {
        setMembers(null);
        setMembersError(e instanceof LoginError ? e : new LoginError('Không thể kết nối máy chủ, vui lòng thử lại', 0));
      }
    } catch (e) {
      setError(e instanceof LoginError ? e : new LoginError('Không thể kết nối máy chủ, vui lòng thử lại', 0));
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading && !project) {
    return (
      <View style={styles.center} accessible accessibilityLabel="loading project detail">
        <ActivityIndicator accessibilityLabel="project detail loading indicator" />
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

  if (error?.status === 403) {
    return (
      <View style={styles.center}>
        <View accessibilityRole="alert" style={styles.errorBox}>
          <Text style={styles.errorText}>Bạn không phải thành viên dự án này (403)</Text>
        </View>
        <Pressable
          accessibilityRole="button" accessibilityLabel="back to projects"
          onPress={() => router.push('/projects')} style={[styles.button, styles.secondaryButton]}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Về danh sách dự án</Text>
        </Pressable>
      </View>
    );
  }

  if (error?.status === 404) {
    return (
      <View style={styles.center}>
        <View accessibilityRole="alert" style={styles.errorBox}>
          <Text style={styles.errorText}>Không tìm thấy dự án</Text>
        </View>
        <Pressable
          accessibilityRole="button" accessibilityLabel="back to projects"
          onPress={() => router.push('/projects')} style={[styles.button, styles.secondaryButton]}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Về danh sách dự án</Text>
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
          accessibilityRole="button" accessibilityLabel="retry project detail"
          accessibilityState={{ busy: loading }}
          onPress={load} style={[styles.button, styles.secondaryButton]}
        >
          {loading ? <ActivityIndicator size="small" color="#374151" /> : <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử lại</Text>}
        </Pressable>
      </View>
    );
  }

  if (!project) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>{project.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.code}>{project.code}</Text>
          <Text style={[styles.badge, styles.badgeIdle]}>{project.status}</Text>
        </View>
        <Field label="Mã dự án" value={project.code} labelId="project code" />
        <Field label="Tên dự án" value={project.name} labelId="project name" />
        <Field label="Trạng thái" value={project.status} labelId="project status" />
        <Field label="Quản lý (managerId)" value={project.managerId} labelId="project manager" />
        <Field label="Ngày tạo" value={formatDateTime(project.createdAt)} labelId="project created at" />
        <Field label="Cập nhật lần cuối" value={formatDateTime(project.updatedAt)} labelId="project updated at" />

        <Text accessibilityRole="header" style={styles.sectionTitle}>Thành viên</Text>
        {members ? (
          members.length === 0 ? (
            <Text style={styles.hint}>Chưa có thành viên nào</Text>
          ) : (
            members.map((m) => (
              <View key={m.id} style={styles.memberRow}>
                <Text style={styles.memberName}>{m.userName ?? m.userCode ?? m.userId}</Text>
                <Text style={styles.hint}>Vai trò: {m.projectRole}{m.userCode ? ` · ${m.userCode}` : ''}</Text>
              </View>
            ))
          )
        ) : (
          <View style={styles.membersFallback}>
            <Text style={styles.hint}>
              {membersError?.status === 401
                ? 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'
                : membersError?.status === 403
                  ? 'Bạn không còn quyền xem thành viên dự án này'
                  : 'Không tải được danh sách thành viên'}
            </Text>
            <Pressable
              accessibilityRole="button" accessibilityLabel="retry project members"
              accessibilityState={{ busy: loading }}
              onPress={load} style={[styles.button, styles.secondaryButton]}
            >
              {loading ? <ActivityIndicator size="small" color="#374151" /> : <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử lại</Text>}
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', padding: 24, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 13, fontWeight: '700', color: '#374151' },
  badge: { fontSize: 12, fontWeight: '700', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, overflow: 'hidden' },
  badgeIdle: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  field: { gap: 2, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  fieldValue: { fontSize: 15, color: '#111827' },
  memberRow: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, gap: 2 },
  memberName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  membersFallback: { gap: 8, alignItems: 'center' },
  hint: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 12, width: '100%' },
  errorText: { color: '#b91c1c', fontSize: 14, textAlign: 'center' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryButton: { backgroundColor: '#e5e7eb' },
  secondaryButtonText: { color: '#374151' },
});
