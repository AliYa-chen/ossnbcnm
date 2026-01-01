export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const formData = await request.formData()
  const fileField = formData.get('file')
  const index = Number(formData.get('index'))
  const total = Number(formData.get('total'))
  if (!fileField || isNaN(index) || isNaN(total))
    return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 })

  const name = fileField.name
  const arrayBuffer = await fileField.arrayBuffer()

  // 缓存切片
  if (!globalThis._uploadCache) globalThis._uploadCache = new Map()
  const arr = globalThis._uploadCache.get(name) || []
  arr[index] = arrayBuffer
  globalThis._uploadCache.set(name, arr)

  // 如果最后一片上传完成
  if (arr.filter(Boolean).length === total) {
    // 合并切片
    let totalLength = arr.reduce((sum, buf) => sum + buf.byteLength, 0)
    const merged = new Uint8Array(totalLength)
    let offset = 0
    for (const buf of arr) {
      merged.set(new Uint8Array(buf), offset)
      offset += buf.byteLength
    }

    // 转 Base64 上传 GitHub
    let binary = ''
    const CHUNK = 0x8000
    for (let i = 0; i < merged.length; i += CHUNK) {
      const chunk = merged.subarray(i, i + CHUNK)
      binary += String.fromCharCode(...chunk)
    }
    const base64 = btoa(binary)

    // 上传到 GitHub
    const path = `public/assets/${name}`
    const api = `https://api.github.com/repos/${env.OWNER}/${env.REPO}/contents/${encodeURIComponent(path)}`

    let sha
    const getRes = await fetch(`${api}?ref=${env.BRANCH}`, {
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
    })
    if (getRes.ok) sha = (await getRes.json()).sha

    const putRes = await fetch(api, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ message: `upload ${path}`, content: base64, branch: env.BRANCH, ...(sha ? { sha } : {}) }),
    })

    globalThis._uploadCache.delete(name)
    return new Response(JSON.stringify(await putRes.json()), { headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ ok: true, index }), { headers: { 'Content-Type': 'application/json' } })
}
