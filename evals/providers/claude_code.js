// promptfoo custom provider that calls the Claude Code CLI (`claude -p`) instead of the API,
// so the evals can run locally on a Claude subscription. Used by promptfooconfig.local.yaml.
//
// The prompt arrives as a JSON chat ([{role, content}, ...]) or plain text. System messages
// become --system-prompt (replacing Claude Code's own), the rest becomes the user message.
// Tools, MCP servers, settings and session history are all disabled so the model only sees
// what the test sends.
const { execFile } = require('child_process');
const os = require('os');

function toConversation(prompt) {
  let messages;
  try {
    messages = JSON.parse(prompt);
  } catch {
    return { system: '', user: prompt };
  }
  if (!Array.isArray(messages)) return { system: '', user: prompt };
  const text = (m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content));
  const system = messages.filter((m) => m.role === 'system').map(text).join('\n\n');
  const rest = messages.filter((m) => m.role !== 'system');
  const user = rest.length === 1 ? text(rest[0]) : rest.map((m) => `${m.role.toUpperCase()}:\n${text(m)}`).join('\n\n');
  return { system, user };
}

class ClaudeCodeProvider {
  constructor(options = {}) {
    this.config = options.config || {};
    this.model = this.config.model || 'sonnet';
    this.providerId = options.id || `claude-code:${this.model}`;
    this.label = options.label;
  }

  id() {
    return this.providerId;
  }

  callApi(prompt) {
    const { system, user } = toConversation(prompt);
    const args = [
      '-p', user,
      '--model', this.model,
      '--output-format', 'json',
      '--tools', '',
      '--strict-mcp-config',
      '--setting-sources', '',
      '--no-session-persistence',
    ];
    if (system) args.push('--system-prompt', system);

    const started = Date.now();
    return new Promise((resolve) => {
      execFile('claude', args, { cwd: os.tmpdir(), timeout: 180000, maxBuffer: 10 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err && !stdout) return resolve({ error: `claude CLI failed: ${stderr || err.message}` });
          try {
            const result = JSON.parse(stdout);
            if (result.is_error) return resolve({ error: `claude CLI error: ${result.result}` });
            resolve({
              output: String(result.result ?? '').trim(),
              latencyMs: Date.now() - started,
              // Subscription usage has no per-call price; the API-equivalent cost is reported for comparison.
              cost: result.total_cost_usd,
            });
          } catch {
            resolve({ error: `Unexpected claude CLI output: ${stdout.slice(0, 300)}` });
          }
        });
    });
  }
}

module.exports = ClaudeCodeProvider;
