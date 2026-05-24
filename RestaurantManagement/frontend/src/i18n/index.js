import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './en/common.json';
import enLogin from './en/login.json';
import enWaiter from './en/waiter.json';
import enKitchen from './en/kitchen.json';
import enManager from './en/manager.json';
import enOwner from './en/owner.json';

import bsCommon from './bs/common.json';
import bsLogin from './bs/login.json';
import bsWaiter from './bs/waiter.json';
import bsKitchen from './bs/kitchen.json';
import bsManager from './bs/manager.json';
import bsOwner from './bs/owner.json';

/* Language is persisted in localStorage so it survives logout and page refresh.
   This is intentionally NOT tied to the auth token — the user's language preference
   stays even after they log out, so the login page appears in their chosen language. */
const LANG_KEY = 'app_language';
const savedLang = (() => {
  try { return localStorage.getItem(LANG_KEY) || 'en'; }
  catch { return 'en'; }
})();

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, login: enLogin, waiter: enWaiter, kitchen: enKitchen, manager: enManager, owner: enOwner },
    bs: { common: bsCommon, login: bsLogin, waiter: bsWaiter, kitchen: bsKitchen, manager: bsManager, owner: bsOwner },
  },
  lng: savedLang,
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

/* Persist language changes to localStorage automatically */
i18n.on('languageChanged', (lng) => {
  try { localStorage.setItem(LANG_KEY, lng); }
  catch { /* localStorage unavailable — ignore */ }
});

export default i18n;
