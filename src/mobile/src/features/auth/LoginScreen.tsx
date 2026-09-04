import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { loginRequest, logoutRequest, requestPasswordResetRequest, confirmPasswordResetRequest, LoginError, type LoginSuccess } from '../../api/client';
import { saveSession, getSession, isSessionExpired, clearSession } from '../../storage/session';
import { ProfileScreen } from '../profile/ProfileScreen';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen({ onSession }: { onSession?: (session: LoginSuccess) => void }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [session, setSession] = React.useState<LoginSuccess | null>(null);
  const [restoring, setRestoring] = React.useState(true);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [logoutError, setLogoutError] = React.useState<string | null>(null);
  const [showProfile, setShowProfile] = React.useState(false);
  // IAM-SRS-007: forgot/reset password modes
  const [mode, setMode] = React.useState<'login' | 'forgot' | 'reset'>('login');
  const [forgotEmail, setForgotEmail] = React.useState('');
  const [forgotBusy, setForgotBusy] = React.useState(false);
  const [forgotDone, setForgotDone] = React.useState(false);
  const [forgotError, setForgotError] = React.useState<string | null>(null);
  const [resetToken, setResetToken] = React.useState('');
  const [resetNewPassword, setResetNewPassword] = React.useState('');
  const [resetBusy, setResetBusy] = React.useState(false);
  const [resetDone, setResetDone] = React.useState(false);
  const [resetError, setResetError] = React.useState<string | null>(null);

  const restore = React.useCallback(async () => {
    setRestoring(true);
    try {
      const stored = await getSession();
      if (stored && !(await isSessionExpired(stored))) {
        setSession(stored);
      } else if (stored) {
        await clearSession();
      }
    } finally {
      setRestoring(false);
    }
  }, []);

  React.useEffect(() => {
    void restore();
  }, [restore]);

  async function handleSubmit() {
    setGlobalError(null);
    const errors: Record<string, string[]> = {};
    const trimmed = email.trim();
    if (!trimmed) errors.email = ['Email không được để trống'];
    else if (!EMAIL_RE.test(trimmed)) errors.email = ['Email không hợp lệ'];
    if (!password) errors.password = ['Mật khẩu không được để trống'];
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const result = await loginRequest(trimmed, password);
      await saveSession(result);
      setSession(result);
      setPassword('');
      onSession?.(result);
    } catch (e) {
      if (e instanceof LoginError) {
        setGlobalError(e.message);
      } else {
        setGlobalError('Không thể kết nối máy chủ, vui lòng thử lại');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      // Server-side revocation first (IAM-SRS-002: logout must invalidate the session,
      // not just clear the UI). Idempotent: 200 and 401 both mean the session is dead.
      await logoutRequest(session?.accessToken ?? '');
      setLogoutError(null);
    } catch {
      // Network failure: keep local state, surface retry-safe error (no data loss).
      setLogoutError('Không thể kết nối máy chủ — phiên chưa được thu hồi, vui lòng thử lại');
      return;
    } finally {
      setLoggingOut(false);
    }
    await clearSession();
    setSession(null);
    setEmail('');
    setPassword('');
    setFieldErrors({});
    setGlobalError(null);
  }

  if (restoring) {
    return (
      <View style={styles.center} accessible accessibilityLabel="loading session">
        <ActivityIndicator accessibilityLabel="session loading indicator" />
      </View>
    );
  }

  if (session) {
    if (showProfile) {
      return <ProfileScreen token={session.accessToken} onPasswordChanged={() => { setSession(null); setShowProfile(false); }} />;
    }
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            Xin chào, {session.user.fullName}
          </Text>
          <Text style={styles.subtitle}>{session.user.email}</Text>
          <Text style={styles.info}>
            Vai trò: {session.roles.map((r) => r.code).join(', ') || '—'}
          </Text>
          <Text style={styles.info}>
            Dự án: {session.projectIds.length ? session.projectIds.join(', ') : '— (chưa gán dự án)'}
          </Text>
          <Text style={styles.hint}>
            Phiên hết hạn: {new Date(session.expiresAt).toLocaleString()}
          </Text>
          {logoutError ? (
            <View accessibilityRole="alert" style={styles.errorBox}>
              <Text style={styles.errorText}>{logoutError}</Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="view profile"
            onPress={() => setShowProfile(true)}
            style={[styles.button, styles.secondaryButton]}
            disabled={loggingOut}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Xem hồ sơ</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="logout"
            onPress={handleLogout}
            style={[styles.button, styles.secondaryButton]}
            disabled={loggingOut}
            accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color="#374151" />
            ) : (
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>Đăng xuất</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {mode === 'forgot' ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>Quên mật khẩu</Text>
          {forgotDone ? (
            <View accessibilityRole="text" style={styles.successBox}>
              <Text style={styles.successText}>Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.</Text>
            </View>
          ) : null}
          {forgotError ? (
            <View accessibilityRole="alert" style={styles.errorBox}>
              <Text style={styles.errorText}>{forgotError}</Text>
            </View>
          ) : null}
          {!forgotDone ? (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={forgotEmail} onChangeText={setForgotEmail} editable={!forgotBusy} accessibilityLabel="forgot email input" />
              <Pressable accessibilityRole="button" accessibilityLabel="send reset request" onPress={async () => {
                setForgotError(null);
                if (!forgotEmail.trim()) { setForgotError('Email không được để trống'); return; }
                setForgotBusy(true);
                try { await requestPasswordResetRequest(forgotEmail.trim()); setForgotDone(true); } catch (e) { setForgotError(e instanceof LoginError ? e.message : 'Gửi yêu cầu thất bại'); } finally { setForgotBusy(false); }
              }} style={[styles.button, forgotBusy ? styles.buttonDisabled : null]} disabled={forgotBusy}>
                {forgotBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Gửi hướng dẫn đặt lại</Text>}
              </Pressable>
            </>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => { setMode('login'); setForgotDone(false); setForgotError(null); }} style={[styles.button, styles.secondaryButton]}>
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Quay lại đăng nhập</Text>
          </Pressable>
        </View>
      ) : mode === 'reset' ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>Đặt lại mật khẩu</Text>
          <Text style={styles.hint}>Dán token từ link đặt lại (một lần, có thời hạn).</Text>
          {resetDone ? (
            <View accessibilityRole="text" style={styles.successBox}>
              <Text style={styles.successText}>Đổi mật khẩu thành công. Vui lòng đăng nhập lại.</Text>
            </View>
          ) : null}
          {resetError ? (
            <View accessibilityRole="alert" style={styles.errorBox}>
              <Text style={styles.errorText}>{resetError}</Text>
            </View>
          ) : null}
          {!resetDone ? (
            <>
              <Text style={styles.label}>Token đặt lại</Text>
              <TextInput style={styles.input} autoCapitalize="none" value={resetToken} onChangeText={setResetToken} editable={!resetBusy} accessibilityLabel="reset token input" />
              <Text style={styles.label}>Mật khẩu mới</Text>
              <TextInput style={styles.input} secureTextEntry autoComplete="new-password" value={resetNewPassword} onChangeText={setResetNewPassword} editable={!resetBusy} accessibilityLabel="reset new password input" />
              <Pressable accessibilityRole="button" accessibilityLabel="confirm reset" onPress={async () => {
                setResetError(null);
                if (!resetToken.trim()) { setResetError('Token không được để trống'); return; }
                if (resetNewPassword.length < 8 || !/[A-Za-z]/.test(resetNewPassword) || !/[0-9]/.test(resetNewPassword)) { setResetError('Mật khẩu mới tối thiểu 8 ký tự, chứa chữ cái và chữ số'); return; }
                setResetBusy(true);
                try { await confirmPasswordResetRequest(resetToken.trim(), resetNewPassword); setResetDone(true); } catch (e) { setResetError(e instanceof LoginError ? e.message : 'Đặt lại thất bại'); } finally { setResetBusy(false); }
              }} style={[styles.button, resetBusy ? styles.buttonDisabled : null]} disabled={resetBusy}>
                {resetBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Đặt lại mật khẩu</Text>}
              </Pressable>
            </>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => { setMode('login'); setResetDone(false); setResetError(null); }} style={[styles.button, styles.secondaryButton]}>
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Quay lại đăng nhập</Text>
          </Pressable>
        </View>
      ) : (
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          Đăng nhập
        </Text>
        <Text style={styles.subtitle}>Sử dụng email và mật khẩu để truy cập hệ thống.</Text>

        {globalError ? (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Text style={styles.errorText}>{globalError}</Text>
          </View>
        ) : null}

        <Text accessibilityRole="text" style={styles.label} nativeID="email-label">
          Email
        </Text>
        <TextInput
          accessibilityLabel="email input"
          style={[styles.input, fieldErrors.email ? styles.inputError : null]}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="name@company.com"
          value={email}
          onChangeText={setEmail}
          editable={!submitting}
        />
        {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email.join(' ')}</Text> : null}

        <Text accessibilityRole="text" style={styles.label} nativeID="password-label">
          Mật khẩu
        </Text>
        <TextInput
          accessibilityLabel="password input"
          style={[styles.input, fieldErrors.password ? styles.inputError : null]}
          secureTextEntry
          autoComplete="password"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          editable={!submitting}
        />
        {fieldErrors.password ? (
          <Text style={styles.fieldError}>{fieldErrors.password.join(' ')}</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="login submit"
          accessibilityState={{ disabled: submitting, busy: submitting }}
          onPress={handleSubmit}
          style={[styles.button, submitting ? styles.buttonDisabled : null]}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Đăng nhập</Text>
          )}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="forgot password" onPress={() => setMode('forgot')} style={[styles.button, styles.secondaryButton]}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Quên mật khẩu?</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="have reset token" onPress={() => setMode('reset')} style={[styles.button, styles.secondaryButton]}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Đã có token đặt lại</Text>
        </Pressable>
      </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  inputError: { borderColor: '#ef4444' },
  fieldError: { color: '#ef4444', fontSize: 13, marginTop: -4 },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 12 },
  errorText: { color: '#b91c1c', fontSize: 14 },
  successBox: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1, borderRadius: 8, padding: 12 },
  successText: { color: '#14532d', fontSize: 14 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryButton: { backgroundColor: '#f3f4f6', marginTop: 12 },
  secondaryButtonText: { color: '#374151' },
  info: { fontSize: 14, color: '#374151' },
  hint: { fontSize: 12, color: '#6b7280' },
});
