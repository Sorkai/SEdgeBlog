type KVLike = {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string) => Promise<void>;
};

type StatsDelta = {
    views_delta: number;
    likes_delta: number;
};

type EdgeOneEnv = {
    STATS_KV?: KVLike;
    COMMENTS_QUEUE?: KVLike;
    WEBHOOK_URL?: string;
    WEBHOOK_TOKEN?: string;
};

type EdgeOneContext = {
    request: Request;
    env: EdgeOneEnv;
    waitUntil?: (promise: Promise<unknown>) => void;
};

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json; charset=utf-8" }
    });

const parsePostId = (pathname: string) => {
    const m = pathname.match(/^\/api\/v1\/stats\/([^/]+)(?:\/(view|like))?$/);
    if (!m) return null;
    return { postId: decodeURIComponent(m[1]), action: m[2] || "" };
};

const readDelta = async (kv: KVLike | undefined, postId: string): Promise<StatsDelta> => {
    if (!kv) return { views_delta: 0, likes_delta: 0 };

    const raw = await kv.get(`stats:${postId}`);
    if (!raw) return { views_delta: 0, likes_delta: 0 };

    try {
        const parsed = JSON.parse(raw) as Partial<StatsDelta>;
        return {
            views_delta: Number(parsed.views_delta || 0),
            likes_delta: Number(parsed.likes_delta || 0)
        };
    } catch {
        return { views_delta: 0, likes_delta: 0 };
    }
};

const writeDelta = async (kv: KVLike | undefined, postId: string, next: StatsDelta) => {
    if (!kv) throw new Error("STATS_KV binding is missing");
    await kv.put(`stats:${postId}`, JSON.stringify(next));
};

export async function onRequest(context: EdgeOneContext): Promise<Response> {
    const { request, env } = context;
    const { pathname } = new URL(request.url);

    if (request.method === "GET") {
        const route = parsePostId(pathname);
        if (!route || route.action) return json({ error: "not found" }, 404);

        const delta = await readDelta(env.STATS_KV, route.postId);
        return json({ post_id: route.postId, ...delta });
    }

    if (request.method === "POST") {
        const route = parsePostId(pathname);

        if (route?.action === "view" || route?.action === "like") {
            const field = route.action === "view" ? "views_delta" : "likes_delta";
            const current = await readDelta(env.STATS_KV, route.postId);
            const next: StatsDelta = {
                views_delta: current.views_delta,
                likes_delta: current.likes_delta
            };
            next[field] += 1;

            await writeDelta(env.STATS_KV, route.postId, next);
            return json({ post_id: route.postId, ...next });
        }

        if (pathname === "/api/v1/comments") {
            if (!env.COMMENTS_QUEUE) {
                return json({ error: "COMMENTS_QUEUE binding is missing" }, 500);
            }

            const body = (await request.json().catch(() => null)) as
                | { post_id?: string; content?: string; author?: string }
                | null;

            if (!body?.post_id || !body?.content) {
                return json({ error: "invalid payload" }, 400);
            }

            const id = `${Date.now()}-${crypto.randomUUID()}`;
            const queueItem = {
                id,
                post_id: String(body.post_id),
                content: String(body.content),
                author: body.author || "anonymous",
                created_at: new Date().toISOString()
            };

            await env.COMMENTS_QUEUE.put(`comments_queue:${id}`, JSON.stringify(queueItem));

            if (env.WEBHOOK_URL) {
                const task = fetch(env.WEBHOOK_URL, {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                        ...(env.WEBHOOK_TOKEN ? { authorization: `Bearer ${env.WEBHOOK_TOKEN}` } : {})
                    },
                    body: JSON.stringify(queueItem)
                }).catch(() => null);

                context.waitUntil ? context.waitUntil(task) : void task;
            }

            return json({ ok: true, id });
        }
    }

    return json({ error: "not found" }, 404);
}
