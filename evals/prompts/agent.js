// Builds the chat sent to the model: the agent's system prompt + the client's Instagram message.
const fs = require('fs');
const path = require('path');

const SYSTEM = fs.readFileSync(path.join(__dirname, '..', 'agent', 'system_prompt.md'), 'utf8');

module.exports = async function ({ vars }) {
  return [
    { role: 'system', content: SYSTEM.replace('{{launch_count}}', String(vars.launch_count ?? 2)) },
    { role: 'user', content: vars.message },
  ];
};
