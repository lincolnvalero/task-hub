-- Phase 1: Add canal column to tasks table
-- Run this in Supabase SQL Editor → https://supabase.com/dashboard/project/glrtianpnezeyxcjhxus/sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS canal TEXT;
COMMENT ON COLUMN tasks.canal IS 'Canal de publicação: INSTAGRAM, YOUTUBE, TIKTOK, LINKEDIN, WHATSAPP, SITE, EMAIL, EVENTO, APRESENTACAO, OUTRO';
