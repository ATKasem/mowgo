CREATE TABLE IF NOT EXISTS autopilot_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS autopilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES autopilot_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT,
  tool_calls JSONB,
  tool_call_id TEXT,
  tool_name TEXT,
  is_tool_call BOOLEAN NOT NULL DEFAULT false,
  is_tool_result BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS autopilot_sessions_user_updated_idx
  ON autopilot_sessions (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS autopilot_messages_session_created_idx
  ON autopilot_messages (session_id, created_at);

ALTER TABLE autopilot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopilot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own autopilot sessions"
  ON autopilot_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own autopilot messages"
  ON autopilot_messages
  FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM autopilot_sessions
      WHERE autopilot_sessions.id = autopilot_messages.session_id
        AND autopilot_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM autopilot_sessions
      WHERE autopilot_sessions.id = autopilot_messages.session_id
        AND autopilot_sessions.user_id = auth.uid()
    )
  );
