// 把 Cendant 账单 tracker 的房源文档同步到内部工作台（internal_props）。
// 只同步状态类字段；对外展示内容（pub、published）和人工改过的类型不动。
// 不同步：银行账户、BPAY、租客名字、长备注。
// 用法（在已登录的 work.html 里）：const m = await import('/js/work-sync.js'); await m.syncTracker(window.HOWZU_SB, docs)
export const FLAG_KEYS = ["lease", "rent", "elma", "rtba", "insp", "smoke", "gas", "elec", "oc"];

// 去掉可能是账号/参考号的长数字串，并限制长度
export const clean = s => String(s || "").replace(/\d[\d ]{7,}\d/g, "…").replace(/\s+/g, " ").trim().slice(0, 70);

export function fromTracker(doc) {
  const d = doc.data || doc, id = doc.id;
  const F = {};
  for (const k of FLAG_KEYS) {
    const c = d[k]; if (!c || !c.status) continue;
    F[k] = { s: c.status, why: clean(c.why || (k === "rent" || k === "insp" || k === "lease" ? c.note : "")) };
  }
  let status = "leased";
  if (d.archived) status = "archived";
  else if (d.lease?.status === "na" && d.rent?.status === "na") status = "airbnb";
  const addr = d.addr || id;
  const sub = (addr.split(",")[1] || "").trim() || null;
  const m = /Mgmt\s*([\d.]+)\s*%/i.exec(d.elma?.why || "");
  const row = {
    id, addr, suburb: sub,
    beds: d.beds ?? null, baths: d.baths ?? null, cars: d.cars ?? null,
    status,
    rent_month: d.rentAmt ?? null, bond: d.bondAmt ?? null,
    lease_start: d.leaseStart || null, lease_end: d.leaseEnd || null, paid_to: d.paidTo || null,
    mgmt_since: d.mgmtSince || null, owner: d.owner || null,
    late_rate: d.payHabit?.lateRate ?? null,
    flags: F,
  };
  // 费率以 PM 实际收取的为准（tracker 的 mgmtPct），没有才看 ELMA 摘要
  if (d.mgmtPct != null) row.mgmt_pct = Number(d.mgmtPct);
  else if (m) row.mgmt_pct = Number(m[1]);
  if (/^car\s*park/i.test(addr)) row.kind = "车位";
  return row;
}

// 逐套写入：已有的只更新上面这些字段，没有的新建到 Cendant 区块
export async function syncTracker(sb, docs, org = "cendant") {
  const out = { updated: [], inserted: [], failed: [] };
  for (const doc of docs) {
    const r = fromTracker(doc);
    const { data, error } = await sb.from("internal_props").update(r).eq("id", r.id).select("id");
    if (error) { out.failed.push(r.id + ": " + error.message); continue; }
    if (data && data.length) { out.updated.push(r.id); continue; }
    const { error: e2 } = await sb.from("internal_props").insert({ ...r, org_id: org });
    if (e2) out.failed.push(r.id + ": " + e2.message); else out.inserted.push(r.id);
  }
  return out;
}
