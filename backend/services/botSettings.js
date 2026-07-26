const supabase = require('../config/supabase');

// Matches the data sources the web FinBots UI already exposes per-bot
// (FinBotsPage.js's DATA_SOURCE_DEFS) — see finbotChat.js's SOURCE_FETCHERS
// for what each key actually fetches.
const ALL_SOURCES = ['employees', 'salaries', 'bonuses', 'insurance', 'fitpass', 'accounting', 'sales', 'stock', 'holidays', 'coagents'];
const DEFAULT_SOURCES = ['employees', 'coagents'];

async function getBotDataSources(userId, channel) {
  try {
    const { data } = await supabase.from('bot_settings')
      .select('data_sources').eq('user_id', userId).eq('channel', channel).maybeSingle();
    return data?.data_sources || DEFAULT_SOURCES;
  } catch {
    return DEFAULT_SOURCES;
  }
}

async function setBotDataSources(userId, channel, dataSources) {
  const clean = (Array.isArray(dataSources) ? dataSources : []).filter(s => ALL_SOURCES.includes(s));
  const { error } = await supabase.from('bot_settings')
    .upsert({ user_id: userId, channel, data_sources: clean, updated_at: new Date().toISOString() }, { onConflict: 'user_id,channel' });
  if (error) throw error;
  return clean;
}

module.exports = { getBotDataSources, setBotDataSources, ALL_SOURCES, DEFAULT_SOURCES };
