import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import ThemeToggle from '../components/ThemeToggle';
import LogTable from '../components/LogTable';
import ConfigForm from '../components/ConfigForm';

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [config, setConfig] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      console.log('[dashboard] loading data');
      const [logsData, configData] = await Promise.all([api.getLogs(), api.getConfig()]);
      console.log('[dashboard] received data', { logs: logsData, config: configData });
      setLogs(logsData);
      setConfig(configData);
      setError(null);
    } catch (err) {
      setError(err.message);
      if (err.message.includes('Session expired')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadData();
    // Light polling so the log stays reasonably current without a websocket.
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function handleSaveConfig(commandName, flaggedKeywords) {
    console.log('[dashboard] saving config', { commandName, flaggedKeywords });
    const updated = await api.saveConfig(commandName, flaggedKeywords);
    console.log('[dashboard] config updated', updated);
    setConfig(updated);
  }

  function handleLogout() {
    console.log('[dashboard] logging out');
    clearToken();
    navigate('/login');
  }

  return (
    <div>
      <div className="topbar">
        <div className="brand">
          <span className="pulse-dot" />
          <strong>bot console</strong> — {logs.length} logged interaction{logs.length === 1 ? '' : 's'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <ThemeToggle />
          <button className="btn secondary" onClick={handleLogout}>Log out</button>
        </div>
      </div>

      <div className="container">
        {error && <p className="error-msg">⚠ {error}</p>}

        <h2 className="section-title">Command Log</h2>
        {loading ? <p style={{ color: 'var(--ink-dim)' }}>Loading…</p> : <LogTable logs={logs} />}

        <h2 className="section-title">Command Configuration</h2>
        {loading ? <p style={{ color: 'var(--ink-dim)' }}>Loading…</p> : (
          <ConfigForm config={config} onSave={handleSaveConfig} />
        )}
      </div>
    </div>
  );
}
