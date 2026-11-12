import { useState, useEffect } from 'react';
import type { Conversation, Manual, WorkshopProfile, Message } from './types';
import catalogData from './catalog.json';
import { repo, KEYS } from './repo';

const STORAGE_KEYS = {
  CONVERSATIONS: KEYS.conversations,
  ACTIVE_ID: KEYS.activeId,
  MANUALS: KEYS.manuals,
  PROFILE: KEYS.profile,
};

const defaultProfile: WorkshopProfile = {
  name: 'Garagem Central · Performance',
  mechanic: 'Murilo',
  specialty: 'Mecânica Pesada & Injeção Eletrônica',
  models: 'Honda CG/Titan 160, CB 500F, Yamaha MT-07, Lander 250',
  units: 'Torque: Nm · Pressão: bar/PSI · Folga: mm',
  apiUrl: 'http://127.0.0.1:8000/api/v1',
};

export function useVoidStore() {
  const [conversations, setConversations] = useState<Conversation[]>(() => repo.get<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []));

  const [activeId, setActiveId] = useState<string | null>(() => repo.get<string | null>(STORAGE_KEYS.ACTIVE_ID, null));

  const [manuals, setManuals] = useState<Manual[]>(() => repo.get<Manual[]>(STORAGE_KEYS.MANUALS, []));

  const [profile, setProfile] = useState<WorkshopProfile>(() => ({ ...defaultProfile, ...repo.get<Partial<WorkshopProfile>>(STORAGE_KEYS.PROFILE, {}) }));

  useEffect(() => {
    repo.set(STORAGE_KEYS.CONVERSATIONS, conversations);
  }, [conversations]);

  useEffect(() => {
    if (activeId) repo.set(STORAGE_KEYS.ACTIVE_ID, activeId);
    else repo.remove(STORAGE_KEYS.ACTIVE_ID);
  }, [activeId]);

  useEffect(() => {
    repo.set(STORAGE_KEYS.MANUALS, manuals);
  }, [manuals]);

  useEffect(() => {
    repo.set(STORAGE_KEYS.PROFILE, profile);
  }, [profile]);

  const activeConversation = conversations.find(c => c.id === activeId);

  function createConversation(initialPrompt?: string): Conversation {
    const newConv: Conversation = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: initialPrompt ? initialPrompt.slice(0, 48) : 'Nova Investigação',
      updatedAt: Date.now(),
      messages: [],
      model: 'general',
      effort: 'medium',
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveId(newConv.id);
    return newConv;
  }

  function deleteConversation(id: string): Conversation | undefined {
    const gone = conversations.find(c => c.id === id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) setActiveId(null);
    return gone;
  }

  function updateConversation(id: string, patch: Partial<Pick<Conversation, 'title' | 'pinned'>>) {
    setConversations(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  }

  function restoreConversation(conv: Conversation) {
    setConversations(prev => (prev.some(c => c.id === conv.id) ? prev : [conv, ...prev].sort((a, b) => b.updatedAt - a.updatedAt)));
  }

  function addMessage(conversationId: string, message: Message) {
    setConversations(prev =>
      prev.map(conv => {
        if (conv.id === conversationId) {
          const isFirstUser = conv.messages.length === 0 && message.role === 'user';
          return {
            ...conv,
            title: isFirstUser ? message.content.slice(0, 48) : conv.title,
            updatedAt: Date.now(),
            messages: [...conv.messages, message],
          };
        }
        return conv;
      })
    );
  }

  function updateStreamingMessage(conversationId: string, messageId: string, partialText: string) {
    setConversations(prev =>
      prev.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            messages: conv.messages.map(m =>
              m.id === messageId ? { ...m, content: partialText, isStreaming: true } : m
            ),
          };
        }
        return conv;
      })
    );
  }

  function finalizeStreamingMessage(conversationId: string, messageId: string, fullText: string) {
    setConversations(prev =>
      prev.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            messages: conv.messages.map(m =>
              m.id === messageId ? { ...m, content: fullText, isStreaming: false } : m
            ),
          };
        }
        return conv;
      })
    );
  }

  function addManual(manual: Manual) {
    setManuals(prev => [manual, ...prev]);
  }

  function deleteManual(id: string) {
    setManuals(prev => prev.filter(m => m.id !== id));
  }

  return {
    conversations,
    activeId,
    setActiveId,
    activeConversation,
    createConversation,
    deleteConversation,
    restoreConversation,
    updateConversation,
    addMessage,
    updateStreamingMessage,
    finalizeStreamingMessage,
    manuals,
    allManuals: [...(catalogData as Manual[]), ...manuals],
    addManual,
    deleteManual,
    profile,
    setProfile,
  };
}
