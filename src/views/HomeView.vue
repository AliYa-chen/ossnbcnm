<script setup>
import { ref,computed } from 'vue'

const BASE_URL = window.location.origin

const file = ref(null)
const MAX_SIZE_MB = 25

/**
 * 扫描 public/assets
 */
const modules = import.meta.glob('/public/assets/**/*', {
  eager: true,
  as: 'url'
})

/**
 * 资源类型
 */
const TYPES = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'],
  video: ['mp4', 'webm', 'ogg'],
  audio: ['mp3', 'wav', 'm4a'],
  font: ['ttf', 'otf', 'woff', 'woff2'],
}

function getType(name) {
  const ext = name.split('.').pop().toLowerCase()
  if (TYPES.image.includes(ext)) return 'image'
  if (TYPES.video.includes(ext)) return 'video'
  if (TYPES.audio.includes(ext)) return 'audio'
  if (TYPES.font.includes(ext)) return 'font'
  return null
}

/**
 * 分组资源
 */
const resources = computed(() => {
  const res = { image: [], video: [], audio: [], font: [] }

  Object.entries(modules).forEach(([path, url]) => {
    // /public/assets/xxx → assets/xxx
    const name = path.replace('/public/assets/', '')
    const type = getType(name)
    if (!type) return

    res[type].push({
      name,
      url,        // 👉 已经是 /assets/xxx
      fullUrl: BASE_URL + url // 👉 public 下不需要 BASE_URL 拼接
    })
  })

  return res
})

async function copyLink(url) {
  await navigator.clipboard.writeText(url)
  alert('已复制资源链接')
}

async function upload() {
  if (!file.value) {
    alert('请选择文件')
    return
  }

  // 文件大小限制
  const sizeMB = file.value.size / 1024 / 1024
  if (sizeMB > MAX_SIZE_MB) {
    alert(`文件过大，最大支持 ${MAX_SIZE_MB} MB`)
    return
  }

  // 使用 FileReader 生成 base64
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // 读取结果是 data:<mime>;base64,<base64>
      // 我们只取 base64 部分
      const result = reader.result.split(',')[1]
      resolve(result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file.value)
  })

  try {
    const res = await fetch('/functions/github-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: file.value.name,
        content: base64,
      }),
    })

    const data = await res.json()
    if (data.content?.path) {
      alert(`上传成功: ${data.content.path}`)
    } else {
      alert(`上传失败: ${data.error || JSON.stringify(data)}`)
    }
  } catch (err) {
    console.error(err)
    alert('上传失败，请重试')
  }
}

</script>

<template>
  <div class="min-h-screen bg-zinc-50 dark:bg-zinc-900
              text-zinc-900 dark:text-zinc-100 p-6">

    <h1 class="mb-8 text-2xl font-bold">📦 Public Assets 资源浏览</h1>

    <div class="mb-8">
      <input type="file" @change="e => file = e.target.files[0]" />
      <button @click="upload" class="ml-2 px-4 py-2 bg-blue-600 text-white rounded">上传</button>
    </div>

    <!-- 图片 -->
    <section v-if="resources.image.length" class="mb-10 pt-7">
      <h2 class="mb-4 text-xl font-semibold pb-3">🖼 图片</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div v-for="item in resources.image" :key="item.name" @click="copyLink(item.fullUrl)" class="cursor-pointer rounded-xl border border-zinc-200 dark:border-zinc-700
                 bg-white dark:bg-zinc-800 p-3 transition hover:shadow-lg">
          <img :src="item.url" class="h-36 w-full object-contain rounded-md
                   bg-zinc-100 dark:bg-zinc-700" />
          <div class="mt-2 truncate text-xs text-zinc-600 dark:text-zinc-400">
            {{ item.name }}
          </div>
        </div>
      </div>
    </section>

    <!-- 视频 -->
    <section v-if="resources.video.length" class="mb-10 pt-7">
      <h2 class="mb-4 text-xl font-semibold pb-3">🎬 视频</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div v-for="item in resources.video" :key="item.name" @click="copyLink(item.fullUrl)" class="cursor-pointer rounded-xl border border-zinc-200 dark:border-zinc-700
                 bg-white dark:bg-zinc-800 p-3 transition hover:shadow-lg">
          <video :src="item.url" controls class="h-36 w-full object-contain rounded-md bg-black" />
          <div class="mt-2 truncate text-xs text-zinc-600 dark:text-zinc-400">
            {{ item.name }}
          </div>
        </div>
      </div>
    </section>

    <!-- 音乐 -->
    <section v-if="resources.audio.length" class="mb-10 pt-7">
      <h2 class="mb-4 text-xl font-semibold pb-3">🎵 音乐</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div v-for="item in resources.audio" :key="item.name" @click="copyLink(item.fullUrl)" class="cursor-pointer rounded-xl border border-zinc-200 dark:border-zinc-700
                 bg-white dark:bg-zinc-800 p-3 transition hover:shadow-lg">
          <div class="flex h-36 flex-col justify-center gap-2">
            <div class="truncate text-sm font-medium">
              🎧 {{ item.name }}
            </div>
            <audio :src="item.url" controls class="w-full" />
          </div>
        </div>
      </div>
    </section>

    <!-- 字体 -->
    <section v-if="resources.font.length" class="mb-10 pt-7">
      <h2 class="mb-4 text-xl font-semibold pb-3">🔤 字体</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div v-for="item in resources.font" :key="item.name" @click="copyLink(item.fullUrl)" class="cursor-pointer rounded-xl border border-zinc-200 dark:border-zinc-700
                 bg-white dark:bg-zinc-800 p-4 transition hover:shadow-lg
                 flex items-center justify-center h-36">
          <div class="text-center">
            <div class="text-2xl mb-2">🔠</div>
            <div class="truncate text-xs font-mono text-zinc-600 dark:text-zinc-400">
              {{ item.name }}
            </div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>
