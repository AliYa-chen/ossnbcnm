<script setup>
import { ref, computed, onMounted } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import GithubStarButton from '@/components/GithubStarButton.vue'

const uploadSessionId = uuidv4()


const BASE_URL = window.location.origin

const files = ref([]) // 多文件

const MAX_SIZE_MB = 25

const uploading = ref(false)
const buildWaiting = ref(false)

// 预览图片
const previewImage = ref(null)

// GitHub Star 数
const stars = ref('—')

onMounted(async () => {
  try {
    const res = await fetch('/api/getstar')
    const data = await res.json()
    stars.value = data.stars
  } catch (e) {
    stars.value = '—'
  }
})

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

// 分组资源
const resources = computed(() => {
  const res = { image: [], video: [], audio: [], font: [] }

  Object.entries(modules).forEach(([path, url]) => {
    // /public/assets/xxx → assets/xxx
    const name = path.replace('/public/assets/', '')
    const type = getType(name)
    if (!type) return

    res[type].push({
      name,
      url,
      fullUrl: BASE_URL + url
    })
  })

  return res
})
// 复制链接到剪贴板
async function copyLink(url) {
  await navigator.clipboard.writeText(url)
  showToast('✅ 已复制资源链接')
}
// 轮询构建状态
async function pollBuildStatus() {
  buildWaiting.value = true
  uploading.value = false
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/getstatus', {
          method: 'POST'
        })
        const data = await res.json()

        if (data.usedInProd) {
          clearInterval(timer)
          resolve(true)
        }
      } catch (err) {
        console.error('轮询失败', err)
      }
    }, 2000) // 每 2 秒轮询一次
  })
}
// 上传文件
async function upload() {
  uploading.value = true

  for (const f of files.value) {
    await uploadSingleFile(f)
  }

  // ⭐ 关键：告诉后端「可以 commit 了」
  await fetch('/api/filepush?commit=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: uploadSessionId }),
  })

  await pollBuildStatus()
  location.reload()
}

// 处理文件选择
function handleFiles(fileList) {
  const incoming = Array.from(fileList)

  for (const f of incoming) {
    if (f.size / 1024 / 1024 > MAX_SIZE_MB) {
      alert(`文件 ${f.name} 超过 ${MAX_SIZE_MB}MB`)
      return
    }
  }

  // 已有文件
  const existing = files.value

  // 用 name + size 去重（最稳）
  const map = new Map()

  for (const f of existing) {
    map.set(`${f.name}_${f.size}`, f)
  }

  for (const f of incoming) {
    map.set(`${f.name}_${f.size}`, f)
  }

  files.value = Array.from(map.values())
}
// 移除文件
function removeFile(index) {
  files.value.splice(index, 1)
}

// 上传单个文件（分片上传）
async function uploadSingleFile(file) {
  const MAX_BODY_SIZE = 3 * 1024 * 1024
  const totalChunks = Math.ceil(file.size / MAX_BODY_SIZE)
  const fileId = getFileId(file)

  for (let i = 0; i < totalChunks; i++) {
    const blob = file.slice(
      i * MAX_BODY_SIZE,
      Math.min(file.size, (i + 1) * MAX_BODY_SIZE)
    )

    const formData = new FormData()
    formData.append('sessionId', uploadSessionId)
    formData.append('fileId', fileId)
    formData.append('fileName', file.name)
    formData.append('file', blob)
    formData.append('index', i)
    formData.append('total', totalChunks)

    const res = await fetch('/api/filepush', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      throw new Error(`上传失败：${file.name} 第 ${i + 1} 片`)
    }
  }
}


// 给每个文件生成稳定 fileId
function getFileId(file) {
  return `${file.name}_${file.size}_${file.lastModified}`
}

// Toast 提示
const toast = ref({
  show: false,
  text: '',
})

let toastTimer = null

function showToast(text, duration = 2000) {
  toast.value.text = text
  toast.value.show = true

  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value.show = false
  }, duration)
}


</script>

<template>
  <div class="min-h-screen bg-zinc-50 dark:bg-zinc-900
              text-zinc-900 dark:text-zinc-100 p-6">

    <h1 class="mb-8 text-2xl font-bold">📦 Public Assets 资源浏览
      <GithubStarButton repo-url="https://github.com/AliYa-chen/EdgeOnePagesCOS" :stars="stars" />
    </h1>
    <!-- 文件上传区域 -->
    <section class="mb-10 pt-7">
      <div class="mx-auto max-w-xl
           rounded-2xl
           border border-zinc-200 dark:border-zinc-700
           bg-white dark:bg-zinc-900
           p-6
           shadow-sm">

        <!-- 拖拽上传区域 -->
        <label for="file-upload" class="flex flex-col items-center justify-center
             w-full
             rounded-xl
             border-2 border-dashed
             border-zinc-300 dark:border-zinc-600
             p-8
             cursor-pointer
             transition
             hover:border-indigo-500
             hover:bg-indigo-50
             dark:hover:bg-zinc-800" @dragover.prevent @drop.prevent="e => handleFiles(e.dataTransfer.files)">

          <svg class="mb-4 h-10 w-10 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor"
            stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4h10v12m-5-5v8" />
          </svg>

          <p class="text-sm text-zinc-600 dark:text-zinc-400">
            点击或拖拽文件到此处上传
          </p>
          <p class="pt-1 text-xs text-zinc-400 dark:text-zinc-500">
            支持图片 / 视频 / 音频 / 字体，最大 25MB
          </p>

          <input id="file-upload" type="file" multiple class="hidden" @change="e => handleFiles(e.target.files)" />
        </label>

        <!-- 操作区 -->
        <div class="flex items-center justify-between pt-5">
          <span class="text-xs text-zinc-500 dark:text-zinc-400">
            已选择 {{ files.length }} 个文件
          </span>

          <button @click="upload" :disabled="!files.length || uploading" class="inline-flex items-center
               rounded-md
               px-3 py-1.5
               text-sm font-medium
               text-indigo-600
               border border-indigo-300
               hover:bg-indigo-50
               disabled:opacity-40
               disabled:cursor-not-allowed
               transition">
            上传文件
          </button>
        </div>

        <!-- 已选择文件列表 -->
        <div v-if="files.length" class="pt-2 space-y-2">
          <div v-for="(f, index) in files" :key="f.name + f.size" style="margin-bottom: 10px;" class="flex items-center justify-between
               rounded-lg
               border border-zinc-200 dark:border-zinc-700
               bg-zinc-50 dark:bg-zinc-800
               px-3 py-2
               text-sm">

            <div class="min-w-0">
              <p class="truncate font-medium">
                {{ f.name }}
              </p>
              <p class="text-xs text-zinc-500">
                {{ (f.size / 1024 / 1024).toFixed(2) }} MB
              </p>
            </div>

            <button @click="removeFile(index)" class="ml-3
                 rounded-md
                 px-2 py-1
                 text-xs
                 text-red-600
                 hover:bg-red-50
                 dark:hover:bg-red-900/20
                 transition">
              ✕
            </button>
          </div>
        </div>

      </div>
    </section>



    <!-- 图片 -->
    <section v-if="resources.image.length" class="mb-10 pt-7">
      <h2 class="mb-4 text-xl font-semibold pb-3">🖼 图片</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div v-for="item in resources.image" :key="item.name" @click="copyLink(item.fullUrl)" class="cursor-pointer rounded-xl border border-zinc-200 dark:border-zinc-700
                 bg-white dark:bg-zinc-800 p-3 transition hover:shadow-lg">
          <img :src="item.url" @click.stop="previewImage = item.fullUrl" class="h-36 w-full object-contain rounded-md
                   bg-zinc-100 dark:bg-zinc-700" />
          <div class="pt-2 truncate text-xs text-zinc-600 dark:text-zinc-400">
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
          <div class="pt-2 truncate text-xs text-zinc-600 dark:text-zinc-400">
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
  <footer class="border-t border-zinc-200 dark:border-zinc-700
         py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
    本站由
    <a href="https://edgeone.ai/zh?from=oss.nbcnm.cn" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300
           hover:text-indigo-600 dark:hover:text-indigo-400 transition">
      <img src="https://edgeone.ai/favicon.ico" alt="Tencent EdgeOne" width="15" height="15"
        class="inline-block align-middle" />
      Tencent EdgeOne
    </a>
    提供 CDN 服务
  </footer>


  <!-- 全屏上传 Loading -->
  <div v-if="uploading || buildWaiting" class="fixed inset-0 z-50 flex items-center justify-center
         bg-black/60 backdrop-blur-sm">
    <div class="flex flex-col items-center gap-4 rounded-2xl
           bg-white dark:bg-zinc-900
           px-8 py-6 shadow-xl">
      <!-- Spinner -->
      <svg class="h-10 w-10 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>

      <div class="text-center">
        <p class="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {{ uploading ? '正在上传文件…' : buildWaiting ? '文件已上传' : '文件已上传' }}
        </p>
        <p class="pt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {{ uploading ? '请勿关闭页面' : buildWaiting ? '正在重新编译资源，请等待约 20 秒' : '' }}
        </p>

      </div>
    </div>
  </div>

  <!-- Toast 提示 -->
  <div v-if="toast.show" class="fixed bottom-6 right-6 z-50
         rounded-xl bg-zinc-900 text-white
         px-4 py-2 text-sm shadow-lg
         animate-fade-in">
    {{ toast.text }}
  </div>

  <!-- 图片全屏预览 -->
  <div v-if="previewImage" class="fixed inset-0 z-50
         bg-black/80 backdrop-blur-sm
         flex items-center justify-center" @click.self="previewImage = null">
    <img :src="previewImage" class="max-w-[90vw] max-h-[90vh]
           rounded-lg shadow-2xl" />

    <!-- 关闭按钮 -->
    <button class="absolute top-6 right-6
           text-white text-2xl
           hover:scale-110 transition" @click="previewImage = null">
      ✕
    </button>
  </div>


</template>
