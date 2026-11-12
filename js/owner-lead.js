// 房东托管咨询：存进 Supabase listings 表（kind = "房东托管咨询"，status = "pending"），公众读不到，只有后台能看到。
(function (root) {
  const KIND = "房东托管咨询";
  const clip = (s, n) => String(s == null ? "" : s).trim().slice(0, n);
  const isPhone = s => /^[+\d][\d\s()-]{7,}$/.test(s) && (s.match(/\d/g) || []).length >= 8;
  function ownerRow(f) {
    f = f || {};
    const contact = clip(f.contact, 40);
    if (contact.length < 3) return { error: "请留一个微信号、手机或邮箱，我们好联系你" };
    const area = clip(f.area, 60);
    if (area.length < 2) return { error: "请写一下房子在哪个区（不用写门牌号）" };
    const kind = clip(f.type, 12) || "未填";
    const beds = Math.min(+String(f.beds || "").replace(/\D/g, "") || 0, 10) || null;
    const lines = ["房东托管咨询", `区域：${area}`, `类型：${kind}`, `卧室：${beds != null ? beds : "未填"}`,
      `现在：${clip(f.now, 20) || "未填"}`, `业主在：${clip(f.where, 20) || "未填"}`,
      f.other ? `其他：${clip(f.other, 500)}` : "", `联系：${contact}`, f.ref ? `来自：${clip(f.ref, 80)}` : ""].filter(Boolean);
    return { status: "pending", kind: KIND, title: clip(`房东托管 · ${area} · ${kind}`, 80), address: clip("房东托管咨询：" + area, 200),
      suburb: area, beds, rent_weekly: null, available: null, highlights: [KIND], description: lines.join("\n").slice(0, 3000),
      contact_phone: isPhone(contact) ? contact.slice(0, 30) : null, contact_wechat: isPhone(contact) ? null : contact, photos: [] };
  }
  async function submit(f, cfg) {
    const row = ownerRow(f);
    if (row.error) return { ok: false, error: row.error };
    if (f && f.website) return { ok: true };
    cfg = cfg || root.HOWZU || {};
    if (!cfg.SUPABASE_URL) return { ok: false, error: "暂时提交不了，请直接打电话联系我们" };
    try {
      const r = await fetch(`${cfg.SUPABASE_URL}/rest/v1/listings`, { method: "POST",
        headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(row) });
      return r.ok ? { ok: true } : { ok: false, error: "提交没成功，请稍后再试或直接打电话联系我们" };
    } catch (_) { return { ok: false, error: "网络不太好，请稍后再试" }; }
  }
  const api = { KIND, ownerRow, submit };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HowzuOwner = api;
})(typeof window !== "undefined" ? window : globalThis);
