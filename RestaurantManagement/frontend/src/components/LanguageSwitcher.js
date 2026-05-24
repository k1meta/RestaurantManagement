import React from 'react';
import { useTranslation } from 'react-i18next';

import { updateUserLanguage } from '../api/client';

/**
 * A compact EN / BS language toggle that fits into dashboard headers.
 * Pass `compact` for mobile nav bars (emoji-only, no text label).
 */
export default function LanguageSwitcher({ compact = false }) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  function switchTo(lang) {
    i18n.changeLanguage(lang);
    updateUserLanguage(lang).catch(() => {});
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => switchTo(currentLang === 'en' ? 'bs' : 'en')}
        className="flex flex-col items-center justify-center text-[#e5e2e1]/70 h-full w-full hover:bg-[#1c1b1b] active:bg-[#1b6d24] transition-all"
      >
        <span className="text-lg">{currentLang === 'en' ? '🇧🇦' : '🇬🇧'}</span>
        <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest mt-1">
          {currentLang === 'en' ? 'BS' : 'EN'}
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => switchTo('en')}
        className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
          currentLang === 'en'
            ? 'bg-primary text-on-primary'
            : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => switchTo('bs')}
        className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
          currentLang === 'bs'
            ? 'bg-primary text-on-primary'
            : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
        }`}
      >
        BS
      </button>
    </div>
  );
}
