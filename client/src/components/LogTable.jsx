export default function LogTable({ logs }) {
  console.log('[logTable] rendering logs', logs);

  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Command</th>
            <th>User</th>
            <th>Input</th>
            <th>Rule Result</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.interaction_id}>
              <td className="mono" data-label="Time">
                {new Date(log.created_at).toLocaleString()}
              </td>
              <td className="cmd" data-label="Command">{log.command_name}</td>
              <td data-label="User">{log.user_tag}</td>
              <td className="mono" data-label="Input">{log.raw_input}</td>
              <td className="mono" data-label="Rule Result">{log.rule_result}</td>
              <td data-label="Status">
                <span className={`status-pill status-${log.status}`}>{log.status}</span>
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr className="empty-row">
              <td colSpan={6}>No commands logged yet — run /report or /status in Discord to see it here.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
