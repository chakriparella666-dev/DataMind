import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [appearance, setAppearance] = useState(() => localStorage.getItem('theme_appearance') || 'Dark');
  const [contrast, setContrast] = useState(() => localStorage.getItem('theme_contrast') || 'System');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('theme_accent') || 'Blue');
  const [iconColor, setIconColor] = useState(() => localStorage.getItem('theme_icon') || 'Black');
  const [language, setLanguage] = useState(() => localStorage.getItem('theme_lang') || 'Auto-detect');

  useEffect(() => {
    const root = document.documentElement;
    
    // Apply Appearance (Dark vs Light vs System)
    if (appearance === 'Light') {
      root.classList.add('theme-light');
      root.classList.remove('dark');
    } else if (appearance === 'Dark') {
      root.classList.remove('theme-light');
      root.classList.add('dark');
    } else {
      // System mode
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isSystemDark) {
        root.classList.remove('theme-light');
        root.classList.add('dark');
      } else {
        root.classList.add('theme-light');
        root.classList.remove('dark');
      }
    }

    // Apply Accent Color attribute
    root.setAttribute('data-accent', accentColor);

    // Apply Contrast attribute
    root.setAttribute('data-contrast', contrast);

    // Persist to localStorage
    localStorage.setItem('theme_appearance', appearance);
    localStorage.setItem('theme_contrast', contrast);
    localStorage.setItem('theme_accent', accentColor);
    localStorage.setItem('theme_icon', iconColor);
    localStorage.setItem('theme_lang', language);
  }, [appearance, contrast, accentColor, iconColor, language]);

  return (
    <ThemeContext.Provider
      value={{
        appearance,
        setAppearance,
        contrast,
        setContrast,
        accentColor,
        setAccentColor,
        iconColor,
        setIconColor,
        language,
        setLanguage
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
