// promptfoo custom provider that plays a scripted client against the agent, one message at a time.
// Each agent reply goes back into the history, so the agent sees a real conversation. Client lines
// come from vars.message (already in the prompt built by prompts/agent.js) and vars.turns, one line per
// message. vars.turns is a string on purpose: promptfoo expands an array var into one test per item.
// The output is the whole transcript, split with "=== turn N ===" so assertions can check each turn.
const ClaudeCodeProvider = require('./claude_code.js');

class MultiTurnProvider extends ClaudeCodeProvider {
  async callApi(prompt, context) {
    const messages = JSON.parse(prompt);
    const nextTurns = (context?.vars?.turns || '').split('\n').filter((line) => line.trim());
    const clientLines = [messages[messages.length - 1].content, ...nextTurns];
    const transcript = [];
    let latencyMs = 0;
    let cost = 0;

    for (let i = 0; i < clientLines.length; i++) {
      if (i > 0) messages.push({ role: 'user', content: clientLines[i] });
      const reply = await super.callApi(JSON.stringify(messages));
      if (reply.error) return { error: `turn ${i + 1}: ${reply.error}` };
      messages.push({ role: 'assistant', content: reply.output });
      transcript.push(`=== turn ${i + 1} ===\nCLIENT: ${clientLines[i]}\nAGENT: ${reply.output}`);
      latencyMs += reply.latencyMs || 0;
      cost += reply.cost || 0;
    }
    return { output: transcript.join('\n\n'), latencyMs, cost };
  }
}

module.exports = MultiTurnProvider;
