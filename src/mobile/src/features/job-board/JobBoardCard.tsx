import React from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import type { JobBoardItem, JobBoardState } from '../../api/client';

function stateLabel(state: JobBoardState): string {
  switch (state) {
    case 'AVAILABLE': return 'Đang nhận';
    case 'ASSIGNED': return 'Đã có người nhận';
    case 'EXPIRED': return 'Hết hạn';
    case 'SCHEDULED': return 'Chưa mở';
    case 'CLOSED': return 'Đã đóng';
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('vi-VN');
}

/**
 * JOB-SRS-005 (issue #45) — card Job Board. Hiển thị thời gian, location
 * (areaName), project, type (workTypeName), priority, skill summary
 * (requiredTradeName) + CTA "Xem chi tiết" → `/job-board/[id]`.
 * TUYỆT ĐỐI không render nút claim — đó là #47.
 */
export function JobBoardCard({ item }: { item: JobBoardItem }) {
  const state = item.jobBoard.state;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={`job card ${item.code}`}
      onPress={() => router.push(`/job-board/${item.id}`)}
      style={styles.card}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.code}>{item.code}</Text>
        <Text accessibilityLabel={`job state ${state}`} style={[styles.badge, state === 'AVAILABLE' ? styles.badgeAvailable : styles.badgeOther]}>
          {stateLabel(state)}
        </Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      {item.projectName ? <Text style={styles.meta}>Dự án: {item.projectName}</Text> : null}
      {item.workTypeName ? <Text style={styles.meta}>Loại việc: {item.workTypeName}</Text> : null}
      {item.areaName ? <Text style={styles.meta}>Khu vực: {item.areaName}</Text> : null}
      {item.requiredTradeName ? <Text style={styles.meta}>Kỹ năng: {item.requiredTradeName}</Text> : null}
      <Text style={styles.meta}>Ưu tiên: {item.priority}</Text>
      <Text style={styles.meta}>Bắt đầu: {formatDateTime(item.plannedStartAt)}</Text>
      <Text style={styles.meta}>Kết thúc: {formatDateTime(item.plannedEndAt)}</Text>
      {item.jobBoard.openUntil ? (
        <Text style={styles.meta}>Nhận đến: {formatDateTime(item.jobBoard.openUntil)}</Text>
      ) : null}
      <View style={styles.ctaRow}>
        <Text accessibilityRole="button" accessibilityLabel={`view detail ${item.code}`} style={styles.cta}>
          Xem chi tiết
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 6, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 13, fontWeight: '700', color: '#374151' },
  badge: { fontSize: 12, fontWeight: '700', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, overflow: 'hidden' },
  badgeAvailable: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeOther: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  title: { fontSize: 16, fontWeight: '600', color: '#111827' },
  meta: { fontSize: 13, color: '#4b5563' },
  ctaRow: { marginTop: 4, flexDirection: 'row', justifyContent: 'flex-end' },
  cta: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
});
