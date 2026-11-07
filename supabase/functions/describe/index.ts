// 好租 Howzu：AI 帮房东写房源标题和介绍（只用用户填的信息，不编造）
const ALLOW = ["https://howzu.com.au", "http://howzu.com.au", "https://www.howzu.com.au", "https://pbz13p.github.io", "http://localhost:8799"];
const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": o && ALLOW.includes(o) ? o : ALLOW[0],
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});
const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return new Response("POST only", { status: 405, headers: cors(origin) });
  try {
    const b = await req.json();
    const facts = {
      类型: clip(b.kind, 20), 区域: clip(b.suburb, 60), 地址街道: clip(b.street, 120),
      卧室: b.beds, 卫生间: b.baths, 车位: b.cars, 每周租金澳元: b.rent || "面议",
      入住: clip(b.available, 30), 家具: clip(b.furnished, 20),
      亮点: (Array.isArray(b.highlights) ? b.highlights : []).slice(0, 12).map((h: unknown) => clip(h, 20)),
      房东自己写的: clip(b.notes, 800),
    };
    const prompt = `你是墨尔本中文租房平台"好租 Howzu"的文案编辑。根据下面房东填写的信息，写一条出租房源的标题和介绍，给在墨尔本的华人租客看。

要求：
- 只能使用下面给出的信息，绝对不要编造没提到的设施、景观、楼层、距离或条件。信息少就写短一点。
- 介绍用简体中文，自然、真诚、好读，不夸张，不用"绝佳""顶级"等空话。
- 介绍格式：第一行一句话总结；然后分段（可用 🏠 房子 / 🚉 交通和周边 / 📝 其他 这样的小标题，只写有信息的段落），每段用"· "开头的短句；最后一句邀请联系看房。总长不超过 220 字。
- 标题不超过 30 字，包含区域、房型和最大亮点。
- 不要写电话、微信、价格以外的数字承诺，不要写违法或歧视性要求。

房东填写的信息（JSON）：
${JSON.stringify(facts, null, 1)}

只输出 JSON：{"title": "...", "description": "..."}`;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "", "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 700, messages: [{ role: "user", content: prompt }] }),
    });
    const j = await r.json();
    if (!r.ok) return new Response(JSON.stringify({ error: j?.error?.message ?? "AI 出错" }), { status: 502, headers: { ...cors(origin), "content-type": "application/json" } });
    const text: string = j.content?.[0]?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    const out = m ? JSON.parse(m[0]) : { title: "", description: text };
    return new Response(JSON.stringify({ title: clip(out.title, 60), description: clip(out.description, 1500) }), { headers: { ...cors(origin), "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { ...cors(origin), "content-type": "application/json" } });
  }
});
