export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // 获取文件（FormData 上传）
  let file, name
  try {
    const formData = await request.formData()
    const fileField = formData.get('file')
    if (!fileField) throw new Error('No file uploaded')

    file = await fileField.arrayBuffer() // ArrayBuffer
    name = fileField.name
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid file upload', message: e.message }), { status: 400 })
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
  else return new Response(JSON.stringify({ error: 'File type not allowed' }), { status: 400 })

  const OWNER = env.OWNER
  const REPO = env.REPO
  const BRANCH = env.BRANCH
  const GITHUB_TOKEN = env.GITHUB_TOKEN

  const path = `public/assets/${folder}/${name}`
  const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`

  // 获取 sha
  let sha
  const getRes = await fetch(`${api}?ref=${BRANCH}`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
  })
  if (getRes.ok) {
    const data = await getRes.json()
    sha = data.sha
  }

  // ArrayBuffer → Base64
  const uint8 = new Uint8Array(file)
  const CHUNK_SIZE = 0x8000
  let base64 = ''
  for (let i = 0; i < uint8.length; i += CHUNK_SIZE) {
    const chunk = uint8.subarray(i, i + CHUNK_SIZE)
    base64 += String.fromCharCode(...chunk)
  }
  base64 = btoa(base64)

  // 上传到 GitHub
  const putRes = await fetch(api, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
    body: JSON.stringify({
      message: `upload ${path}`,
      content: base64,
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  })

  const result = await putRes.json()
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
}
