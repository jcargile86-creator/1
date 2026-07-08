import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, DEV_CREDENTIALS } from '../store/AuthStore';
import { colors, spacing, touch } from '../theme';

/** Account gate. Inspectors sign in (or create an account); each account
 *  keeps its own claims. A seeded dev account is one tap away for testing. */
export default function SignInScreen() {
  const { signIn, signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const err = mode === 'in' ? await signIn(username, password) : await signUp(username, password, displayName, contact);
    if (err) setError(err);
    setBusy(false);
  };

  const useDevAccount = async () => {
    setBusy(true);
    setError(null);
    setUsername(DEV_CREDENTIALS.username);
    setPassword(DEV_CREDENTIALS.password);
    const err = await signIn(DEV_CREDENTIALS.username, DEV_CREDENTIALS.password);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>InspectPro</Text>
        <Text style={styles.tagline}>{mode === 'in' ? 'Sign in to your inspector account' : 'Create your inspector account'}</Text>

        <View style={styles.card}>
          {mode === 'up' && (
            <>
              <Text style={styles.label}>Inspector Name</Text>
              <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Full name (shown on reports)" placeholderTextColor={colors.grayLine} autoCapitalize="words" />
              <Text style={styles.label}>Contact (optional)</Text>
              <TextInput style={styles.input} value={contact} onChangeText={setContact} placeholder="email · phone" placeholderTextColor={colors.grayLine} autoCapitalize="none" />
            </>
          )}
          <Text style={styles.label}>Username</Text>
          <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="username" placeholderTextColor={colors.grayLine} autoCapitalize="none" autoCorrect={false} />
          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="password" placeholderTextColor={colors.grayLine} secureTextEntry autoCapitalize="none" />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.primaryBtn} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{mode === 'in' ? 'Sign In' : 'Create Account'}</Text>}
          </Pressable>
        </View>

        <Pressable onPress={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null); }} style={styles.switchRow}>
          <Text style={styles.switchText}>
            {mode === 'in' ? 'No account yet? ' : 'Already have an account? '}
            <Text style={styles.switchLink}>{mode === 'in' ? 'Create one' : 'Sign in'}</Text>
          </Text>
        </Pressable>

        <View style={styles.devBox}>
          <Text style={styles.devLabel}>TESTING</Text>
          <Pressable style={styles.devBtn} onPress={useDevAccount} disabled={busy}>
            <Text style={styles.devBtnText}>Use Dev Account</Text>
          </Pressable>
          <Text style={styles.devHint}>dev · inspect</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  brand: { color: colors.white, fontSize: 36, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 },
  tagline: { color: '#c6c9e8', fontSize: 15, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xl, fontWeight: '600' },
  card: { backgroundColor: colors.white, borderRadius: touch.radius, padding: spacing.md },
  label: { fontSize: 13, fontWeight: '700', color: colors.grayText, marginBottom: 4, marginTop: spacing.sm },
  input: { backgroundColor: colors.offWhite, borderRadius: 10, borderWidth: 1, borderColor: colors.grayLine, paddingHorizontal: spacing.md, minHeight: touch.minHeight - 4, fontSize: 16, color: colors.ink },
  error: { color: colors.red, fontSize: 14, fontWeight: '700', marginTop: spacing.sm },
  primaryBtn: { backgroundColor: colors.red, borderRadius: touch.radius, minHeight: touch.minHeight + 4, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  primaryText: { color: colors.white, fontSize: 18, fontWeight: '800' },
  switchRow: { alignItems: 'center', marginTop: spacing.lg },
  switchText: { color: '#c6c9e8', fontSize: 15 },
  switchLink: { color: colors.white, fontWeight: '800' },
  devBox: { marginTop: spacing.xl, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3a3f6b', paddingTop: spacing.lg },
  devLabel: { color: '#8f95c6', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: spacing.sm },
  devBtn: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: touch.radius, paddingHorizontal: spacing.xl, minHeight: touch.minHeight - 6, alignItems: 'center', justifyContent: 'center' },
  devBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  devHint: { color: '#8f95c6', fontSize: 12, marginTop: spacing.sm, fontWeight: '600' },
});
