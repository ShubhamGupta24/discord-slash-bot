import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-toggle">
      <button
        className={theme === 'light' ? 'active' : ''}
        onClick={() => setTheme('light')}
      >
        Light
      </button>
      <button
        className={theme === 'dark' ? 'active' : ''}
        onClick={() => setTheme('dark')}
      >
        Dark
      </button>
    </div>
  );
}
