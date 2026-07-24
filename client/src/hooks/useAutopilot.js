import { useState, useCallback, useRef } from 'react';
import { TOOLS, executeTool, SYSTEM_PROMPT } from '../lib/autopilotTools';

/**
 * useAutopilot — Manages the AI chat state and LLM ↔ tool execution loop.
 *
 * Flow:
 *  1. User sends message → added to conversation
 *  2. POST { messages, tools } to /api/autopilot
 *  3. If LLM returns text → display it (done)
 *  4. If LLM returns tool_call → execute tool client-side
 *  5. Send tool result back to LLM → go to step 3
 *  6. Loop until LLM returns final text
 *
 * States: idle, thinking, executing, error
 */

const API_URL = '/api/autopilot';
const MAX_LOOP = 5; // Prevent infinite tool call loops
let _msgId = 0;
function msgId() { return ++_msgId; }

const WELCOME_MSG = {
  id: msgId(),
  role: 'assistant',
  content: "Hey! I'm your MowFlow AI assistant. I can help with your schedule, clients, invoices, and more. Try:\n\n• **Move today's jobs to Friday and text everyone**\n• **Show me today's schedule**\n• **How much did I make this month?**\n• **Who has unpaid invoices?**\n\nWhat can I help with?",
  isWelcome: true
};

export default function useAutopilot() {
  const [messages, setMessages] = useState(() => [WELCOME_MSG]);
  const [status, setStatus] = useState('idle'); // idle | thinking | executing | error
  const [currentAction, setCurrentAction] = useState(null); // What the AI is doing right now
  const controllerRef = useRef(null);
  const sendMessageRef = useRef(null);

  /** Send a user message and run the LLM loop */
  const sendMessage = useCallback(async (userText) => {
    if (!userText.trim() || status !== 'idle') return;

    // Abort any in-flight request
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();

    // Add user message
    const userMsg = { id: msgId(), role: 'user', content: userText };
    setMessages(prev => [...prev, userMsg]);
    setStatus('thinking');
    setCurrentAction(null);

    // Build conversation history for LLM (exclude UI metadata like isWelcome)
    const conversationHistory = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {})
    }));

    try {
      await runLLMLoop(conversationHistory, controllerRef.current.signal);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Autopilot error:', err);
      setMessages(prev => [...prev, {
        id: msgId(),
        role: 'assistant',
        content: err.message === 'not_configured'
          ? "⚠️ AI Autopilot isn't configured yet. Add your OpenRouter API key to get started."
          : '⚠️ Something went wrong. Try again in a moment.',
        isError: true
      }]);
      setStatus('error');
    }
  }, [messages, status]);

  /** Core LLM loop: send → receive → execute tools → repeat */
  async function runLLMLoop(history, signal) {
    let currentHistory = [...history];
    let loopCount = 0;

    while (loopCount < MAX_LOOP) {
      loopCount++;

      // Call LLM
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...currentHistory
          ],
          tools: TOOLS.map(t => ({
            type: 'function',
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters
            }
          }))
        }),
        signal
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `API error ${res.status}`);
      }

      const { message, error } = await res.json();

      if (error === 'not_configured') {
        throw new Error('not_configured');
      }

      if (!message) {
        throw new Error('No response from AI');
      }

      // Case 1: LLM returned text → done
      if (message.content && !message.tool_calls) {
        setMessages(prev => [...prev, {
          id: msgId(),
          role: 'assistant',
          content: message.content
        }]);
        setStatus('idle');
        setCurrentAction(null);
        return;
      }

      // Case 2: LLM wants to call tools
      if (message.tool_calls?.length) {
        // Add the assistant's tool call request to history
        currentHistory.push({
          role: 'assistant',
          content: message.content || null,
          tool_calls: message.tool_calls
        });

        // Show what's happening in the UI
        const toolNames = message.tool_calls.map(tc => tc.function.name);
        setCurrentAction(formatToolAction(toolNames));
        setStatus('executing');

        // Add tool call message to UI
        setMessages(prev => [...prev, {
          id: msgId(),
          role: 'assistant',
          content: message.content || null,
          tool_calls: message.tool_calls,
          isToolCall: true
        }]);

        // Execute each tool
        for (const tc of message.tool_calls) {
          const fnName = tc.function.name;
          let fnArgs;
          try {
            fnArgs = JSON.parse(tc.function.arguments);
          } catch {
            fnArgs = {};
          }

          const result = await executeTool(fnName, fnArgs);

          // Add tool result to history
          currentHistory.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result)
          });

          // Show tool result in UI
          setMessages(prev => [...prev, {
            id: msgId(),
            role: 'tool',
            tool_call_id: tc.id,
            toolName: fnName,
            content: JSON.stringify(result),
            isToolResult: true
          }]);
        }

        setCurrentAction(null);
        setStatus('thinking');
        // Loop back to let LLM process results
        continue;
      }

      // Case 3: No content and no tool calls (shouldn't happen)
      setMessages(prev => [...prev, {
        id: msgId(),
        role: 'assistant',
        content: "I'm not sure how to help with that. Could you rephrase?",
        isError: true
      }]);
      setStatus('idle');
      return;
    }

    // Max loop exceeded
    setMessages(prev => [...prev, {
      id: msgId(),
      role: 'assistant',
      content: "That took more steps than expected. Let's try a simpler request.",
      isError: true
    }]);
    setStatus('idle');
  }

  /** Reset the conversation */
  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setMessages([{ ...WELCOME_MSG, id: msgId() }]);
    setStatus('idle');
    setCurrentAction(null);
  }, []);

  /** Retry last errored request — find the last user message and re-send it */
  const retry = useCallback(() => {
    // Use ref to always get the latest sendMessage
    const send = sendMessageRef.current;
    if (!send) return;

    // Remove the last error message, then find and re-send last user message
    setMessages(prev => {
      const last = prev[prev.length - 1];
      const cleaned = last?.isError ? prev.slice(0, -1) : prev;
      // Find the most recent user message
      for (let i = cleaned.length - 1; i >= 0; i--) {
        if (cleaned[i].role === 'user') {
          const text = cleaned[i].content;
          // Remove that user message from state so it gets re-added fresh
          const withoutLastUser = cleaned.slice(0, i);
          setStatus('idle');
          setTimeout(() => send(text), 0);
          return withoutLastUser;
        }
      }
      return cleaned;
    });
  }, []);

  // Keep ref current
  sendMessageRef.current = sendMessage;

  return { messages, status, currentAction, sendMessage, reset, retry };
}

/** Human-readable description of what tools are being called */
function formatToolAction(toolNames) {
  if (toolNames.length === 0) return 'Working...';
  const first = toolNames[0];
  const extras = toolNames.length > 1 ? ` +${toolNames.length - 1} more` : '';
  const labels = {
    getTodaySchedule: 'Checking schedule...',
    getSchedule: 'Looking up schedule...',
    rescheduleJobs: 'Rescheduling jobs...',
    runRainDelay: 'Running rain delay...',
    searchClients: 'Searching clients...',
    getClientInfo: 'Looking up client...',
    getClientHistory: 'Checking client history...',
    getUnpaidInvoices: 'Checking unpaid invoices...',
    createInvoice: 'Creating invoice...',
    sendPaymentReminders: 'Sending reminders...',
    getRevenue: 'Calculating revenue...',
    createJob: 'Scheduling job...',
    updateJobStatus: 'Updating job...',
    invoiceCompletedJobs: 'Invoicing completed jobs...'
  };
  return (labels[first] || `Running ${first}...`) + extras;
}
