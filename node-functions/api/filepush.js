export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  if (!globalThis._uploadSessions) {
    globalThis._uploadSessions = new Map()
  }

  // ========== commit 阶段 ==========
  if (request.url.includes('commit=1')) {
    const { sessionId } = await request.json()
    const session = globalThis._uploadSessions.get(sessionId)

    if (!session) {
      return new Response('Session not found', { status: 400 })
    }

    const OWNER = env.OWNER
    const REPO = env.REPO
    const BRANCH = env.BRANCH
    const TOKEN = env.GITHUB_TOKEN

    // 1️⃣ 获取当前分支最新 commit
    const refRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
      }
    )
    const refData = await refRes.json()
    const parentCommitSha = refData.object.sha

    // 2️⃣ 获取 base tree
    const commitRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/commits/${parentCommitSha}`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
      }
    )
    const commitData = await commitRes.json()
    const baseTreeSha = commitData.tree.sha

    // 3️⃣ 生成 tree entries
    const tree = []

    for (const file of Object.values(session.files)) {
      // 合并切片
      const totalLength = file.chunks.reduce((s, b) => s + b.byteLength, 0)
      const merged = new Uint8Array(totalLength)

      let offset = 0
      for (const c of file.chunks) {
        merged.set(new Uint8Array(c), offset)
        offset += c.byteLength
      }

      // Uint8Array → base64
      let binary = ''
      for (let i = 0; i < merged.length; i += 0x8000) {
        binary += String.fromCharCode(...merged.subarray(i, i + 0x8000))
      }

      tree.push({
        path: `public/assets/${file.name}`,
        mode: '100644',
        type: 'blob',
        content: btoa(binary),
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
    )
    const treeData = await treeRes.json()

    // 5️⃣ 创建 commit
    const newCommitRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/commits`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({
          message: `upload assets (${tree.length} files)`,
          tree: treeData.sha,
          parents: [parentCommitSha],
        }),
      }
    )
    const newCommit = await newCommitRes.json()

    // 6️⃣ 更新分支指向新 commit（真正“生效”的一步）
    await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({
          sha: newCommit.sha,
        }),
      }
    )

    globalThis._uploadSessions.delete(sessionId)

    return new Response(
      JSON.stringify({
        ok: true,
        commit: newCommit.sha,
        files: tree.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }


  // ========== 上传切片阶段 ==========
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
    record = {
      name: fileName,
      total,
      chunks: new Array(total),
    }
    session.files[fileId] = record
  }

  record.chunks[index] = await file.arrayBuffer()

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
