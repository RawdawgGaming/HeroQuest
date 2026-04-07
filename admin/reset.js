// Admin character reset script. Bypasses RLS using the service role key.
// Usage:
//   node admin/reset.js <character_name>
//
// Resets the character with the given name back to level 1, 0 gold, stage 1,
// and clears all skills/attributes/weapons.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const name = process.argv[2];
if (!name) {
  console.error('Usage: node admin/reset.js <character_name>');
  process.exit(1);
}

const freshProgression = {
  attrPointsAvailable: 0,
  attributes: {},
  skillPointsAvailable: 0,
  skills: {},
  ownedWeapons: [],
  equippedWeapon: null,
};

const { data, error } = await supabase
  .from('characters')
  .update({
    level: 1,
    gold: 0,
    xp: 0,
    current_stage: 0,
    progression: freshProgression,
  })
  .ilike('name', name)
  .select();

if (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.error(`No character found with name "${name}"`);
  process.exit(1);
}

for (const char of data) {
  console.log(`Reset "${char.name}" (${char.hero_class}) to level 1, stage 1, 0 gold.`);
}
