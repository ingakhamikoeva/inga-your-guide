import { isSessionCurrent, subscribe, type SessionSnapshot } from './auth-storage';

export type ChatMessage = { role: 'user' | 'assistant'; content: string; history?: boolean };
// Tab memory only: survives screen navigation, never reloads or account changes.
// At most 40 visible messages and 12 model-history messages (12000 UTF-8 bytes).
let conversation: { owner: SessionSnapshot; messages: ChatMessage[] } | null = null;
subscribe(() => {
  if (conversation && !isSessionCurrent(conversation.owner)) conversation = null;
});

export function readConversation(owner: SessionSnapshot): ChatMessage[] {
  if (!owner.owner || !isSessionCurrent(owner) || !conversation
    || conversation.owner.owner !== owner.owner || conversation.owner.generation !== owner.generation) {
    conversation = null;
    return [];
  }
  return conversation.messages.map(message => ({ ...message }));
}

export function saveConversation(owner: SessionSnapshot, messages: ChatMessage[]) {
  if (!owner.owner || !isSessionCurrent(owner)) return;
  conversation = { owner, messages: messages.slice(-40).map(message => ({ ...message })) };
}

const encoder = new TextEncoder();
function bounded(text: string, bytes: number) {
  let value = '', used = 0;
  for (const char of text) {
    const size = encoder.encode(char).length;
    if (used + size > bytes || value.length + char.length > 3000) break;
    value += char; used += size;
  }
  return value.trim();
}

export function conversationHistory(messages: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  let budget = 12000;
  // Complete successful turns only: no greeting, loading placeholder or error reply.
  for (let i = messages.length - 1; i > 0 && history.length < 12; i--) {
    const answer = messages[i], question = messages[i - 1];
    if (answer.role !== 'assistant' || question.role !== 'user' || !answer.history || !question.history) continue;
    const user = bounded(question.content, Math.min(6000, Math.floor(budget / 2)));
    const assistant = bounded(answer.content, Math.min(6000, budget - encoder.encode(user).length));
    if (!user || !assistant) break;
    history.unshift({ role: 'user', content: user }, { role: 'assistant', content: assistant });
    budget -= encoder.encode(user + assistant).length;
    i--;
  }
  return history;
}
