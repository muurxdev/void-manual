export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  attachment?: string;
  citations?: Citation[];
  analysis?: string;
  rating?: 'like' | 'dislike';
  isStreaming?: boolean;
}

export interface Citation {
  title: string;
  line?: number;
  text: string;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
  manualId?: string;
  model: 'general' | 'exact' | 'server';
  effort?: 'low' | 'medium' | 'high';
  pinned?: boolean;
}

export type FileKind = 'pdf' | 'doc' | 'sheet' | 'image' | 'audio' | 'text' | 'other';

export interface Manual {
  id: string;
  title: string;
  text: string;
  aliases?: string[];
  category?: 'honda' | 'yamaha' | 'eletronica' | 'geral';
  updatedAt?: number;
}

/** Item da Biblioteca: arquivo lido, entendido e organizado por tópicos. */
export interface LibraryRecord {
  id: string;
  title: string;
  kind: FileKind;
  size: number;
  mime: string;
  topics: string[];
  text: string;
  thumb?: string;
  note?: string;
  createdAt: number;
}

export interface WorkshopProfile {
  name: string;
  mechanic: string;
  specialty: string;
  models: string;
  units: string;
  apiUrl: string;
  photo?: string;
}

/** Estado da conversa por voz. */
export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';
