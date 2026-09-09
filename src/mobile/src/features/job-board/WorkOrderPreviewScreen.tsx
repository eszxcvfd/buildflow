import React from 'react';
import {
  View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { fetchWorkOrderPreview, LoginError, type WorkOrderPreview } from '../../api/client';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
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

/**
 * JOB-SRS-005 (issue #45) — preview read-only tối thiểu (BD7): gọi
 * `GET /api/v1/work-orders/:id`, hiện cùng fields + `jobBoard.state`;
 * `state ≠ 'AVAILABLE'` → banner trạng thái, không action.
 * KHÔNG nút claim — đó là #47.
 */
export function WorkOrderPreviewScreen({ token, workOrderId }: { token: string; workOrderId: string }) {
  const [detail, setDetail] = React.useState<WorkOrderPreview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<LoginError | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWorkOrderPreview(token, workOrderId);
      setDetail(result);
    } catch (e) {
      setError(e instanceof LoginError ? e : new LoginError('Không thể kết nối máy chủ, vui lòng thử lại', 0));
    } finally {
      setLoading(false);
    }
  }, [token, workOrderId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading && !detail) {
    return (
      <View style={styles.center} accessible accessibilityLabel="loading work order preview">
        <ActivityIndicator accessibilityLabel="work order preview loading indicator" />
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

  if (error?.status === 404) {
    // F013 — 404: công việc không còn (đã xóa / ngoài scope sau khi list) →
    // banner + quay lại, KHÔNG "Thử lại" vô ích.
    return (
      <View style={styles.center}>
        <View accessibilityRole="alert" accessibilityLabel="work order gone" style={styles.bannerBox}>
          <Text style={styles.bannerText}>
            Công việc không còn — có thể đã bị xóa hoặc bạn không còn quyền xem.
            Vui lòng quay lại bảng việc và làm mới.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button" accessibilityLabel="back to job board"
          onPress={() => router.push('/job-board')} style={[styles.button, styles.secondaryButton]}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Về bảng việc</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <View accessibilityRole="alert" style={styles.errorBox}>
          <Text accessibilityLabel="work order preview error" style={styles.errorText}>{error.message}</Text>
        </View>
        <Pressable
          accessibilityRole="button" accessibilityLabel="retry work order preview"
          accessibilityState={{ busy: loading }}
          onPress={load} style={[styles.button, styles.secondaryButton]}
        >
          {loading ? <ActivityIndicator size="small" color="#374151" /> : <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử lại</Text>}
        </Pressable>
      </View>
    );
  }

  if (!detail) {
    // F013 — null-state phân biệt với loading: load xong, không lỗi, nhưng
    // không có dữ liệu (defensive — client hoặc trả object hoặc throw) →
    // banner + quay lại, không spinner, không "Thử lại".
    return (
      <View style={styles.center}>
        <View accessibilityRole="alert" accessibilityLabel="no work order data" style={styles.bannerBox}>
          <Text style={styles.bannerText}>Không có dữ liệu công việc. Vui lòng quay lại bảng việc và làm mới.</Text>
        </View>
        <Pressable
          accessibilityRole="button" accessibilityLabel="back to job board"
          onPress={() => router.push('/job-board')} style={[styles.button, styles.secondaryButton]}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Về bảng việc</Text>
        </Pressable>
      </View>
    );
  }

  const state = detail.jobBoard?.state ?? null;
  const nonAvailable = state !== null && state !== 'AVAILABLE';
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>{detail.title}</Text>
        <Text style={styles.code}>{detail.code}</Text>
        {nonAvailable ? (
          <View accessibilityRole="alert" accessibilityLabel="non-available banner" style={styles.bannerBox}>
            <Text style={styles.bannerText}>
              Công việc hiện không còn nhận — trạng thái: {state}. Vui lòng quay lại bảng việc và làm mới.
            </Text>
          </View>
        ) : null}
        <Field label="Trạng thái" value={detail.status} labelId="preview status" />
        <Field label="Ưu tiên" value={detail.priority} labelId="preview priority" />
        <Field label="Bắt đầu" value={formatDateTime(detail.plannedStartAt)} labelId="preview planned start" />
        <Field label="Kết thúc" value={formatDateTime(detail.plannedEndAt)} labelId="preview planned end" />
        {detail.projectName ? <Field label="Dự án" value={detail.projectName} labelId="preview project" /> : null}
        <Pressable
          accessibilityRole="button" accessibilityLabel="back to job board"
          onPress={() => router.push('/job-board')} style={[styles.button, styles.secondaryButton]}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Về bảng việc</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', padding: 24, gap: 12 },
  container: { flexGrow: 1, padding: 16, backgroundColor: '#f9fafb' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  code: { fontSize: 13, fontWeight: '700', color: '#374151' },
  hint: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 12, width: '100%' },
  errorText: { color: '#b91c1c', fontSize: 14, textAlign: 'center' },
  bannerBox: { backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: 8, padding: 12 },
  bannerText: { color: '#92400e', fontSize: 14 },
  field: { gap: 2 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  fieldValue: { fontSize: 15, color: '#111827' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryButton: { backgroundColor: '#e5e7eb' },
  secondaryButtonText: { color: '#374151' },
});
