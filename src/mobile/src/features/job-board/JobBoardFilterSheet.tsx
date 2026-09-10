import React from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ActivityIndicator, StyleSheet, ScrollView,
} from 'react-native';
import type { JobBoardFilterOptions } from '../../api/client';
import {
  EMPTY_JOB_BOARD_FILTER, validateJobBoardFilterDates, type JobBoardFilter,
} from './job-board-filter-state';

export interface JobBoardFilterSheetProps {
  visible: boolean;
  initial: JobBoardFilter;
  options: JobBoardFilterOptions | null;
  optionsLoading: boolean;
  submitting: boolean;
  onClose: () => void;
  onApply: (filter: JobBoardFilter) => void;
}

/**
 * JOB-SRS-006 (issue #46) — FilterSheet (RN primitives, không Ark UI):
 * project single-select + area/workType multi-chips + skill=mine toggle +
 * date range (TextInput ISO có device offset, thí dụ `2026-02-10T00:00:00+07:00`)
 * + reset + client validation mirror server (chặn gửi khi from > to).
 */
export function JobBoardFilterSheet({
  visible, initial, options, optionsLoading, submitting, onClose, onApply,
}: JobBoardFilterSheetProps) {
  const [projectId, setProjectId] = React.useState(initial.projectId ?? '');
  const [areaIds, setAreaIds] = React.useState<string[]>(initial.areaIds);
  const [workTypeIds, setWorkTypeIds] = React.useState<string[]>(initial.workTypeIds);
  const [dateFrom, setDateFrom] = React.useState(initial.dateFrom ?? '');
  const [dateTo, setDateTo] = React.useState(initial.dateTo ?? '');
  const [skillMine, setSkillMine] = React.useState(initial.skillMine);
  const [fieldErrors, setFieldErrors] = React.useState<{ dateFrom?: string[]; dateTo?: string[] }>({});

  React.useEffect(() => {
    if (visible) {
      setProjectId(initial.projectId ?? '');
      setAreaIds([...initial.areaIds]);
      setWorkTypeIds([...initial.workTypeIds]);
      setDateFrom(initial.dateFrom ?? '');
      setDateTo(initial.dateTo ?? '');
      setSkillMine(initial.skillMine);
      setFieldErrors({});
    }
  }, [visible, initial]);

  const toggle = (list: string[], id: string, set: (v: string[]) => void) => {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const apply = () => {
    const from = dateFrom.trim() || undefined;
    const to = dateTo.trim() || undefined;
    const errs = validateJobBoardFilterDates(from, to);
    setFieldErrors(errs);
    if (errs.dateFrom || errs.dateTo) return; // chặn gửi khi client-validate fail
    onApply({
      projectId: projectId || undefined,
      areaIds,
      workTypeIds,
      dateFrom: from,
      dateTo: to,
      skillMine,
    });
  };

  const reset = () => {
    setProjectId('');
    setAreaIds([]);
    setWorkTypeIds([]);
    setDateFrom('');
    setDateTo('');
    setSkillMine(false);
    setFieldErrors({});
    onApply({ ...EMPTY_JOB_BOARD_FILTER, areaIds: [], workTypeIds: [] });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet} accessibilityLabel="job board filter sheet">
          <ScrollView>
            <Text style={styles.title}>Lọc bảng việc</Text>
            {optionsLoading ? (
              <ActivityIndicator accessibilityLabel="filter options loading" />
            ) : (
              <>
                <Text style={styles.section}>Dự án</Text>
                {(options?.projects ?? []).map((p) => {
                  const active = projectId === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityLabel={`filter project ${p.name}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => setProjectId(active ? '' : p.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={active ? styles.chipTextActive : styles.chipText}>{p.name}</Text>
                    </Pressable>
                  );
                })}
                <Text style={styles.section}>Khu vực</Text>
                {(options?.areas ?? []).map((a) => {
                  const active = areaIds.includes(a.id);
                  return (
                    <Pressable
                      key={a.id}
                      accessibilityRole="button"
                      accessibilityLabel={`filter area ${a.name}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => toggle(areaIds, a.id, setAreaIds)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={active ? styles.chipTextActive : styles.chipText}>{a.name}</Text>
                    </Pressable>
                  );
                })}
                <Text style={styles.section}>Loại công việc</Text>
                {(options?.workTypes ?? []).map((w) => {
                  const active = workTypeIds.includes(w.id);
                  return (
                    <Pressable
                      key={w.id}
                      accessibilityRole="button"
                      accessibilityLabel={`filter work type ${w.name}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => toggle(workTypeIds, w.id, setWorkTypeIds)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={active ? styles.chipTextActive : styles.chipText}>{w.name}</Text>
                    </Pressable>
                  );
                })}
              </>
            )}
            <Text style={styles.section}>Từ ngày (ISO kèm múi giờ)</Text>
            <TextInput
              accessibilityLabel="filter date from input"
              value={dateFrom}
              onChangeText={setDateFrom}
              placeholder="2026-02-10T00:00:00+07:00"
              style={styles.input}
            />
            {fieldErrors.dateFrom ? (
              <Text accessibilityLabel="filter date from error" style={styles.fieldError}>
                {fieldErrors.dateFrom.join('; ')}
              </Text>
            ) : null}
            <Text style={styles.section}>Đến ngày (ISO kèm múi giờ)</Text>
            <TextInput
              accessibilityLabel="filter date to input"
              value={dateTo}
              onChangeText={setDateTo}
              placeholder="2026-02-20T00:00:00+07:00"
              style={styles.input}
            />
            {fieldErrors.dateTo ? (
              <Text accessibilityLabel="filter date to error" style={styles.fieldError}>
                {fieldErrors.dateTo.join('; ')}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="filter skill mine toggle"
              accessibilityState={{ checked: skillMine }}
              onPress={() => setSkillMine(!skillMine)}
              style={[styles.chip, skillMine && styles.chipActive]}
            >
              <Text style={skillMine ? styles.chipTextActive : styles.chipText}>
                Chỉ việc phù hợp kỹ năng của tôi
              </Text>
            </Pressable>
          </ScrollView>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button" accessibilityLabel="reset job board filter"
              onPress={reset} style={[styles.button, styles.secondary]}
            >
              <Text style={styles.secondaryText}>Xoá bộ lọc</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button" accessibilityLabel="apply job board filter"
              accessibilityState={{ busy: submitting, disabled: submitting }}
              disabled={submitting}
              onPress={apply} style={styles.button}
            >
              {submitting
                ? <ActivityIndicator accessibilityLabel="applying filter" size="small" color="#fff" />
                : <Text style={styles.buttonText}>Áp dụng</Text>}
            </Pressable>
            <Pressable
              accessibilityRole="button" accessibilityLabel="close job board filter"
              onPress={onClose} style={[styles.button, styles.secondary]}
            >
              <Text style={styles.secondaryText}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 16, maxHeight: '85%' },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  section: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  chip: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 6 },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 14, color: '#374151' },
  chipTextActive: { fontSize: 14, color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 14 },
  fieldError: { color: '#b91c1c', fontSize: 13, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  button: { flex: 1, backgroundColor: '#2563eb', borderRadius: 8, padding: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondary: { backgroundColor: '#e5e7eb' },
  secondaryText: { color: '#374151', fontSize: 15, fontWeight: '600' },
});
