// 获取 GitHub 仓库 Star 数
export async function onRequest({ env }) {
    const OWNER = env.OWNER
    const REPO = env.REPO
    const TOKEN = env.GITHUB_TOKEN

    if (!OWNER || !REPO || !TOKEN) {
        return new Response(
            JSON.stringify({ error: 'Missing env config' }),
            { status: 500 }
        )
    }

    const res = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}`,
        {
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': 'cf-pages-stars',
            },
        }
    )

    if (!res.ok) {
        return new Response(
            JSON.stringify({ error: 'GitHub API error' }),
            { status: res.status }
        )
    }

    const data = await res.json()

    return new Response(
        JSON.stringify({
            stars: data.stargazers_count,
        }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=600',
            },
        }
    )
}
