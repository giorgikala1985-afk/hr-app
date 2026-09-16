// USD -> GEL rate from the National Bank of Georgia's public API, for a given
// date. NBG doesn't publish new rates on weekends/holidays, so this walks
// backward up to a week to find the most recent published rate.
async function nbgUsdToGelRate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  for (let i = 0; i < 7; i++) {
    const ds = d.toISOString().slice(0, 10);
    try {
      const res = await fetch(`https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/?date=${ds}&lang=en`);
      const json = await res.json();
      const list = json?.[0]?.currencies || [];
      const usd = list.find(c => c.code === 'USD');
      if (usd) return usd.rate / (usd.quantity || 1);
    } catch { /* try an earlier date */ }
    d.setDate(d.getDate() - 1);
  }
  return null;
}

module.exports = { nbgUsdToGelRate };
