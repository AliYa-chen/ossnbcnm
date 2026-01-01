export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { name, content, index, total } = body
  if (!name || !content || index == null || total == null) {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 })
  }

  // 临时缓存分片
  if (!globalThis._uploadCache) globalThis._uploadCache = new Map()
  const arr = globalThis._uploadCache.get(name) || []
  arr[index] = content
  globalThis._uploadCache.set(name, arr)

  // 如果最后一片上传完成
  if (arr.filter(Boolean).length === total) {
    const fullBase64 = arr.join('') // 合并 Base64

    const OWNER = env.OWNER
    const REPO = env.REPO
    const BRANCH = env.BRANCH
    const GITHUB_TOKEN = env.GITHUB_TOKEN
    const path = `public/assets/${name}`
    const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`

    // 获取 sha
    let sha
    const getRes = await fetch(`${api}?ref=${BRANCH}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
    })
    if (getRes.ok) sha = (await getRes.json()).sha

    // PUT 到 GitHub
    const putRes = await fetch(api, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({
        message: `upload ${path}`,
        content: fullBase64,
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    })

    globalThis._uploadCache.delete(name)
    const result = await putRes.json()
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
  }

  // 返回已接收的分片 index
  return new Response(JSON.stringify({ ok: true, index }), { headers: { 'Content-Type': 'application/json' } })
}
