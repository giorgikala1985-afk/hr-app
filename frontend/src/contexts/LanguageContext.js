import React, { createContext, useContext, useState } from 'react';
import en from '../i18n/en';
import ka from '../i18n/ka';

const translations = { en, ka };
const LanguageContext = createContext({});

export function LanguageProvider({ children }) {
  const [language, setLang] = useState(() => {
    try {
      return localStorage.getItem('app_language') || 'en';
    } catch {
      return 'en';
    }
  });

  const setLanguage = (lang) => {
    setLang(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key, params) => {
    let str = translations[language]?.[key] || translations.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      });
    }
    return str;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
