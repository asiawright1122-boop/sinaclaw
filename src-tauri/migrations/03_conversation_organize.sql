-- 对话组织增强：置顶和归档
ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conversations ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_conversations_pinned ON conversations(pinned DESC, updated_at DESC);
