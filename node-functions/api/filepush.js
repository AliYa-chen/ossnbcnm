export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let body
  try {
    body = await request.json()
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { name, content } = body
  if (!name || !content) {
    return new Response(JSON.stringify({ error: 'Missing name or content' }), { status: 400 })
  }

  const TYPES = {
    image: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'],
    video: ['mp4', 'webm', 'ogg'],
    audio: ['mp3', 'wav', 'm4a'],
    font: ['ttf', 'otf', 'woff', 'woff2'],
  }

  const ext = name.split('.').pop().toLowerCase()
  let folder
  if (TYPES.image.includes(ext)) folder = 'img'
  else if (TYPES.video.includes(ext)) folder = 'video'
  else if (TYPES.audio.includes(ext)) folder = 'music'
  else if (TYPES.font.includes(ext)) folder = 'font'
  else {
    return new Response(JSON.stringify({ error: 'File type not allowed' }), { status: 400 })
  }

  const OWNER = env.OWNER
  const REPO = env.REPO
  const BRANCH = env.BRANCH
  const GITHUB_TOKEN = env.GITHUB_TOKEN

  // 最终上传路径
  const path = `public/assets/${folder}/${name}`
  const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`

  // 尝试获取 sha（文件存在就更新，不存在就创建）
  let sha
  const getRes = await fetch(`${api}?ref=${BRANCH}`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
  })
  if (getRes.ok) {
    const data = await getRes.json()
    sha = data.sha
  }

  // 提交文件
  const putRes = await fetch(api, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
    body: JSON.stringify({
      message: `upload ${path}`,
      content,
      BRANCH,
      ...(sha ? { sha } : {}),
    }),
  })

  const result = await putRes.json()
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
}
