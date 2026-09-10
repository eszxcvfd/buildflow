import React from 'react';
import {
  View, Text, Pressable, ActivityIndicator, FlatList, RefreshControl, StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import {
  fetchJobBoard, fetchJobBoardFilterOptions, LoginError,
  type JobBoardFilterOptions, type JobBoardItem,
} from '../../api/client';
import { JobBoardCard } from './JobBoardCard';
import { JobBoardFilterSheet } from './JobBoardFilterSheet';
import {
  getJobBoardFilter, setJobBoardFilter, clearJobBoardFilter, hasActiveJobBoardFilter,
  bindJobBoardFilterToken,
  type JobBoardFilter,
} from './job-board-filter-state';

const PAGE_SIZE = 20;

/**
 * JOB-SRS-005 (issue #45) + JOB-SRS-006 (issue #46) — màn hình Job Board.
 * FlatList + pull-to-refresh (reset offset 0, GIỮ filter hiện hành) +
 * "Tải thêm"/onEndReached pagination (dừng khi loaded === total).
 * Filter: module-level store (giữ khi back từ `/job-board/[id]` — Expo Router
 * remount screen), FilterSheet bottom-sheet RN primitives, active-filter chips
 * (xóa từng điều kiện + xóa tất cả) + count (`total`) khi đang filter.
 * Chặn request chồng: busy-guard (filterLoading/loading/loadingMore/refreshing)
 * + generation dedupe mọi trigger (discharge follow-up #45 :540 — stale
 * response bị bỏ qua, không setState). Đổi filter luôn fetch lại offset 0.
 * Đổi tài khoản (effect `[token]`): `bindJobBoardFilterToken` clear store +
 * reset items/total/error/options/flags TRƯỚC loadPage (F003/F009/F010 —
 * không flash data cũ; cùng-token remount giữ filter).
 * Cờ busy tắt theo ref-count per mode: stale về trước không tắt spinner của
 * request mới hơn (F007). Refresh/filter fail khi list đã có items → giữ list
 * + banner lỗi + thử lại giữ filter (F004); FilterSheet mount ở mọi branch
 * có filter bar (403/error/list/empty) nên luôn có đường thoát (F005).
 * States: loading / empty / empty-filtered (riêng copy + gợi ý xóa filter) /
 * success / validation per-field (fieldErrors) / error + retry / 401 / 403
 * (reachable khi filter `projectId` ngoài scope — BD12).
 * TUYỆT ĐỐI không nút 'Nhận việc' ở mọi state (claim là #47).
 */
export function JobBoardScreen({ token }: { token: string }) {
  const [items, setItems] = React.useState<JobBoardItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [filterLoading, setFilterLoading] = React.useState(false);
  const [error, setError] = React.useState<LoginError | null>(null);
  const [moreError, setMoreError] = React.useState<LoginError | null>(null);
  const [refreshError, setRefreshError] = React.useState<LoginError | null>(null);
  const [filter, setFilter] = React.useState<JobBoardFilter>(() => getJobBoardFilter());
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [options, setOptions] = React.useState<JobBoardFilterOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = React.useState(false);
  const itemsRef = React.useRef<JobBoardItem[]>([]);
  itemsRef.current = items;
  const filterRef = React.useRef<JobBoardFilter>(filter);
  filterRef.current = filter;
  // Generation dedupe (:540): tăng ở MỌI trigger; chỉ setState khi gen còn mới.
  const genRef = React.useRef(0);
  // F007: ref-count per mode (gen → mode đang in-flight) — cờ busy của một
  // mode chỉ tắt khi không còn request nào cùng mode chưa xong (stale resolve
  // trước không được tắt spinner của request mới hơn).
  const activeModes = React.useRef(new Map<number, 'initial' | 'refresh' | 'more' | 'filter'>());
  // F006: busy đọc qua ref để guard trong callback không stale closure.
  const busyRef = React.useRef(false);

  const toLoginError = (e: unknown): LoginError =>
    e instanceof LoginError ? e : new LoginError('Không thể kết nối máy chủ, vui lòng thử lại', 0);

  const toParams = (f: JobBoardFilter, offset: number) => ({
    limit: PAGE_SIZE,
    offset,
    ...(f.projectId ? { projectId: f.projectId } : {}),
    ...(f.areaIds.length > 0 ? { areaIds: f.areaIds } : {}),
    ...(f.workTypeIds.length > 0 ? { workTypeIds: f.workTypeIds } : {}),
    ...(f.dateFrom ? { dateFrom: f.dateFrom } : {}),
    ...(f.dateTo ? { dateTo: f.dateTo } : {}),
    ...(f.skillMine ? { skill: 'mine' as const } : {}),
  });

  const loadPage = React.useCallback(async (
    offset: number,
    mode: 'initial' | 'refresh' | 'more' | 'filter',
    snapshot?: JobBoardFilter,
  ) => {
    const f = snapshot ?? filterRef.current;
    const gen = genRef.current + 1;
    genRef.current = gen;
    const isStale = () => gen !== genRef.current;
    activeModes.current.set(gen, mode);
    if (mode === 'initial') setLoading(true);
    else if (mode === 'refresh') setRefreshing(true);
    else if (mode === 'filter') setFilterLoading(true);
    else setLoadingMore(true);
    if (mode === 'more') setMoreError(null);
    else setError(null);
    try {
      const page = await fetchJobBoard(token, toParams(f, offset));
      if (isStale()) return; // stale response: bỏ qua, không setState
      setTotal(page.total);
      if (mode === 'more') {
        setMoreError(null);
        setItems((prev) => [...prev, ...page.data]);
      } else {
        setMoreError(null);
        setRefreshError(null);
        setItems(page.data);
      }
    } catch (e) {
      if (isStale()) return;
      if (mode === 'more') {
        // Load-more fail: GIỮ list hiện tại, footer hiện lỗi + thử lại.
        setMoreError(toLoginError(e));
      } else if ((mode === 'refresh' || mode === 'filter') && itemsRef.current.length > 0) {
        // F004: refresh/filter fail khi list đã có items: GIỮ nguyên list +
        // banner lỗi (mirror refreshError), không wipe về error branch.
        setRefreshError(toLoginError(e));
      } else {
        setError(toLoginError(e));
      }
    } finally {
      // F007: chỉ tắt cờ busy của mode này khi không còn request cùng mode
      // in-flight (stale về trước không tắt spinner của request mới hơn).
      activeModes.current.delete(gen);
      let sameModeInflight = false;
      activeModes.current.forEach((m) => { if (m === mode) sameModeInflight = true; });
      if (!sameModeInflight) {
        if (mode === 'initial') setLoading(false);
        else if (mode === 'refresh') setRefreshing(false);
        else if (mode === 'filter') setFilterLoading(false);
        else setLoadingMore(false);
      }
    }
  }, [token]);

  React.useEffect(() => {
    // F003/F009/F010: đổi tài khoản → clear filter store + reset UI state
    // (items/total/error/options/flags/chips) TRƯỚC loadPage — không flash data
    // cũ. Cùng-token remount (back từ detail) giữ filter (bind trả false).
    const tokenChanged = bindJobBoardFilterToken(token);
    let snapshot: JobBoardFilter | undefined;
    if (tokenChanged) {
      snapshot = getJobBoardFilter(); // đã clear → empty
      setItems([]);
      setTotal(0);
      setError(null);
      setMoreError(null);
      setRefreshError(null);
      setOptions(null);
      setFilter(snapshot);
      setSheetOpen(false);
      setLoading(true);
      setRefreshing(false);
      setLoadingMore(false);
      setFilterLoading(false);
    }
    void loadPage(0, 'initial', snapshot);
    let cancelled = false;
    const loadOptions = async () => {
      setOptionsLoading(true);
      try {
        const o = await fetchJobBoardFilterOptions(token);
        if (!cancelled) setOptions(o);
      } catch {
        if (!cancelled) setOptions(null);
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    };
    void loadOptions();
    return () => { cancelled = true; };
    // loadPage ổn định theo token — chỉ mount lại khi token đổi.
  }, [token, loadPage]);

  const retry = React.useCallback(() => {
    // F006: retry cũng zero-guard overlapping (mirror loadMore).
    if (busyRef.current) return;
    void loadPage(0, 'initial');
  }, [loadPage]);

  const retryBanner = React.useCallback(() => {
    // F004: thử lại từ banner lỗi khi list còn — giữ filter hiện hành.
    if (busyRef.current) return;
    void loadPage(0, 'filter');
  }, [loadPage]);

  const refresh = React.useCallback(() => {
    // Pull-to-refresh: re-fetch từ đầu (offset 0) GIỮ filter hiện hành —
    // WO bị claim giữa chừng biến khỏi response tiếp theo (AC3).
    // F006: guard đủ 4 cờ (refreshing/loadingMore chống refresh-during-loadMore).
    if (loading || refreshing || loadingMore || filterLoading) return;
    void loadPage(0, 'refresh');
  }, [loadPage, loading, refreshing, loadingMore, filterLoading]);

  const loadMore = React.useCallback(() => {
    if (loading || loadingMore || refreshing || filterLoading) return;
    if (items.length >= total) return;
    void loadPage(items.length, 'more');
  }, [loading, loadingMore, refreshing, filterLoading, items.length, total, loadPage]);

  const retryMore = React.useCallback(() => {
    // F006: retryMore zero-guard overlapping (mirror loadMore).
    if (loading || loadingMore || refreshing || filterLoading) return;
    void loadPage(items.length, 'more');
  }, [items.length, loadPage, loading, loadingMore, refreshing, filterLoading]);

  const applyFilter = React.useCallback((next: JobBoardFilter) => {
    // KHÔNG busy-guard ở đây: apply mới được phép supersede request cũ đang
    // in-flight (generation dedupe arbitrate — stale bị bỏ qua; sheet đã có
    // submitting guard riêng). Chặn ở đây sẽ phá pattern refresh-then-refilter.
    setJobBoardFilter(next);
    setFilter(next);
    setSheetOpen(false);
    void loadPage(0, 'filter', next);
  }, [loadPage]);

  const clearAllFilters = React.useCallback(() => {
    // F006: chips/clear-all bị chặn khi busy (tránh request chồng).
    if (busyRef.current) return;
    const next = { projectId: undefined, areaIds: [], workTypeIds: [], dateFrom: undefined, dateTo: undefined, skillMine: false };
    clearJobBoardFilter();
    setFilter(next);
    void loadPage(0, 'filter', next);
  }, [loadPage]);

  const removeChip = React.useCallback((kind: string, id?: string) => {
    if (busyRef.current) return;
    const cur = filterRef.current;
    const next: JobBoardFilter = {
      ...cur,
      projectId: kind === 'project' ? undefined : cur.projectId,
      areaIds: kind === 'area' ? cur.areaIds.filter((x) => x !== id) : [...cur.areaIds],
      workTypeIds: kind === 'type' ? cur.workTypeIds.filter((x) => x !== id) : [...cur.workTypeIds],
      dateFrom: kind === 'dateFrom' ? undefined : cur.dateFrom,
      dateTo: kind === 'dateTo' ? undefined : cur.dateTo,
      skillMine: kind === 'skill' ? false : cur.skillMine,
    };
    setJobBoardFilter(next);
    setFilter(next);
    void loadPage(0, 'filter', next);
  }, [loadPage]);

  const filtering = hasActiveJobBoardFilter(filter);
  const busy = loading || loadingMore || refreshing || filterLoading;
  busyRef.current = busy;

  const nameOf = (list: { id: string; name: string }[] | undefined, id: string) =>
    (list ?? []).find((x) => x.id === id)?.name ?? id;

  const chips: { kind: string; id?: string; label: string }[] = [];
  if (filter.projectId) chips.push({ kind: 'project', id: filter.projectId, label: `Dự án: ${nameOf(options?.projects, filter.projectId)}` });
  for (const a of filter.areaIds) chips.push({ kind: 'area', id: a, label: `Khu vực: ${nameOf(options?.areas, a)}` });
  for (const w of filter.workTypeIds) chips.push({ kind: 'type', id: w, label: `Loại: ${nameOf(options?.workTypes, w)}` });
  if (filter.dateFrom) chips.push({ kind: 'dateFrom', label: `Từ: ${filter.dateFrom}` });
  if (filter.dateTo) chips.push({ kind: 'dateTo', label: `Đến: ${filter.dateTo}` });
  if (filter.skillMine) chips.push({ kind: 'skill', label: 'Phù hợp kỹ năng của tôi' });

  const renderFilterBar = () => (
    <View style={styles.filterBar}>
      <Pressable
        accessibilityRole="button" accessibilityLabel="open job board filter"
        accessibilityState={{ disabled: filterLoading, busy: filterLoading }}
        disabled={filterLoading}
        onPress={() => setSheetOpen(true)} style={[styles.button, styles.secondaryButton]}
      >
        {filterLoading
          ? <ActivityIndicator accessibilityLabel="filter loading indicator" size="small" color="#374151" />
          : <Text style={[styles.buttonText, styles.secondaryButtonText]}>Lọc{filtering ? ` (${total})` : ''}</Text>}
      </Pressable>
      {chips.length > 0 ? (
        <View style={styles.chipsRow}>
          {chips.map((c, i) => (
            <Pressable
              key={`${c.kind}-${c.id ?? ''}-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`remove filter ${c.label}`}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => removeChip(c.kind, c.id)}
              style={styles.activeChip}
            >
              <Text style={styles.activeChipText}>{c.label} ✕</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button" accessibilityLabel="clear all job board filters"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={clearAllFilters} style={styles.clearAll}
          >
            <Text style={styles.clearAllText}>Xóa tất cả</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const renderFieldErrors = (err: LoginError) => {
    const entries = Object.entries(err.fieldErrors ?? {});
    if (entries.length === 0) return null;
    return (
      <View accessibilityLabel="job board field errors" style={styles.fieldErrorBox}>
        {entries.map(([field, msgs]) => (
          <Text key={field} accessibilityLabel={`field error ${field}`} style={styles.fieldErrorText}>
            {field}: {(msgs ?? []).join('; ')}
          </Text>
        ))}
      </View>
    );
  };

  const sheet = (
    <JobBoardFilterSheet
      visible={sheetOpen}
      initial={filter}
      options={options}
      optionsLoading={optionsLoading}
      submitting={filterLoading}
      onClose={() => setSheetOpen(false)}
      onApply={applyFilter}
    />
  );

  if (loading && items.length === 0 && !error) {
    return (
      <View style={styles.center} accessible accessibilityLabel="loading job board">
        <ActivityIndicator accessibilityLabel="job board loading indicator" />
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
    // #46-forward-compat nay reachable: filter `projectId` ngoài scope → 403-generic (BD12).
    return (
      <View style={styles.center}>
        <Text accessibilityRole="alert" style={styles.hint}>{error.message}</Text>
        {renderFilterBar()}
        <Pressable
          accessibilityRole="button" accessibilityLabel="retry job board"
          accessibilityState={{ disabled: busy, busy: loading }}
          disabled={busy}
          onPress={retry} style={[styles.button, styles.secondaryButton]}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử lại</Text>
        </Pressable>
        {filtering ? (
          <Pressable
            accessibilityRole="button" accessibilityLabel="clear all job board filters"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={clearAllFilters} style={[styles.button, styles.secondaryButton]}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Xóa bộ lọc</Text>
          </Pressable>
        ) : null}
        {sheet}
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <View accessibilityRole="alert" style={styles.errorBox}>
          <Text accessibilityLabel="job board error" style={styles.errorText}>{error.message}</Text>
        </View>
        {renderFieldErrors(error)}
        {renderFilterBar()}
        <Pressable
          accessibilityRole="button" accessibilityLabel="retry job board"
          accessibilityState={{ disabled: busy, busy: loading }}
          disabled={busy}
          onPress={retry} style={[styles.button, styles.secondaryButton]}
        >
          {loading ? <ActivityIndicator size="small" color="#374151" /> : <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử lại</Text>}
        </Pressable>
        {sheet}
      </View>
    );
  }

  if (items.length === 0) {
    if (filtering) {
      // Empty-filtered ≠ empty-board: gợi ý xóa filter.
      return (
        <View style={styles.center}>
          {renderFilterBar()}
          <Text accessibilityLabel="no jobs matching filter" style={styles.hint}>
            Không có việc nào khớp bộ lọc — thử nới điều kiện hoặc xóa bộ lọc
          </Text>
          {sheet}
        </View>
      );
    }
    return (
      <View style={styles.center}>
        {renderFilterBar()}
        <Text accessibilityLabel="no jobs" style={styles.hint}>Chưa có việc nào đang nhận — kéo xuống để làm mới</Text>
        <Pressable
          accessibilityRole="button" accessibilityLabel="retry job board"
          onPress={retry} style={[styles.button, styles.secondaryButton]}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử lại</Text>
        </Pressable>
        {sheet}
      </View>
    );
  }

  const hasMore = items.length < total;
  return (
    <View style={styles.list}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <JobBoardCard item={item} />}
        refreshControl={
          <RefreshControl
            accessibilityLabel="refresh job board"
            refreshing={refreshing}
            onRefresh={refresh}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            {renderFilterBar()}
            {refreshError ? (
              <View accessibilityRole="alert" accessibilityLabel="refresh error" style={styles.refreshErrorBox}>
                <Text style={styles.refreshErrorText}>{refreshError.message}</Text>
                <Pressable
                  accessibilityRole="button" accessibilityLabel="retry job board refresh"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={retryBanner} style={[styles.button, styles.secondaryButton]}
                >
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử lại</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer} accessible accessibilityLabel="loading more jobs">
              <ActivityIndicator accessibilityLabel="job board loading more indicator" size="small" />
            </View>
          ) : moreError ? (
            <View style={styles.footer}>
              <Text accessibilityLabel="load more error" style={styles.moreErrorText}>{moreError.message}</Text>
              <Pressable
                accessibilityRole="button" accessibilityLabel="retry load more"
                accessibilityState={{ disabled: busy, busy: loadingMore }}
                disabled={busy}
                onPress={retryMore} style={[styles.button, styles.secondaryButton]}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử lại</Text>
              </Pressable>
            </View>
          ) : hasMore ? (
            <Pressable
              accessibilityRole="button" accessibilityLabel="load more jobs"
              accessibilityState={{ disabled: busy, busy: loadingMore }}
              disabled={busy}
              onPress={loadMore} style={[styles.button, styles.secondaryButton]}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>Tải thêm</Text>
            </Pressable>
          ) : null
        }
      />
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', padding: 24, gap: 12 },
  hint: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 12, width: '100%' },
  errorText: { color: '#b91c1c', fontSize: 14, textAlign: 'center' },
  fieldErrorBox: { backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: 8, padding: 12, width: '100%' },
  fieldErrorText: { color: '#92400e', fontSize: 13, textAlign: 'center' },
  refreshErrorBox: { backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  refreshErrorText: { color: '#92400e', fontSize: 14, textAlign: 'center' },
  moreErrorText: { color: '#b91c1c', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryButton: { backgroundColor: '#e5e7eb' },
  secondaryButtonText: { color: '#374151' },
  list: { flex: 1, backgroundColor: '#f9fafb' },
  listContent: { padding: 16, gap: 12 },
  footer: { paddingVertical: 12, alignItems: 'center' },
  filterBar: { marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  activeChip: { backgroundColor: '#dbeafe', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 10 },
  activeChipText: { color: '#1d4ed8', fontSize: 13, fontWeight: '600' },
  clearAll: { paddingVertical: 6, paddingHorizontal: 10 },
  clearAllText: { color: '#b91c1c', fontSize: 13, fontWeight: '600' },
});
