import React from 'react';
import {
  View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet,
} from 'react-native';
import { fetchMyEligibility, LoginError, type MyEligibility } from '../../api/client';

function conditionLabel(passed: boolean | null): string {
  if (passed === true) return 'ĐẠT';
  if (passed === false) return 'KHÔNG ĐẠT';
  return 'KHÔNG ĐÁNH GIÁ ĐƯỢC';
}

export function EligibilityScreen({ token }: { token: string }) {
  const [data, setData] = React.useState<MyEligibility | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<LoginError | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMyEligibility(token);
      setData(result);
    } catch (e) {
      setError(e instanceof LoginError ? e : new LoginError('Không thể kết nối máy chủ, vui lòng thử lại', 0));
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <View style={styles.center} accessible accessibilityLabel="loading eligibility">
        <ActivityIndicator accessibilityLabel="eligibility loading indicator" />
      </View>
    );
  }

  if (error?.status === 404) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>Điều kiện nhận việc</Text>
          <View style={styles.emptyBox}>
            <Text accessibilityLabel="no worker profile" style={styles.emptyText}>
              Tài khoản không có hồ sơ worker
            </Text>
          </View>
          <Pressable
            accessibilityRole="button" accessibilityLabel="retry eligibility"
            onPress={load} style={[styles.button, styles.secondaryButton]}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử lại</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (error) {
    const relogin = error.status === 401;
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>Điều kiện nhận việc</Text>
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Text style={styles.errorText}>
              {relogin ? 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại' : error.message}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button" accessibilityLabel="retry eligibility"
            accessibilityState={{ busy: loading }}
            onPress={load} style={[styles.button, styles.secondaryButton]}
          >
            {loading ? <ActivityIndicator size="small" color="#374151" /> : <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử lại</Text>}
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (!data) return null;

  const verdictStyle = data.eligible ? styles.verdictOk : styles.verdictFail;
  const verdictTextStyle = data.eligible ? styles.verdictOkText : styles.verdictFailText;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>Điều kiện nhận việc</Text>

        <View
          accessibilityRole={data.eligible ? 'text' : 'alert'}
          style={[styles.verdict, verdictStyle]}
        >
          <Text style={[styles.verdictText, verdictTextStyle]}>
            {data.eligible ? 'Đủ điều kiện nhận việc' : 'Chưa đủ điều kiện nhận việc'}
          </Text>
          <Text style={[styles.meta, verdictTextStyle]}>
            Kiểm tra lúc: {new Date(data.checkedAt).toLocaleString('vi-VN')}
          </Text>
          <Text style={[styles.meta, verdictTextStyle]}>
            Mã đối chiếu: {data.correlationId}
          </Text>
        </View>

        <Text accessibilityRole="header" style={styles.sectionTitle}>Điều kiện chi tiết</Text>
        {data.conditions.map((c) => (
          <View key={c.code} style={styles.conditionRow}>
            <Text style={styles.conditionCode}>{c.code}</Text>
            <Text
              accessibilityLabel={`condition ${c.code} status`}
              style={[
                styles.badge,
                c.passed === true ? styles.badgeOk : c.passed === false ? styles.badgeFail : styles.badgeIdle,
              ]}
            >
              {conditionLabel(c.passed)}
            </Text>
            <Text style={styles.conditionDetail}>{c.detail}</Text>
          </View>
        ))}

        <Text accessibilityRole="header" style={styles.sectionTitle}>Đội thi công</Text>
        {data.crews.length === 0 ? (
          <Text style={styles.hint}>Chưa thuộc đội nào</Text>
        ) : (
          data.crews.map((m) => (
            <View key={m.crewId} style={styles.crewRow}>
              <Text style={styles.crewName}>{m.crewCode} · {m.crewName}</Text>
              <Text style={styles.hint}>Vai trò: {m.memberRole} · Hiệu lực: {m.effectiveFrom} – {m.effectiveTo ?? 'hiện tại'}</Text>
            </View>
          ))
        )}

        <Pressable
          accessibilityRole="button" accessibilityLabel="refresh eligibility"
          accessibilityState={{ busy: loading }}
          onPress={load} style={[styles.button, styles.secondaryButton]}
        >
          {loading ? <ActivityIndicator size="small" color="#374151" /> : <Text style={[styles.buttonText, styles.secondaryButtonText]}>Kiểm tra lại</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 4 },
  verdict: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 4 },
  verdictOk: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  verdictFail: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  verdictText: { fontSize: 16, fontWeight: '700' },
  verdictOkText: { color: '#14532d' },
  verdictFailText: { color: '#b91c1c' },
  meta: { fontSize: 12 },
  conditionRow: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, gap: 4 },
  conditionCode: { fontSize: 13, fontWeight: '700', color: '#374151' },
  badge: { fontSize: 12, fontWeight: '700', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, overflow: 'hidden' },
  badgeOk: { backgroundColor: '#dcfce7', color: '#14532d' },
  badgeFail: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  badgeIdle: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  conditionDetail: { fontSize: 13, color: '#4b5563' },
  crewRow: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, gap: 2 },
  crewName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  hint: { fontSize: 12, color: '#6b7280' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 12 },
  errorText: { color: '#b91c1c', fontSize: 14 },
  emptyBox: { backgroundColor: '#f3f4f6', borderRadius: 8, padding: 16, alignItems: 'center' },
  emptyText: { color: '#374151', fontSize: 14 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryButton: { backgroundColor: '#f3f4f6', marginTop: 12 },
  secondaryButtonText: { color: '#374151' },
});
