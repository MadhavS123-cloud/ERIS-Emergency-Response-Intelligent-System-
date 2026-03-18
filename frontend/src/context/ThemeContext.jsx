import React, { createContext, useContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Read system preference directly, no local storage fallback
  const getSystemTheme = () => 
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  const [theme, setTheme] = useState(getSystemTheme);

  useEffect(() => {
    // Listener for dynamic OS theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      setTheme(e.matches ? 'dark' : 'light');
    };

    // Attempt to use modern addEventListener, fallback to addListener for older browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    // Apply theme class to document body
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook for easy consumption
export const useTheme = () => useContext(ThemeContext);
