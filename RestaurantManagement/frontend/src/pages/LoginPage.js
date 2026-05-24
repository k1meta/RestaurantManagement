import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getLoginProfiles } from '../api/client';
import LanguageSwitcher from '../components/LanguageSwitcher';

const LAST_LOGIN_EMAIL_KEY = 'lastLoginEmail';

export default function LoginPage({ onLogin }) {
  const { t } = useTranslation(['login', 'common']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState('');
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    const savedEmail = localStorage.getItem(LAST_LOGIN_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
    }

    let active = true;
    (async () => {
      try {
        const response = await getLoginProfiles();
        if (!active) return;
        setProfiles(response.data?.profiles || []);
      } catch (_err) {
        if (!active) return;
        setProfilesError(t('profilesError'));
      } finally {
        if (active) setProfilesLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await onLogin(email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
    } else {
      localStorage.setItem(LAST_LOGIN_EMAIL_KEY, email.trim());
    }
  };

  const fillCredentials = (profile) => {
    setEmail(profile.email);
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left: Login Form */}
        <div className="space-y-8">
          <div>
            <div className="flex justify-between items-start">
              <h1 className="font-headline text-5xl font-black tracking-tighter mb-2 uppercase">
                {t('common:restaurantManagement').split('\n').map((line, i) => (
                  <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>
                ))}
              </h1>
              <LanguageSwitcher />
            </div>
            <p className="text-on-surface-variant text-sm font-bold uppercase tracking-[0.2em]">
              {t('common:brandName')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.2em] mb-2 text-on-surface-variant">
                {t('emailLabel')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder={t('emailPlaceholder')}
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.2em] mb-2 text-on-surface-variant">
                {t('passwordLabel')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder={t('passwordPlaceholder')}
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="bg-error-container text-on-error-container p-3 text-sm font-500">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary py-4 font-headline font-black uppercase tracking-[0.1em] hover:bg-on-primary-fixed disabled:opacity-50 transition-colors"
            >
              {loading ? t('signingIn') : t('signIn')}
            </button>
          </form>
        </div>

        {/* Right: Login Profiles */}
        <div className="bg-surface-container-low p-8 border border-outline-variant/20">
          <h3 className="font-headline text-2xl font-black mb-2 uppercase">{t('staffProfiles')}</h3>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-[0.2em] mb-6">
            {t('clickToAutofill')}
          </p>

          {profilesError ? (
            <div className="bg-error-container text-on-error-container p-3 text-sm font-500 mb-4">
              {profilesError}
            </div>
          ) : null}

          <div className="space-y-3">
            {profilesLoading ? (
              <div className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">
                {t('loadingProfiles')}
              </div>
            ) : (
              profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => fillCredentials(profile)}
                  className="w-full text-left p-4 bg-surface-container-lowest border border-outline-variant/20 hover:border-primary hover:bg-surface-container-highest transition-colors group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-headline font-bold">{profile.name}</h4>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2 py-1 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                      {profile.role}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant font-mono">{profile.email}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
