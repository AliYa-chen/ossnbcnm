// ===== 工具：ArrayBuffer → base64（Worker 安全）=====
function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize)
    )
  }

  return btoa(binary)
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  globalThis._uploadSessions ||= new Map()

  // ================== COMMIT 阶段 ==================
  if (request.url.includes('commit=1')) {
    const { sessionId } = await request.json()
    const session = globalThis._uploadSessions.get(sessionId)

    if (!session) {
      return new Response('Session not found', { status: 400 })
    }

    const { OWNER, REPO, BRANCH, GITHUB_TOKEN: TOKEN } = env

    // 1️⃣ 获取当前分支 ref
    const ref = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
      }
    ).then(r => r.json())

    const parentCommitSha = ref.object.sha

    // 2️⃣ 获取 base tree
    const baseCommit = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/commits/${parentCommitSha}`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
      }
    ).then(r => r.json())

    const baseTreeSha = baseCommit.tree.sha

    // 3️⃣ 创建 blob（关键修复点）
    const tree = []

    for (const file of Object.values(session.files)) {
      // 合并切片
      const totalLength = file.chunks.reduce((s, b) => s + b.byteLength, 0)
      const merged = new Uint8Array(totalLength)

      let offset = 0
      for (const buf of file.chunks) {
        merged.set(new Uint8Array(buf), offset)
        offset += buf.byteLength
      }

      // ✅ 正确 base64
      const base64 = arrayBufferToBase64(merged.buffer)

      // 3.1 创建 blob
      const blobRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/git/blobs`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            Accept: 'application/vnd.github+json',
          },
          body: JSON.stringify({
            content: base64,
            encoding: 'base64',
          }),
        }
      ).then(r => r.json())

      // 3.2 tree 引用 blob sha
      tree.push({
        path: `public/assets/${file.name}`,
        mode: '100644',
        type: 'blob',
        sha: blobRes.sha,
      })
    }

    // 4️⃣ 创建 tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/trees`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree,
        }),
      }
    ).then(r => r.json())

    // 5️⃣ 创建 commit
    const commitRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/commits`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({
          message: `upload assets (${tree.length} files)`,
          tree: treeRes.sha,
          parents: [parentCommitSha],
        }),
      }
    ).then(r => r.json())

    // 6️⃣ 更新 ref（真正生效）
    await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({
          sha: commitRes.sha,
        }),
      }
    )

    globalThis._uploadSessions.delete(sessionId)

    return new Response(
      JSON.stringify({
        ok: true,
        commit: commitRes.sha,
        files: tree.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ================== 切片上传阶段 ==================
  const formData = await request.formData()
  const sessionId = formData.get('sessionId')
  const fileId = formData.get('fileId')
  const fileName = formData.get('fileName')
  const index = Number(formData.get('index'))
  const total = Number(formData.get('total'))
  const file = formData.get('file')

  if (!sessionId || !fileId || !file) {
    return new Response('Missing params', { status: 400 })
  }

  let session = globalThis._uploadSessions.get(sessionId)
  if (!session) {
    session = { files: {} }
    globalThis._uploadSessions.set(sessionId, session)
  }

  let record = session.files[fileId]
  if (!record) {
    record = { name: fileName, total, chunks: new Array(total) }
    session.files[fileId] = record
  }

  record.chunks[index] = await file.arrayBuffer()

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
