import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { loginRequest, type LoginError } from '../src/api/client';
import { saveAuth } from '../src/auth/storage';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) errors.email = 'Email không được để trống';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) errors.email = 'Email không hợp lệ';
    if (!password) errors.password = 'Mật khẩu không được để trống';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleLogin() {
    setGlobalError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await loginRequest({ email: email.trim(), password });
      await saveAuth(result);
      router.replace('/');
    } catch (err) {
      const loginError = err as LoginError;
      setGlobalError(loginError.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container} accessible accessibilityLabel="login screen">
      <Text accessibilityRole="header" style={styles.title}>Đăng nhập</Text>
      <Text style={styles.subtitle}>Sử dụng email và mật khẩu để truy cập hệ thống.</Text>

      {globalError ? (
        <View accessibilityRole="alert" style={styles.errorBox}>
          <Text style={styles.errorText}>{globalError}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Email</Text>
      <TextInput
        accessibilityLabel="email input"
        style={[styles.input, fieldErrors.email ? styles.inputError : null]}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="name@company.com"
        value={email}
        onChangeText={setEmail}
      />
      {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}

      <Text style={styles.label}>Mật khẩu</Text>
      <TextInput
        accessibilityLabel="password input"
        style={[styles.input, fieldErrors.password ? styles.inputError : null]}
        secureTextEntry
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
      />
      {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="login submit"
        accessibilityState={{ busy: loading }}
        onPress={handleLogin}
        disabled={loading}
        style={[styles.button, loading ? styles.buttonDisabled : null]}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Đăng nhập</Text>}
      </Pressable>

      <Text style={styles.footer}>
        Tài khoản bị khóa hoặc ngừng hoạt động sẽ bị từ chối (IAM-SRS-001).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fafafa' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#b91c1c', fontSize: 14 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 4, backgroundColor: '#fff', fontSize: 15 },
  inputError: { borderColor: '#ef4444' },
  fieldError: { color: '#ef4444', fontSize: 12, marginBottom: 8 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  footer: { fontSize: 12, color: '#6b7280', marginTop: 20, textAlign: 'center' },
});
