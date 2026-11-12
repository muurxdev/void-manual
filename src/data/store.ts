import { useState, useEffect } from 'react';
import type { Conversation, Manual, WorkshopProfile, Message } from './types';
import catalogData from './catalog.json';

const STORAGE_KEYS = {
  CONVERSATIONS: 'void_web_conversations',
  ACTIVE_ID: 'void_web_active_id',
  MANUALS: 'void_web_manuals',
  PROFILE: 'void_web_profile',
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
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
    } catch {
      return null;
    }
  });

  const [manuals, setManuals] = useState<Manual[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MANUALS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [profile, setProfile] = useState<WorkshopProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return saved ? { ...defaultProfile, ...JSON.parse(saved) } : defaultProfile;
    } catch {
      return defaultProfile;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
    } catch {}
  }, [conversations]);

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, activeId);
      else localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID);
    } catch {}
  }, [activeId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MANUALS, JSON.stringify(manuals));
    } catch {}
  }, [manuals]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch {}
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
