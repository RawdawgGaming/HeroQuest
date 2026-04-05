import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'your-supabase-url-here') {
  console.warn('Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase: SupabaseClient = createClient(supabaseUrl || '', supabaseAnonKey || '');

export interface PlayerProfile {
  id: string;
  email: string;
  displayName: string;
}

export async function signUp(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { user: null, error: error.message };
  return { user: data.user, error: null };
}

export async function signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { user: null, error: error.message };
  return { user: data.user, error: null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export function getDisplayName(user: User): string {
  return user.user_metadata?.display_name || user.email?.split('@')[0] || 'Hero';
}

// --- Character CRUD ---

export interface Character {
  id: string;
  user_id: string;
  name: string;
  hero_class: string;
  level: number;
  gold: number;
  diamonds: number;
  xp: number;
  current_stage: number;
  progression: Record<string, unknown>;
  created_at: string;
}

/** Check if a character name is already taken. */
export async function isNameTaken(name: string): Promise<boolean> {
  const { data } = await supabase
    .from('characters')
    .select('id')
    .ilike('name', name)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Create a new character. Returns the character or an error message. */
export async function createCharacter(
  userId: string,
  name: string,
  heroClass: string,
): Promise<{ character: Character | null; error: string | null }> {
  // Verify we have an active session before inserting
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { character: null, error: 'Session expired. Please sign in again.' };
  }

  const { data, error } = await supabase
    .from('characters')
    .insert({ user_id: userId, name, hero_class: heroClass })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { character: null, error: 'That name is already taken.' };
    }
    if (error.message.includes('row-level security')) {
      return { character: null, error: 'Auth error. Please sign out and sign in again.' };
    }
    return { character: null, error: error.message };
  }
  return { character: data as Character, error: null };
}

/** Save character progress (level, gold, xp, progression). */
export async function saveCharacter(
  characterId: string,
  updates: { level?: number; gold?: number; xp?: number; current_stage?: number; progression?: Record<string, unknown> },
): Promise<void> {
  const { error } = await supabase
    .from('characters')
    .update(updates)
    .eq('id', characterId);
  if (error) {
    console.error('Failed to save character:', error.message);
  }
}

/** Get all characters belonging to a user. */
export async function getUserCharacters(userId: string): Promise<Character[]> {
  const { data } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data as Character[]) ?? [];
}
