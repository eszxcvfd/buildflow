import React from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, StyleSheet,
} from 'react-native';
import { fetchProfile, updateProfileRequest, changePasswordRequest, LoginError, type Profile } from '../../api/client';

export function ProfileScreen({ token, onPasswordChanged }: { token: string; onPasswordChanged?: () => void }) {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  // IAM-SRS-007 change password state
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [changing, setChanging] = React.useState(false);
  const [changeError, setChangeError] = React.useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await fetchProfile(token);
      setProfile(p);
      setFullName(p.fullName ?? '');
      setPhone(p.phone ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được hồ sơ');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSuccess(false);
    setError(null);
    if (!fullName.trim()) {
      setError('Họ tên không được để trống');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfileRequest(token, { fullName: fullName.trim(), phone: phone.trim() || null });
      setProfile(updated);
      setFullName(updated.fullName ?? '');
      setPhone(updated.phone ?? '');
      setSuccess(true);
    } catch (e) {
      setError(e instanceof LoginError ? e.message : 'Không thể kết nối máy chủ, vui lòng thử lại');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    setChangeError(null);
    setChangeSuccess(false);
    if (!currentPassword) { setChangeError('Mật khẩu hiện tại không được để trống'); return; }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setChangeError('Mật khẩu mới tối thiểu 8 ký tự, chứa ít nhất một chữ cái và một chữ số');
      return;
    }
    if (confirmPassword !== newPassword) { setChangeError('Xác nhận mật khẩu không khớp'); return; }
    setChanging(true);
    try {
      await changePasswordRequest(token, currentPassword, newPassword);
      setChangeSuccess(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      // Session invalidated server-side: force re-login
      onPasswordChanged?.();
    } catch (e) {
      setChangeError(e instanceof LoginError ? e.message : 'Không thể kết nối máy chủ, vui lòng thử lại');
    } finally {
      setChanging(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center} accessible accessibilityLabel="loading profile">
        <ActivityIndicator accessibilityLabel="profile loading indicator" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>Hồ sơ cá nhân</Text>
        {error ? (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View accessibilityRole="text" style={styles.successBox}>
            <Text style={styles.successText}>Đã cập nhật hồ sơ thành công</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Email (read-only)</Text>
        <TextInput style={[styles.input, styles.readonly]} value={profile?.email ?? ''} editable={false} accessibilityLabel="email readonly" />
        <Text style={styles.label}>Vai trò (read-only)</Text>
        <TextInput style={[styles.input, styles.readonly]} value={profile?.userType ?? ''} editable={false} accessibilityLabel="role readonly" />
        <Text style={styles.label}>Trạng thái (read-only)</Text>
        <TextInput style={[styles.input, styles.readonly]} value={profile?.status ?? ''} editable={false} accessibilityLabel="status readonly" />

        <Text style={styles.label}>Họ tên</Text>
        <TextInput
          style={styles.input} value={fullName} onChangeText={setFullName}
          editable={!saving} accessibilityLabel="full name input" autoCapitalize="words"
        />
        <Text style={styles.label}>Số điện thoại</Text>
        <TextInput
          style={styles.input} value={phone} onChangeText={setPhone}
          editable={!saving} accessibilityLabel="phone input"
          keyboardType="phone-pad" autoComplete="tel"
        />

        <Pressable
          accessibilityRole="button" accessibilityLabel="save profile"
          accessibilityState={{ disabled: saving, busy: saving }}
          onPress={handleSave} style={[styles.button, saving ? styles.buttonDisabled : null]}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Lưu thay đổi</Text>}
        </Pressable>
        <Text style={styles.hint}>
          Email, vai trò và trạng thái chỉ đọc — không thể tự thay đổi (IAM-SRS-003).
        </Text>
      </View>

      {/* IAM-SRS-007: change password */}
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>Đổi mật khẩu</Text>
        <Text style={styles.hint}>Tối thiểu 8 ký tự, chứa ít nhất một chữ cái và một chữ số. Sau khi đổi, bạn sẽ phải đăng nhập lại.</Text>
        {changeError ? (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Text style={styles.errorText}>{changeError}</Text>
          </View>
        ) : null}
        {changeSuccess ? (
          <View accessibilityRole="text" style={styles.successBox}>
            <Text style={styles.successText}>Đổi mật khẩu thành công. Vui lòng đăng nhập lại.</Text>
          </View>
        ) : null}
        <Text style={styles.label}>Mật khẩu hiện tại</Text>
        <TextInput style={styles.input} secureTextEntry autoComplete="password" value={currentPassword} onChangeText={setCurrentPassword} editable={!changing} accessibilityLabel="current password input" />
        <Text style={styles.label}>Mật khẩu mới</Text>
        <TextInput style={styles.input} secureTextEntry autoComplete="new-password" value={newPassword} onChangeText={setNewPassword} editable={!changing} accessibilityLabel="new password input" />
        <Text style={styles.label}>Xác nhận mật khẩu mới</Text>
        <TextInput style={styles.input} secureTextEntry autoComplete="new-password" value={confirmPassword} onChangeText={setConfirmPassword} editable={!changing} accessibilityLabel="confirm password input" />
        <Pressable
          accessibilityRole="button" accessibilityLabel="change password"
          accessibilityState={{ disabled: changing, busy: changing }}
          onPress={handleChangePassword} style={[styles.button, changing ? styles.buttonDisabled : null]}
          disabled={changing}
        >
          {changing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Đổi mật khẩu</Text>}
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
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff',
  },
  readonly: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 12 },
  errorText: { color: '#b91c1c', fontSize: 14 },
  successBox: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1, borderRadius: 8, padding: 12 },
  successText: { color: '#14532d', fontSize: 14 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12, color: '#6b7280', marginTop: 4 },
});
