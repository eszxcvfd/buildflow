import React from 'react';
import {
  View, Text, Pressable, ActivityIndicator, ScrollView, RefreshControl, StyleSheet,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { fetchJobBoardDetail, LoginError, type JobBoardDetail, type JobBoardState } from '../../api/client';

function formatDateTime(value: string | null | undefined): string {
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

function Section({ title, labelId, children }: { title: string; labelId: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" accessibilityLabel={labelId} style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function purposeLabel(purpose: string): string {
  if (purpose === 'PRE_START') return 'Trước khi bắt đầu';
  if (purpose === 'INSPECTION') return 'Kiểm tra';
  if (purpose === 'WORK_DONE') return 'Nghiệm thu';
  return purpose;
}

function stateBannerCopy(state: JobBoardState, openFrom: string | null): string {
  if (state === 'SCHEDULED') return `Chưa tới thời điểm nhận việc — mở lúc ${formatDateTime(openFrom)}`;
  if (state === 'EXPIRED') return 'Cửa sổ nhận việc đã hết — kéo xuống để làm mới hoặc liên hệ điều phối';
  if (state === 'ASSIGNED') return 'Công việc đã có người nhận';
  return 'Công việc hiện không nhận';
}

function formatRequiredFields(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value || '—';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ');
  }
  return JSON.stringify(value);
}

type LoadReason = 'initial' | 'refresh' | 'recheck' | 'focus';

/**
 * JOB-SRS-007 (issue #47) — detail đầy đủ (BD6: nâng cấp tại chỗ
 * `WorkOrderPreviewScreen`, giữ tên file/export, 1 consumer `[id].tsx`).
 * Nguồn duy nhất `GET /api/v1/job-board/:id` (`fetchJobBoardDetail`,
 * contract ENDPOINTS §20.2): sections thời gian + cửa sổ nhận việc, địa điểm,
 * project/loại/yêu cầu (trade + requiredFields), mô tả/hướng dẫn, customFields,
 * checklists (grouping purpose + badge required/blocking/photo), banner theo
 * state, CTA matrix §3.4.
 *
 * - CTA "Nhận việc" chỉ khi AVAILABLE; onPress = re-fetch re-check — vẫn
 *   AVAILABLE → hint #48 (KHÔNG network command mới, không route ảo; claim
 *   thật là #48). Mọi state khác → ẩn CTA + banner lý do.
 * - State đổi giữa chừng (state/version khác snapshot đang hiển thị) → banner
 *   "Trạng thái công việc đã thay đổi" + "Tải lại" (re-fetch, giữ data cũ).
 * - 403 trên BẤT KỲ fetch nào (kể cả re-fetch) → xóa detail, render forbidden
 *   (AC-7, không render stale). 409 `JOB_BOARD_CONFIG_INVALID` → banner
 *   config-issue riêng, không render sai (AC-6).
 * - F001 catch-order: 404/409 trên re-fetch cũng xóa detail (gone screen /
 *   config screen, CTA biến mất); keep-data chỉ cho 0/network/5xx.
 * - Re-fetch lúc mount + focus (`useFocusEffect`, busy-guard chống double-fire
 *   R6) + pull-refresh (giữ data cũ khi fetch; lỗi refresh → banner inline,
 *   không xóa data). Không PII: response không có `createdBy`, screen không
 *   render gì ngoài contract.
 */
export function WorkOrderPreviewScreen({ token, workOrderId }: { token: string; workOrderId: string }) {
  const [detail, setDetail] = React.useState<JobBoardDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<LoginError | null>(null);
  const [refreshError, setRefreshError] = React.useState<LoginError | null>(null);
  const [stateChanged, setStateChanged] = React.useState(false);
  const [claimHint, setClaimHint] = React.useState(false);
  const generationRef = React.useRef(0);
  const busyRef = React.useRef(false);
  const detailRef = React.useRef<JobBoardDetail | null>(null);
  detailRef.current = detail;

  const load = React.useCallback(async (reason: LoadReason) => {
    // R6/busy-guard (tiền lệ #46): không chồng request — focus-fire lúc mount
    // (useEffect + useFocusEffect cùng chạy) request sau thắng qua generation.
    if (busyRef.current) return;
    busyRef.current = true;
    const gen = generationRef.current + 1;
    generationRef.current = gen;
    const hadData = detailRef.current !== null;
    if (!hadData) {
      setLoading(true);
      setError(null);
    } else if (reason === 'refresh') {
      setRefreshing(true);
    }
    if (reason !== 'refresh') setRefreshError(null);
    try {
      const result = await fetchJobBoardDetail(token, workOrderId);
      if (generationRef.current !== gen) return; // stale bị bỏ qua
      const prev = detailRef.current;
      if (prev && (prev.jobBoard?.state !== result.jobBoard?.state || prev.version !== result.version)) {
        setStateChanged(true);
      }
      setDetail(result);
      setError(null);
      if (reason === 'recheck' && result.jobBoard?.state === 'AVAILABLE') {
        setClaimHint(true);
      } else if (reason !== 'recheck') {
        setClaimHint(false);
      }
      if (reason === 'refresh') setRefreshError(null);
    } catch (e) {
      if (generationRef.current !== gen) return; // stale bị bỏ qua
      const err = e instanceof LoginError ? e : new LoginError('Không thể kết nối máy chủ, vui lòng thử lại', 0);
      if (err.status === 403) {
        // AC-7: permission mất → xóa detail, render forbidden (không stale).
        setDetail(null);
        setStateChanged(false);
        setClaimHint(false);
        setError(err);
      } else if (err.status === 404) {
        // F001: re-fetch nhận 404 → công việc không còn → xóa detail, tái
        // dùng gone screen (không giữ data cũ, không còn CTA Nhận việc).
        setDetail(null);
        setStateChanged(false);
        setClaimHint(false);
        setError(err);
      } else if (err.status === 409 || err.code === 'JOB_BOARD_CONFIG_INVALID') {
        // F001: re-fetch nhận 409 → work-type reference lỗi → xóa detail,
        // tái dùng config screen (giữ code), không render sai.
        setDetail(null);
        setStateChanged(false);
        setClaimHint(false);
        setError(err);
      } else if (hadData && reason !== 'initial' && (err.status === 0 || err.status >= 500)) {
        // Keep-data CHỈ cho 0/network/5xx: lỗi tạm → giữ data cũ + banner inline.
        if (reason === 'refresh') setRefreshError(err);
        else setRefreshError(err);
      } else {
        setError(err);
      }
    } finally {
      if (generationRef.current === gen) {
        busyRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [token, workOrderId]);

  React.useEffect(() => {
    void load('initial');
  }, [load]);

  useFocusEffect(React.useCallback(() => {
    // Focus re-fetch (BD-5) — bỏ qua khi mount đang fetch (busy) hoặc chưa có
    // data (mount-effect lo), tránh double-fire R6.
    if (!busyRef.current && detailRef.current) void load('focus');
  }, [load]));

  const onRefresh = React.useCallback(() => {
    if (busyRef.current) return;
    void load('refresh');
  }, [load]);

  const onClaimPress = React.useCallback(() => {
    // BD-4: onPress = re-fetch re-check, không network command mới. Vẫn
    // AVAILABLE → hint #48 (claim command thật thuộc #48).
    if (busyRef.current) return;
    setClaimHint(false);
    void load('recheck');
  }, [load]);

  const onReloadChanged = React.useCallback(() => {
    setStateChanged(false);
    setClaimHint(false);
    void load('refresh');
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

  if (error?.status === 403) {
    // AC-7 — permission mất (scope đổi / deep-link ngoài scope / id lạ):
    // detail đã xóa, render forbidden, KHÔNG "Thử lại" stale.
    return (
      <View style={styles.center}>
        <View accessibilityRole="alert" accessibilityLabel="detail forbidden" style={styles.bannerBox}>
          <Text style={styles.bannerText}>
            Bạn không có quyền xem công việc này — có thể bạn đã rời dự án hoặc liên kết không thuộc phạm vi của bạn.
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

  if (error?.status === 404) {
    // F013 — 404: công việc không còn (đã xóa / ADMIN + id missing) →
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

  if (error && (error.status === 409 || error.code === 'JOB_BOARD_CONFIG_INVALID')) {
    // AC-6 — work-type reference lỗi: banner config-issue riêng, không render
    // sai, không toast generic.
    return (
      <View style={styles.center}>
        <View accessibilityRole="alert" accessibilityLabel="detail config error" style={styles.errorBox}>
          <Text style={styles.errorText}>
            Cấu hình công việc đang lỗi ({error.code ?? 'JOB_BOARD_CONFIG_INVALID'}) — {error.message}.
            Vui lòng liên hệ điều phối, không nên nhận việc này lúc này.
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
          onPress={() => load('initial')} style={[styles.button, styles.secondaryButton]}
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

  const state = detail.jobBoard?.state ?? 'CLOSED';
  const stateKey = state.toLowerCase();
  const available = state === 'AVAILABLE';
  const customEntries = Object.entries(detail.customFields ?? {});
  const groups: { purpose: string; list: JobBoardDetail['checklists'] }[] = [];
  for (const c of detail.checklists ?? []) {
    const g = groups.find((x) => x.purpose === c.purpose);
    if (g) g.list.push(c);
    else groups.push({ purpose: c.purpose, list: [c] });
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      accessibilityLabel="job board detail scroll"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} accessibilityLabel="refresh job board detail" />}
    >
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>{detail.title}</Text>
        <Text style={styles.code}>{detail.code}</Text>

        {stateChanged ? (
          <View accessibilityRole="alert" accessibilityLabel="detail state changed" style={styles.changedBox}>
            <Text style={styles.changedText}>
              Trạng thái công việc đã thay đổi (hiện tại: {state}) — thông tin bên dưới đã được cập nhật.
            </Text>
            <Pressable
              accessibilityRole="button" accessibilityLabel="reload detail"
              onPress={onReloadChanged} style={[styles.button, styles.secondaryButton]}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>Tải lại</Text>
            </Pressable>
          </View>
        ) : null}

        {!available ? (
          <View accessibilityRole="alert" accessibilityLabel={`state banner ${stateKey}`} style={styles.bannerBox}>
            <Text style={styles.bannerText}>{stateBannerCopy(state, detail.jobBoard?.openFrom ?? null)}</Text>
          </View>
        ) : null}

        {refreshError ? (
          <View accessibilityRole="alert" accessibilityLabel="refresh error" style={styles.refreshErrorBox}>
            <Text style={styles.refreshErrorText}>Làm mới thất bại: {refreshError.message} — đang hiển thị dữ liệu cũ.</Text>
            <Pressable
              accessibilityRole="button" accessibilityLabel="retry detail refresh"
              onPress={() => load('refresh')} style={[styles.button, styles.secondaryButton]}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử làm mới</Text>
            </Pressable>
          </View>
        ) : null}

        {available ? (
          <Pressable
            accessibilityRole="button" accessibilityLabel="claim job button"
            accessibilityState={{ busy: refreshing }}
            onPress={onClaimPress} style={styles.button}
          >
            <Text style={styles.buttonText}>Nhận việc</Text>
          </Pressable>
        ) : null}
        {available && claimHint ? (
          <View accessibilityRole="alert" accessibilityLabel="claim placeholder hint" style={styles.hintBox}>
            <Text style={styles.hintText}>Chức năng nhận việc sẽ khả dụng ở bản cập nhật tiếp theo (#48).</Text>
          </View>
        ) : null}

        <Section title="Thời gian" labelId="detail section time">
          <Field label="Bắt đầu" value={formatDateTime(detail.plannedStartAt)} labelId="detail planned start" />
          <Field label="Kết thúc" value={formatDateTime(detail.plannedEndAt)} labelId="detail planned end" />
          <Field label="Hạn hoàn thành" value={formatDateTime(detail.dueAt)} labelId="detail due at" />
          <Field label="Cửa sổ nhận việc" value={`${formatDateTime(detail.jobBoard?.openFrom ?? null)} → ${formatDateTime(detail.jobBoard?.openUntil ?? null)}`} labelId="detail claim window" />
          {detail.plannedHeadcount !== null && detail.plannedHeadcount !== undefined
            ? <Field label="Số người cần" value={String(detail.plannedHeadcount)} labelId="detail headcount" />
            : null}
        </Section>

        <Section title="Địa điểm" labelId="detail section location">
          <Field label="Dự án" value={detail.projectName ?? '—'} labelId="detail project" />
          <Field label="Khu vực" value={detail.areaName ?? '—'} labelId="detail area" />
        </Section>

        <Section title="Loại công việc & yêu cầu" labelId="detail section type">
          <Field label="Loại công việc" value={detail.workTypeName} labelId="detail work type" />
          {detail.workTypeDescription ? <Field label="Mô tả loại việc" value={detail.workTypeDescription} labelId="detail work type description" /> : null}
          <Field label="Dữ liệu cần chuẩn bị" value={formatRequiredFields(detail.workTypeRequiredFields)} labelId="detail required fields" />
          <Field label="Yêu cầu thợ" value={detail.requiredTradeName ?? '—'} labelId="detail trade" />
          <Field label="Trạng thái" value={detail.status} labelId="detail status" />
          <Field label="Ưu tiên" value={detail.priority} labelId="detail priority" />
        </Section>

        <Section title="Mô tả" labelId="detail section description">
          <Text accessibilityLabel="detail description" style={styles.body}>{detail.description ?? '—'}</Text>
        </Section>

        <Section title="Hướng dẫn" labelId="detail section instructions">
          <Text accessibilityLabel="detail instructions" style={styles.body}>{detail.instructions ?? '—'}</Text>
        </Section>

        <Section title="Dữ liệu chuẩn bị thêm" labelId="detail section custom">
          {customEntries.length === 0 ? (
            <Text accessibilityLabel="detail custom empty" style={styles.hint}>Không có dữ liệu chuẩn bị thêm.</Text>
          ) : customEntries.map(([k, v]) => (
            <Field key={k} label={k} value={String(v)} labelId={`custom field ${k}`} />
          ))}
        </Section>

        <Section title="Checklist liên quan" labelId="detail section checklists">
          {groups.length === 0 ? (
            <Text accessibilityLabel="detail checklists empty" style={styles.hint}>Không có checklist liên quan được cấu hình.</Text>
          ) : groups.map((g) => (
            <View key={g.purpose} style={styles.group}>
              <Text accessibilityLabel={`checklist group ${g.purpose}`} style={styles.groupTitle}>
                {purposeLabel(g.purpose)} ({g.list.length})
              </Text>
              {g.list.map((c) => (
                <View key={c.id} style={styles.checklist}>
                  <Text accessibilityLabel={`checklist ${c.code}`} style={styles.checklistName}>
                    {c.name} · {c.code} · v{c.version}
                  </Text>
                  {c.description ? <Text style={styles.checklistDesc}>{c.description}</Text> : null}
                  {c.items.map((it) => (
                    <View key={`${c.id}-${it.sequenceNo}`} style={styles.item}>
                      <Text accessibilityLabel={`checklist item ${c.code} ${it.sequenceNo}`} style={styles.itemTitle}>
                        {it.sequenceNo}. {it.title}
                      </Text>
                      {it.description ? <Text style={styles.itemDesc}>{it.description}</Text> : null}
                      <Text style={styles.badges}>
                        {it.isRequired ? 'Bắt buộc' : 'Tùy chọn'}
                        {it.isBlocking ? ' · Chặn' : ''}
                        {it.requiresPhoto ? ' · Cần ảnh' : ''}
                        {` · ${it.answerType}`}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </Section>

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
  hintBox: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1, borderRadius: 8, padding: 12 },
  hintText: { color: '#1d4ed8', fontSize: 14, textAlign: 'center' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 12, width: '100%' },
  errorText: { color: '#b91c1c', fontSize: 14, textAlign: 'center' },
  bannerBox: { backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: 8, padding: 12 },
  bannerText: { color: '#92400e', fontSize: 14 },
  changedBox: { backgroundColor: '#eff6ff', borderColor: '#93c5fd', borderWidth: 1, borderRadius: 8, padding: 12, gap: 8 },
  changedText: { color: '#1e40af', fontSize: 14 },
  refreshErrorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 12, gap: 8 },
  refreshErrorText: { color: '#b91c1c', fontSize: 14 },
  section: { gap: 6, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  group: { gap: 6 },
  groupTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  checklist: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, gap: 6 },
  checklistName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  checklistDesc: { fontSize: 13, color: '#6b7280' },
  item: { gap: 2, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#e5e7eb' },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemDesc: { fontSize: 13, color: '#6b7280' },
  badges: { fontSize: 12, color: '#4b5563' },
  body: { fontSize: 15, color: '#111827' },
  field: { gap: 2 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  fieldValue: { fontSize: 15, color: '#111827' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryButton: { backgroundColor: '#e5e7eb' },
  secondaryButtonText: { color: '#374151' },
});
