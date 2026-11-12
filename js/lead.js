// 租客留需求：存进 Supabase 已有的 listings 表（kind = "求租需求"，status = "pending"）。
// pending 的行公众读不到（RLS 只放出 live/let），只有后台能看到，所以联系方式不会公开。
// 纯函数 + 一个 submit()，浏览器和 node 测试都能用。
(function (root) {
  const KIND = "求租需求";
  const clip = (s, n) => String(s == null ? "" : s).trim().slice(0, n);
  const isPhone = s => /^[+\d][\d\s()-]{7,}$/.test(s) && (s.match(/\d/g) || []).length >= 8;
  const bedsNum = s => { const m = String(s || "").match(/(\d)/); return /单间/.test(s) ? 0 : m ? Math.min(+m[1], 10) : null; };
  // 把表单变成一行 listings；不合格返回 { error }
  function leadRow(f) {
    f = f || {};
    const contact = clip(f.contact, 40);
    if (contact.length < 3) return { error: "请留一个微信号、手机或邮箱，方便有房时通知你" };
    const area = clip(f.area || f.school, 60) || "墨尔本（区域不限）";
    const budget = Math.round(+String(f.budget || "").replace(/[^\d.]/g, "")) || 0;
    const beds = bedsNum(f.beds);
    const room = clip(f.beds, 12) || "房型不限";
    const lines = [
      "租客需求",
      `区域/学区：${area}`,
      `房型：${room}`,
      `预算：${budget ? "$" + budget + "/周" : "未填"}`,
      `入住：${clip(f.when, 40) || "未填"}`,
      f.grade ? `孩子年级：${clip(f.grade, 20)}` : "",
      f.other ? `其他：${clip(f.other, 500)}` : "",
      `联系：${contact}`,
      f.ref ? `来自：${clip(f.ref, 80)}` : "",
    ].filter(Boolean);
    return {
      status: "pending",
      kind: KIND,
      title: clip(`求租 · ${area} · ${room}`, 80),
      address: clip("求租需求：" + area, 200),
      suburb: clip(f.area, 60) || null,
      beds,
      rent_weekly: budget >= 50 && budget <= 20000 ? budget : null,
      available: clip(f.when, 40) || null,
      highlights: [KIND],
      description: lines.join("\n").slice(0, 3000),
      contact_phone: isPhone(contact) ? contact.slice(0, 30) : null,
      contact_wechat: isPhone(contact) ? null : contact,
      photos: [],
    };
  }
  const isLead = x => !!x && x.kind === KIND;
  async function submit(f, cfg) {
    const row = leadRow(f);
    if (row.error) return { ok: false, error: row.error };
    if (f && f.website) return { ok: true }; // 机器人填了隐藏栏，假装成功
    cfg = cfg || root.HOWZU || {};
    if (!cfg.SUPABASE_URL) return { ok: false, error: "暂时提交不了，请直接加微信联系我们" };
    try {
      const r = await fetch(`${cfg.SUPABASE_URL}/rest/v1/listings`, {
        method: "POST",
        headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(row),
      });
      return r.ok ? { ok: true } : { ok: false, error: "提交没成功，请稍后再试或直接加微信联系我们" };
    } catch (_) { return { ok: false, error: "网络不太好，请稍后再试" }; }
  }
  // 列表页当前的筛选 → 留需求表单的预填值（没找到房时少填一遍）
  function fromFilter(s) {
    s = s || {};
    return { beds: { "1": "1 房", "2": "2 房", "3": "3 房+" }[s.beds] || "", area: clip(s.area, 40), budget: clip(s.rent, 8) };
  }
  const api = { KIND, leadRow, isLead, submit, fromFilter };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HowzuLead = api;
})(typeof window !== "undefined" ? window : globalThis);
