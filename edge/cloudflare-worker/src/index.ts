type KVNamespace = {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string) => Promise<void>;
};

type ExecutionContext = {
    waitUntil: (promise: Promise<unknown>) => void;
};

interface Env {
    STATS_KV: KVNamespace;
    COMMENTS_QUEUE: KVNamespace;
    WEBHOOK_URL?: string;
    WEBHOOK_TOKEN?: string;
}

type StatsDelta = {
    views_delta: number;
    likes_delta: number;
};

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json; charset=utf-8" }
    });

const readDelta = async (env: Env, postId: string): Promise<StatsDelta> => {
    const raw = await env.STATS_KV.get(`stats:${postId}`);
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

const updateDelta = async (
    env: Env,
    postId: string,
    field: keyof StatsDelta,
    delta = 1
): Promise<StatsDelta> => {
    const key = `stats:${postId}`;

    for (let i = 0; i < 4; i++) {
        const current = await readDelta(env, postId);
        const next: StatsDelta = {
            views_delta: current.views_delta,
            likes_delta: current.likes_delta
        };
        next[field] += delta;
        await env.STATS_KV.put(key, JSON.stringify(next));
        return next;
    }

    throw new Error("update delta failed");
};

const parsePostId = (pathname: string) => {
    const m = pathname.match(/^\/api\/v1\/stats\/([^/]+)(?:\/(view|like))?$/);
    if (!m) return null;
    return { postId: decodeURIComponent(m[1]), action: m[2] || "" };
};

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const { pathname } = new URL(request.url);

        if (request.method === "GET") {
            const route = parsePostId(pathname);
            if (!route || route.action) return json({ error: "not found" }, 404);

            const delta = await readDelta(env, route.postId);
            return json({ post_id: route.postId, ...delta });
        }

        if (request.method === "POST") {
            const route = parsePostId(pathname);

            if (route?.action === "view") {
                const next = await updateDelta(env, route.postId, "views_delta", 1);
                return json({ post_id: route.postId, ...next });
            }

            if (route?.action === "like") {
                const next = await updateDelta(env, route.postId, "likes_delta", 1);
                return json({ post_id: route.postId, ...next });
            }

            if (pathname === "/api/v1/comments") {
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
                    ctx.waitUntil(
                        fetch(env.WEBHOOK_URL, {
                            method: "POST",
                            headers: {
                                "content-type": "application/json",
                                ...(env.WEBHOOK_TOKEN ? { authorization: `Bearer ${env.WEBHOOK_TOKEN}` } : {})
                            },
                            body: JSON.stringify(queueItem)
                        }).catch(() => null)
                    );
                }

                return json({ ok: true, id });
            }
        }

        return json({ error: "not found" }, 404);
    }
};
