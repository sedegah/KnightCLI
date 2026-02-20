-- Add conversation state tracking to users table
-- This allows the bot to remember what flow a user is in (like waiting for 1v1 opponent input)

ALTER TABLE users ADD COLUMN conversation_state TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN conversation_data TEXT DEFAULT NULL;

-- conversation_state can be: '1v1_waiting_opponent', 'partnership_waiting_partner', 'squad_waiting_name', etc.
-- conversation_data stores JSON with context like: '{"initiated_at": "2024-03-21T10:00:00Z"}'
