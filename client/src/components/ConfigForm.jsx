import { useState, useEffect } from 'react';

export default function ConfigForm({ config, onSave }) {
  const [selectedCommand, setSelectedCommand] = useState(config[0]?.command_name || '');
  const [keywords, setKeywords] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(null);

  // When the selected command changes, load its current keywords into the input.
  useEffect(() => {
    const current = config.find((c) => c.command_name === selectedCommand);
    setKeywords(current?.flagged_keywords ?? '');
  }, [selectedCommand, config]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSavedMessage(null);
    try {
      await onSave(selectedCommand, keywords);
      setSavedMessage(`Saved for /${selectedCommand}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 13, width: 90 }}>Command</label>
          <select
            value={selectedCommand}
            onChange={(e) => setSelectedCommand(e.target.value)}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '8px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--ink)',
              flex: 1,
            }}
          >
            {config.map((cfg) => (
              <option key={cfg.command_name} value={cfg.command_name}>
                /{cfg.command_name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 13, width: 90 }}>Keywords</label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="comma,separated,keywords"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {savedMessage && (
            <span style={{ color: 'var(--accent)', fontSize: 12.5, fontFamily: 'var(--font-mono)' }}>
              ✓ {savedMessage}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}