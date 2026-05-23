import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { getLoginProfiles } from '../api/client';
import { colors, fonts, radius } from '../theme/kinetic';

const LAST_LOGIN_EMAIL_KEY = 'lastLoginEmail';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState('');

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const savedEmail = await AsyncStorage.getItem(LAST_LOGIN_EMAIL_KEY);
        if (active && savedEmail) setEmail(savedEmail);

        const response = await getLoginProfiles();
        if (active) setProfiles(response.data?.profiles || []);
      } catch (_err) {
        if (active) {
          setProfilesError('Could not load quick staff login. Manual sign-in still works.');
        }
      } finally {
        if (active) setProfilesLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      await AsyncStorage.setItem(LAST_LOGIN_EMAIL_KEY, email.trim());
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Check your credentials.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  function fillProfile(profile) {
    setEmail(profile.email);
    setPassword('');
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>
              Restaurant{'\n'}Management
            </Text>
            <Text style={styles.subtitle}>Bread & Co</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor={colors.onSurfaceVariant}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="PIN / Password"
              placeholderTextColor={colors.onSurfaceVariant}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.quickSection}>
            <Text style={styles.quickTitle}>Quick Staff Login</Text>
            {profilesError ? <Text style={styles.errorText}>{profilesError}</Text> : null}
            {profilesLoading ? (
              <Text style={styles.loadingProfiles}>Loading profiles…</Text>
            ) : (
              profiles.map((profile) => (
                <TouchableOpacity
                  key={profile.id}
                  style={styles.profileCard}
                  onPress={() => fillProfile(profile)}
                  activeOpacity={0.88}
                >
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileInitials}>
                      {String(profile.name || '?')
                        .split(/\s+/)
                        .map((p) => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.profileText}>
                    <Text style={styles.profileName}>{profile.name}</Text>
                    <Text style={styles.profileRole}>{profile.role}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingVertical: 40,
    gap: 32,
  },
  header: { gap: 8 },
  title: {
    fontFamily: fonts.headlineBlack,
    fontSize: 36,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: -1,
    lineHeight: 38,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  form: { gap: 14 },
  input: {
    backgroundColor: colors.surfaceContainerHigh,
    color: colors.onSurface,
    fontFamily: fonts.body,
    fontSize: 15,
    padding: 16,
    borderRadius: radius.sm,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: radius.sm,
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontFamily: fonts.headline,
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 199, 199, 0.15)',
    paddingTop: 20,
    gap: 10,
  },
  quickTitle: {
    fontFamily: fonts.label,
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surfaceContainerLow,
    padding: 14,
    borderRadius: radius.sm,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    fontFamily: fonts.headline,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  profileText: { flex: 1 },
  profileName: {
    fontFamily: fonts.headline,
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
  },
  profileRole: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  loadingProfiles: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.onErrorContainer,
  },
});
