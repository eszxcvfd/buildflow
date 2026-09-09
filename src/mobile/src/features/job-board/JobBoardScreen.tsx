import React from 'react';
import {
  View, Text, Pressable, ActivityIndicator, FlatList, RefreshControl, StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { fetchJobBoard, LoginError, type JobBoardItem } from '../../api/client';
import { JobBoardCard } from './JobBoardCard';

const PAGE_SIZE = 20;

/**
 * JOB-SRS-005 (issue #45) — màn hình Job Board.
 * FlatList + pull-to-refresh (reset offset 0) + "Tải thêm"/onEndReached
 * pagination (dừng khi loaded === total, khoá khi đang load).
 * States: loading / empty / error + retry / 401 re-login / 403 defensive.
 * - Nhánh 403 defensive-unreachable trên path này (server: membership rỗng →
 *   200 empty, không 403) — giữ làm #46-forward-compat (filter `projectId`
 *   thêm 403-generic ở #46).
 * - F011/F012 (phần rẻ): load-more fail → footer hiện moreError + nút thử lại
 *   (giữ list); refresh fail → GIỮ nguyên list + banner lỗi (không wipe);
 *   disable "Tải thêm" khi đang load. Full generation/cancel dedupe =
 *   follow-up #46 (ghi ENDPOINTS §20).
 */
export function JobBoardScreen({ token }: { token: string }) {
  const [items, setItems] = React.useState<JobBoardItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<LoginError | null>(null);
  const [moreError, setMoreError] = React.useState<LoginError | null>(null);
  const [refreshError, setRefreshError] = React.useState<LoginError | null>(null);
  const itemsRef = React.useRef<JobBoardItem[]>([]);
  itemsRef.current = items;

  const toLoginError = (e: unknown): LoginError =>
    e instanceof LoginError ? e : new LoginError('Không thể kết nối máy chủ, vui lòng thử lại', 0);

  const loadPage = React.useCallback(async (offset: number, mode: 'initial' | 'refresh' | 'more') => {
    if (mode === 'initial') setLoading(true);
    else if (mode === 'refresh') setRefreshing(true);
    else setLoadingMore(true);
    if (mode === 'more') setMoreError(null);
    else setError(null);
    try {
      const page = await fetchJobBoard(token, { limit: PAGE_SIZE, offset });
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
      if (mode === 'more') {
        // Load-more fail: GIỮ list hiện tại, footer hiện lỗi + thử lại.
        setMoreError(toLoginError(e));
      } else if (mode === 'refresh' && itemsRef.current.length > 0) {
        // Refresh fail: GIỮ nguyên list hiện tại + banner lỗi, không wipe.
        setRefreshError(toLoginError(e));
      } else {
        setError(toLoginError(e));
      }
    } finally {
      if (mode === 'initial') setLoading(false);
      else if (mode === 'refresh') setRefreshing(false);
      else setLoadingMore(false);
    }
  }, [token]);

  React.useEffect(() => {
    void loadPage(0, 'initial');
  }, [loadPage]);

  const retry = React.useCallback(() => {
    void loadPage(0, 'initial');
  }, [loadPage]);

  const refresh = React.useCallback(() => {
    // Pull-to-refresh: re-fetch từ đầu (offset 0) — WO bị claim giữa chừng
    // biến khỏi response tiếp theo (AC3).
    void loadPage(0, 'refresh');
  }, [loadPage]);

  const loadMore = React.useCallback(() => {
    if (loading || loadingMore || refreshing) return;
    if (items.length >= total) return;
    void loadPage(items.length, 'more');
  }, [loading, loadingMore, refreshing, items.length, total, loadPage]);

  const retryMore = React.useCallback(() => {
    void loadPage(items.length, 'more');
  }, [items.length, loadPage]);

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
    // Defensive-unreachable (server không trả 403 trên path này) —
    // giữ làm #46-forward-compat.
    return (
      <View style={styles.center}>
        <Text accessibilityRole="alert" style={styles.hint}>{error.message}</Text>
        <Pressable
          accessibilityRole="button" accessibilityLabel="retry job board"
          onPress={retry} style={[styles.button, styles.secondaryButton]}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <View accessibilityRole="alert" style={styles.errorBox}>
          <Text accessibilityLabel="job board error" style={styles.errorText}>{error.message}</Text>
        </View>
        <Pressable
          accessibilityRole="button" accessibilityLabel="retry job board"
          accessibilityState={{ busy: loading }}
          onPress={retry} style={[styles.button, styles.secondaryButton]}
        >
          {loading ? <ActivityIndicator size="small" color="#374151" /> : <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử lại</Text>}
        </Pressable>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text accessibilityLabel="no jobs" style={styles.hint}>Chưa có việc nào đang nhận — kéo xuống để làm mới</Text>
        <Pressable
          accessibilityRole="button" accessibilityLabel="retry job board"
          onPress={retry} style={[styles.button, styles.secondaryButton]}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  const hasMore = items.length < total;
  const busy = loading || loadingMore || refreshing;
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
          refreshError ? (
            <View accessibilityRole="alert" accessibilityLabel="refresh error" style={styles.refreshErrorBox}>
              <Text style={styles.refreshErrorText}>{refreshError.message}</Text>
            </View>
          ) : null
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
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', padding: 24, gap: 12 },
  hint: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 12, width: '100%' },
  errorText: { color: '#b91c1c', fontSize: 14, textAlign: 'center' },
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
});
