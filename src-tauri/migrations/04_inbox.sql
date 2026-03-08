-- 统一收件箱：跨通道消息存储
CREATE TABLE IF NOT EXISTS inbox_messages (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    channel_user_id TEXT NOT NULL DEFAULT '',
    channel_user_name TEXT NOT NULL DEFAULT '',
    direction TEXT NOT NULL DEFAULT 'incoming',  -- 'incoming' | 'outgoing'
    content TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'text',    -- 'text' | 'image' | 'file' | 'audio' | 'sticker'
    metadata TEXT DEFAULT '{}',                   -- JSON: 附加信息
    session_id TEXT NOT NULL DEFAULT '',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inbox_channel ON inbox_messages(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_session ON inbox_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_inbox_unread ON inbox_messages(is_read, created_at DESC);

-- 收件箱会话表：跟踪每个通道的活跃会话
CREATE TABLE IF NOT EXISTS inbox_sessions (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    channel_user_id TEXT NOT NULL DEFAULT '',
    channel_user_name TEXT NOT NULL DEFAULT '',
    last_message TEXT DEFAULT '',
    last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
    unread_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'agent' | 'closed'
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inbox_sessions_channel ON inbox_sessions(channel);
CREATE INDEX IF NOT EXISTS idx_inbox_sessions_updated ON inbox_sessions(last_message_at DESC);
