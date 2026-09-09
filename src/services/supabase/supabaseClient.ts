import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default project configuration from user's Supabase instance
const DEFAULT_SUPABASE_URL = 'https://vpttgtalqkowtragjbut.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdHRndGFscWtvd3RyYWdqYnV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MzkyMTAsImV4cCI6MjEwNDExNTIxMH0.6JSWlKJbArNQBBJmKpmWobSUMoWUPn86XjV_1KBEFic';

/**
 * Configuration de connexion au service Supabase.
 */
export interface SupabaseConfig {
  version: number;
  url: string;
  anonKey: string;
  isConnected: boolean;
  lastSyncedAt?: string;
  autoSyncEnabled: boolean;
}

const STORAGE_KEY = 'dmc_supabase_config_v1';

/**
 * Récupère la configuration Supabase actuelle stockée dans le localStorage,
 * avec fallback sur les variables d'environnement Vite ou les valeurs par défaut.
 * 
 * @returns {SupabaseConfig} La configuration active.
 */
export const getSupabaseConfig = (): SupabaseConfig => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && parsed.version === 1) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read Supabase config from localStorage', e);
  }

  return {
    version: 1,
    url: ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL) || DEFAULT_SUPABASE_URL,
    anonKey: ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY,
    isConnected: false,
    autoSyncEnabled: true
  };
};

/**
 * Sauvegarde la configuration Supabase mise à jour dans le localStorage
 * et réinitialise l'instance singleton du client Supabase.
 * 
 * @param {Partial<SupabaseConfig>} config Les modifications de configuration à appliquer.
 * @returns {SupabaseConfig} La configuration complète après sauvegarde.
 */
export const saveSupabaseConfig = (config: Partial<SupabaseConfig>): SupabaseConfig => {
  const current = getSupabaseConfig();
  const updated: SupabaseConfig = { ...current, ...config, version: 1 };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  // Reinitialize client instance
  initSupabaseClient();
  return updated;
};

let clientInstance: SupabaseClient | null = null;

/**
 * Initialise l'instance du client Supabase à partir de la configuration active.
 * 
 * @returns {SupabaseClient | null} L'instance Supabase ou null si la configuration est incomplète.
 */
export const initSupabaseClient = (): SupabaseClient | null => {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey || config.anonKey.includes('placeholder')) {
    clientInstance = null;
    return null;
  }

  try {
    clientInstance = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    return clientInstance;
  } catch (err) {
    console.warn('Supabase client initialization failed:', err);
    clientInstance = null;
    return null;
  }
};

/**
 * Récupère l'instance singleton du client Supabase en mémoire ou l'initialise si nécessaire.
 * 
 * @returns {SupabaseClient | null} L'instance active du client Supabase.
 */
export const getSupabaseClient = (): SupabaseClient | null => {
  if (!clientInstance) {
    return initSupabaseClient();
  }
  return clientInstance;
};

/**
 * Teste la connectivité avec l'instance Supabase distante à l'aide d'une URL et d'une clé API anonyme.
 * 
 * @param {string} url L'URL de l'instance Supabase.
 * @param {string} key La clé anonyme (anon key) Supabase.
 * @returns {Promise<{ success: boolean; message: string }>} Le résultat du test de connectivité.
 */
export const testSupabaseConnection = async (url: string, key: string): Promise<{ success: boolean; message: string }> => {
  if (!url || !key) {
    return { success: false, message: "L'URL et la clé anonyme Supabase sont obligatoires." };
  }

  try {
    const testClient = createClient(url, key);
    // Simple ping to check if truck_models or user_accounts is accessible
    const { error } = await testClient.from('truck_models').select('id').limit(1);
    
    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet, it will return 42P01 but connection is valid
      if (error.message.includes('relation "public.truck_models" does not exist')) {
        return { 
          success: true, 
          message: "Connexion réussie ! (Pensez à exécuter le script schema.sql dans Supabase SQL Editor pour créer les tables)" 
        };
      }
      return { success: false, message: `Erreur Supabase: ${error.message}` };
    }

    return { success: true, message: "Connexion à la base de données PostgreSQL DMC réussie !" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Échec de connexion: ${msg}` };
  }
};
