import { useState, useCallback, useRef, useEffect } from 'react';
import { TOOLS, executeTool, SYSTEM_PROMPT } from '../lib/autopilotTools';
import { supabase, isDemoMode } from '../lib/supabase';

const API_URL = '/api/autopilot';
const MAX_LOOP = 5;
export const MAX_USER_MESSAGES = 10;
const RESET_SUGGESTION_THRESHOLD = 20;
const WELCOME_MESSAGE = 'Ask about your schedule, clients, invoices, or revenue.';

function welcomeMessage() {
  return {
    id: 'welcome',
    role: 'assistant',
    content: WELCOME_MESSAGE,
    isWelcome: true
  };
}

function newMessage(role, content, metadata = {}) {
  return { id: crypto.randomUUID(), role, content, ...metadata };
}

function toDatabaseMessage(message, sessionId, userId) {
  return {
    id: message.id,
    session_id: sessionId,
    user_id: userId,
    role: message.role,
    content: message.content ?? null,
    tool_calls: message.tool_calls ?? null,
    tool_call_id: message.tool_call_id ?? null,
    tool_name: message.toolName ?? null,
    is_tool_call: Boolean(message.isToolCall),
    is_tool_result: Boolean(message.isToolResult)
  };
}

function fromDatabaseMessage(message) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    tool_calls: message.tool_calls,
    tool_call_id: message.tool_call_id,
    toolName: message.tool_name,
    isToolCall: message.is_tool_call,
    isToolResult: message.is_tool_result
  };
}

export default function useAutopilot() {
  const [messages, setMessages] = useState([welcomeMessage()]);
  const [status, setStatus] = useState('loading');
  const [currentAction, setCurrentAction] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [persistenceFailed, setPersistenceFailed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const controllerRef = useRef(null);
  const userIdRef = useRef(null);
  const sessionIdRef = useRef(null);
  const sessionReadyRef = useRef(null);
  const sendInFlightRef = useRef(false);
  const statusRef = useRef(status);
  const messagesRef = useRef(messages);

  statusRef.current = status;
  messagesRef.current = messages;

  const userMessageCount = messages.filter(message => message.role === 'user').length;
  const persistedMessageCount = messages.filter(message => !message.isWelcome && !message.isError).length;
  const limitReached = userMessageCount >= MAX_USER_MESSAGES;
  const shouldSuggestReset = persistedMessageCount >= RESET_SUGGESTION_THRESHOLD;

  const createSession = useCallback(async (userId) => {
    const id = crypto.randomUUID();
    sessionIdRef.current = id;
    setSessionId(id);
    if (userId && !isDemoMode()) {
      const { error } = await supabase
        .from('autopilot_sessions')
        .insert({ id, user_id: userId });
      if (error) throw error;
    }
    return id;
  }, []);

  const persistMessage = useCallback(async (message) => {
    const userId = userIdRef.current;
    const activeSessionId = sessionIdRef.current;
    if (!userId || !activeSessionId || isDemoMode() || message.isWelcome || message.isError) return;

    try {
      const { error } = await supabase
        .from('autopilot_messages')
        .insert(toDatabaseMessage(message, activeSessionId, userId));
      if (error) throw error;

      const { error: sessionError } = await supabase
        .from('autopilot_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeSessionId);
      if (sessionError) throw sessionError;
    } catch (error) {
      console.error('Could not save autopilot message:', error);
      setPersistenceFailed(true);
    }
  }, []);

  const appendMessage = useCallback((message) => {
    setMessages(previous => [...previous, message]);
    void persistMessage(message);
  }, [persistMessage]);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        if (isDemoMode()) {
          await createSession(null);
          if (!cancelled) setStatus('idle');
          return;
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) {
          await createSession(null);
          if (!cancelled) setStatus('idle');
          return;
        }
        userIdRef.current = user.id;

        const { data: session, error: sessionError } = await supabase
          .from('autopilot_sessions')
          .select('id')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sessionError) throw sessionError;

        const activeSessionId = session?.id || await createSession(user.id);
        sessionIdRef.current = activeSessionId;
        if (!cancelled) setSessionId(activeSessionId);

        if (session) {
          const { data: savedMessages, error: messagesError } = await supabase
            .from('autopilot_messages')
            .select('*')
            .eq('session_id', activeSessionId)
            .order('created_at', { ascending: true });
          if (messagesError) throw messagesError;
          if (!cancelled && savedMessages?.length) {
            setMessages(savedMessages.map(fromDatabaseMessage));
          }
        }
      } catch (error) {
        console.error('Could not load autopilot session:', error);
      } finally {
        if (!cancelled) setStatus('idle');
      }
    }

    sessionReadyRef.current = loadSession();
    return () => {
      cancelled = true;
      controllerRef.current?.abort();
    };
  }, [createSession]);

  const runLLMLoop = useCallback(async (history, signal) => {
    let currentHistory = [...history];

    for (let loopCount = 0; loopCount < MAX_LOOP; loopCount++) {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...currentHistory],
          tools: TOOLS.map(tool => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters
            }
          }))
        }),
        signal
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || `API error ${res.status}`);
      }

      const { message, error } = await res.json();
      if (error === 'not_configured') throw new Error('not_configured');
      if (!message) throw new Error('No response from AI');

      if (message.content && !message.tool_calls?.length) {
        appendMessage(newMessage('assistant', message.content));
        setStatus('idle');
        setCurrentAction(null);
        return;
      }

      if (message.tool_calls?.length) {
        currentHistory.push({
          role: 'assistant',
          content: message.content || null,
          tool_calls: message.tool_calls
        });
        const toolNames = message.tool_calls.map(call => call.function.name);
        setCurrentAction(formatToolAction(toolNames));
        setStatus('executing');
        appendMessage(newMessage('assistant', message.content || null, {
          tool_calls: message.tool_calls,
          isToolCall: true
        }));

        for (const toolCall of message.tool_calls) {
          if (signal.aborted) return;
          let args = {};
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            // Invalid arguments are passed as an empty object for a structured tool error.
          }
          const result = await executeTool(toolCall.function.name, args);
          const content = JSON.stringify(result);
          currentHistory.push({ role: 'tool', tool_call_id: toolCall.id, content });
          appendMessage(newMessage('tool', content, {
            tool_call_id: toolCall.id,
            toolName: toolCall.function.name,
            isToolResult: true
          }));
        }

        setCurrentAction(null);
        setStatus('thinking');
        continue;
      }

      appendMessage(newMessage('assistant', 'Please rephrase that request.', { isError: true }));
      setStatus('idle');
      return;
    }

    appendMessage(newMessage('assistant', 'That request needs too many steps. Start a new chat or simplify it.', { isError: true }));
    setStatus('idle');
  }, [appendMessage]);

  const sendMessage = useCallback(async (userText) => {
    const text = userText.trim();
    if (!text || sendInFlightRef.current) return;

    sendInFlightRef.current = true;
    setIsSending(true);
    try {
      if (sessionReadyRef.current) await sessionReadyRef.current;
    } catch (error) {
      console.error('Could not prepare autopilot session:', error);
      setPersistenceFailed(true);
    }

    const currentUserCount = messagesRef.current.filter(message => message.role === 'user').length;
    if (statusRef.current !== 'idle' || currentUserCount >= MAX_USER_MESSAGES) {
      sendInFlightRef.current = false;
      setIsSending(false);
      return;
    }

    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const userMessage = newMessage('user', text);
    appendMessage(userMessage);
    setStatus('thinking');
    setCurrentAction(null);

    const history = [...messagesRef.current, userMessage]
      .filter(message => !message.isWelcome && !message.isError)
      .map(message => ({
        role: message.role,
        content: message.content,
        ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
        ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {})
      }));

    try {
      await runLLMLoop(history, controllerRef.current.signal);
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Autopilot error:', error);
      appendMessage(newMessage(
        'assistant',
        error.message === 'not_configured'
          ? 'AI Autopilot is not configured. Add the OpenRouter API key.'
          : 'Something went wrong. Try again.',
        { isError: true }
      ));
      setStatus('error');
    } finally {
      sendInFlightRef.current = false;
      setIsSending(false);
    }
  }, [appendMessage, runLLMLoop]);

  const reset = useCallback(async () => {
    controllerRef.current?.abort();
    sendInFlightRef.current = false;
    setIsSending(false);
    setStatus('loading');
    setCurrentAction(null);
    setMessages([welcomeMessage()]);
    setPersistenceFailed(false);
    try {
      const sessionPromise = createSession(userIdRef.current);
      sessionReadyRef.current = sessionPromise;
      await sessionPromise;
    } catch (error) {
      console.error('Could not create autopilot session:', error);
      setPersistenceFailed(true);
    } finally {
      sessionReadyRef.current = Promise.resolve(sessionIdRef.current);
      setStatus('idle');
    }
  }, [createSession]);

  const retry = useCallback(() => {
    if (statusRef.current !== 'error') return;
    const history = messagesRef.current
      .filter(message => !message.isWelcome && !message.isError)
      .map(message => ({
        role: message.role,
        content: message.content,
        ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
        ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {})
      }));
    if (!history.some(message => message.role === 'user')) return;

    setMessages(previous => previous.filter(message => !message.isError));
    setStatus('thinking');
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    void runLLMLoop(history, controllerRef.current.signal).catch(error => {
      if (error.name === 'AbortError') return;
      console.error('Autopilot retry error:', error);
      appendMessage(newMessage('assistant', 'Something went wrong. Try again.', { isError: true }));
      setStatus('error');
    });
  }, [appendMessage, runLLMLoop]);

  return {
    messages,
    status,
    currentAction,
    sessionId,
    userMessageCount,
    limitReached,
    shouldSuggestReset,
    persistenceFailed,
    isSending,
    sendMessage,
    reset,
    retry
  };
}

function formatToolAction(toolNames) {
  if (toolNames.length === 0) return 'Working...';
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
  const extras = toolNames.length > 1 ? ` +${toolNames.length - 1} more` : '';
  return (labels[toolNames[0]] || `Running ${toolNames[0]}...`) + extras;
}
