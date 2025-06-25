// AI Chat System - Organized Modules
// 
// This directory contains the organized AI chat logic for the HR Agent system:
//
// 1. system-prompts.ts - All system prompts for employee and admin AI
// 2. admin-chat.ts - Admin-specific chat handling and data processing 
// 3. employee-chat.ts - Employee-specific chat handling and flow management
// 4. conversation-flows.ts - Multi-step conversation state management
//
// Entry Point: app/api/chat/route.ts routes requests to appropriate handlers

export { buildEmployeeSystemPrompt, buildAdminSystemPrompt } from './system-prompts';
export { handleAdminChat } from './admin-chat';
export { handleEmployeeChat } from './employee-chat';
export { handleConversationFlow } from './conversation-flows'; 