-- Add step column to conversation_states table for new streamlined flows
ALTER TABLE conversation_states 
ADD COLUMN IF NOT EXISTS step INTEGER; 