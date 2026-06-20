// Estado global (zustand): preferências, pilares, chave Gemini e sessão
// Google. Chave SEMPRE no SecureStore (Keystore do Android); o resto em
// AsyncStorage. Pilares/regras seguem o mesmo modelo editável do desktop
// (~/.aspis/pilares.json / prefs.json).

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import {
  DEFAULT_MIN_STARS,
  DEFAULT_MODEL,
  DEFAULT_PERIOD,
  DEFAULT_PILLARS,
  DEFAULT_RULES,
} from '../constants/defaults';
import { DEFAULT_GEMINI_VOICE, isValidVoice } from '../services/geminiTTS';
import { configureGoogle, restoreSignIn, signIn, signOutGoogle } from '../services/auth';
import * as db from '../services/db';
import type { GoogleUser, Period, Pillar } from '../types';

const SECURE_KEY = 'gemini_api_key';
const K = {
  model: 'aspis:model',
  pillars: 'aspis:pillars',
  rules: 'aspis:rules',
  minStars: 'aspis:minStars',
  period: 'aspis:period',
  showRead: 'aspis:showRead',
  ttsVoice: 'aspis:ttsVoice',
} as const;

interface AppState {
  ready: boolean;
  geminiKey: string;
  model: string;
  pillars: Pillar[];
  rules: string;
  minStars: number;
  period: Period;
  showRead: boolean;
  ttsVoice: string; // voz do Gemini para a leitura em voz alta
  user: GoogleUser | null;
  feedVersion: number; // bump → telas releem o SQLite

  init: () => Promise<void>;
  setGeminiKey: (key: string) => Promise<void>;
  setModel: (model: string) => Promise<void>;
  setPillars: (pillars: Pillar[]) => Promise<void>;
  setRules: (rules: string) => Promise<void>;
  setMinStars: (n: number) => Promise<void>;
  setPeriod: (p: Period) => Promise<void>;
  setShowRead: (v: boolean) => Promise<void>;
  setTtsVoice: (v: string) => Promise<void>;
  googleSignIn: () => Promise<GoogleUser | null>;
  googleSignOut: () => Promise<void>;
  bumpFeed: () => void;
}

function normalizePillars(raw: unknown): Pillar[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_PILLARS;
  return raw.map((p) => ({
    id: String(p.id || ''),
    nome: String(p.nome || ''),
    descricao: String(p.descricao || ''),
    quero: Array.isArray(p.quero) ? p.quero.map(String) : [],
    nao_quero: Array.isArray(p.nao_quero) ? p.nao_quero.map(String) : [],
    peso: Math.max(1, Math.min(5, Number(p.peso) || 3)),
    mocName: String(p.mocName || p.nome || ''),
  }));
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  geminiKey: '',
  model: DEFAULT_MODEL,
  pillars: DEFAULT_PILLARS,
  rules: DEFAULT_RULES,
  minStars: DEFAULT_MIN_STARS,
  period: DEFAULT_PERIOD,
  showRead: false,
  ttsVoice: DEFAULT_GEMINI_VOICE,
  user: null,
  feedVersion: 0,

  init: async () => {
    db.init();
    configureGoogle();

    const [key, stored] = await Promise.all([
      SecureStore.getItemAsync(SECURE_KEY).catch(() => null),
      AsyncStorage.multiGet(Object.values(K)).catch(() => [] as [string, string | null][]),
    ]);
    const map = new Map(stored);

    let pillars = DEFAULT_PILLARS;
    try {
      const raw = map.get(K.pillars);
      if (raw) pillars = normalizePillars(JSON.parse(raw));
    } catch {
      // mantém defaults
    }

    set({
      geminiKey: key || '',
      model: map.get(K.model) || DEFAULT_MODEL,
      pillars,
      rules: map.get(K.rules) || DEFAULT_RULES,
      minStars: map.get(K.minStars) != null ? Number(map.get(K.minStars)) : DEFAULT_MIN_STARS,
      period: (map.get(K.period) as Period) || DEFAULT_PERIOD,
      showRead: map.get(K.showRead) === '1',
      ttsVoice: isValidVoice(map.get(K.ttsVoice) || '')
        ? (map.get(K.ttsVoice) as string)
        : DEFAULT_GEMINI_VOICE,
    });

    const user = await restoreSignIn();
    set({ user, ready: true });
  },

  setGeminiKey: async (key: string) => {
    const trimmed = key.trim();
    if (trimmed) await SecureStore.setItemAsync(SECURE_KEY, trimmed);
    else await SecureStore.deleteItemAsync(SECURE_KEY);
    set({ geminiKey: trimmed });
  },

  setModel: async (model: string) => {
    set({ model });
    await AsyncStorage.setItem(K.model, model);
  },

  setPillars: async (pillars: Pillar[]) => {
    const normalized = normalizePillars(pillars);
    set({ pillars: normalized });
    await AsyncStorage.setItem(K.pillars, JSON.stringify(normalized));
  },

  setRules: async (rules: string) => {
    const value = rules.trim() || DEFAULT_RULES;
    set({ rules: value });
    await AsyncStorage.setItem(K.rules, value);
  },

  setMinStars: async (n: number) => {
    const v = Math.max(0, Math.min(5, Math.round(n)));
    set({ minStars: v });
    await AsyncStorage.setItem(K.minStars, String(v));
  },

  setPeriod: async (p: Period) => {
    set({ period: p });
    await AsyncStorage.setItem(K.period, p);
  },

  setShowRead: async (v: boolean) => {
    set({ showRead: v });
    await AsyncStorage.setItem(K.showRead, v ? '1' : '0');
  },

  setTtsVoice: async (v: string) => {
    const voice = isValidVoice(v) ? v : DEFAULT_GEMINI_VOICE;
    set({ ttsVoice: voice });
    await AsyncStorage.setItem(K.ttsVoice, voice);
  },

  googleSignIn: async () => {
    const user = await signIn();
    if (user) set({ user });
    return user;
  },

  googleSignOut: async () => {
    await signOutGoogle();
    set({ user: null });
  },

  bumpFeed: () => set({ feedVersion: get().feedVersion + 1 }),
}));
