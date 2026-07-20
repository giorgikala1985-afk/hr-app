import api from '../services/api';

// The raw TBC bank statement Excel upload (Data Lake -> TBC Bank) is saved
// per-company in Supabase, not localStorage — it must never leak between
// companies sharing the same browser/device.

export async function fetchTbcRawStatement() {
  try {
    const res = await api.get('/tbc-bank/statement');
    const s = res.data?.statement;
    if (!s || !s.rows) return null;
    return { rows: s.rows, fileName: s.file_name, savedAt: s.saved_at };
  } catch {
    return null;
  }
}

export async function saveTbcRawStatement(fileName, rows) {
  const res = await api.put('/tbc-bank/statement', { file_name: fileName, rows });
  return res.data?.statement;
}

export async function clearTbcRawStatement() {
  await api.delete('/tbc-bank/statement');
}
