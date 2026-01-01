<script setup>
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'

const uploadSessionId = uuidv4()


const BASE_URL = window.location.origin

const files = ref([]) // 多文件

const MAX_SIZE_MB = 25

const uploading = ref(false)
const buildWaiting = ref(false)

// 预览图片
const previewImage = ref(null)



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
      <a href="https://github.com/AliYa-chen/EdgeOnePagesCOS" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700
           bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-medium
           hover:bg-zinc-100 dark:hover:bg-zinc-700 transition" title="查看 GitHub 仓库">
        <!-- GitHub Icon -->
        <svg class="h-5 w-5 text-zinc-700 dark:text-zinc-200" viewBox="0 0 24 24" fill="currentColor"
          aria-hidden="true">
          <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483
           0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343
           -.454-1.158-1.11-1.466-1.11-1.466
           -.908-.62.069-.608.069-.608
           1.003.07 1.531 1.032 1.531 1.032
           .892 1.53 2.341 1.088 2.91.832
           .092-.647.35-1.088.636-1.338
           -2.22-.253-4.555-1.113-4.555-4.951
           0-1.093.39-1.988 1.029-2.688
           -.103-.253-.446-1.272.098-2.65
           0 0 .84-.27 2.75 1.026
           .798-.222 1.655-.333 2.505-.337
           .85.004 1.707.115 2.506.337
           1.909-1.296 2.747-1.026 2.747-1.026
           .546 1.378.202 2.397.1 2.65
           .64.7 1.028 1.595 1.028 2.688
           0 3.848-2.338 4.695-4.566 4.943
           .359.309.678.92.678 1.855
           0 1.338-.012 2.419-.012 2.747
           0 .268.18.58.688.482
           A10.019 10.019 0 0022 12.017
           C22 6.484 17.523 2 12 2z" clip-rule="evenodd" />
        </svg>
        GitHub
      </a>
    </h1>
    <div class="mb-8">
      <label for="file-upload" class="flex flex-col items-center justify-center w-full p-6
         border-2 border-dashed rounded-xl cursor-pointer
         border-zinc-300 dark:border-zinc-600
         hover:border-indigo-500 hover:bg-indigo-50
         dark:hover:bg-zinc-800 transition" @dragover.prevent @drop.prevent="e => handleFiles(e.dataTransfer.files)">
        <svg class="w-10 h-10 mb-3 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor" stroke-width="2"
          viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4h10v12m-5-5v8"></path>
        </svg>
        <span class="text-sm text-zinc-600 dark:text-zinc-400 mb-2">点击或拖拽文件到此处上传</span>
        <span class="text-xs text-zinc-400 dark:text-zinc-500">支持图片、视频、音频、字体，最大 25MB</span>
        <input id="file-upload" type="file" multiple class="hidden" @change="e => handleFiles(e.target.files)" />

      </label>

      <button @click="upload" :disabled="!files.length || uploading" class="mt-4 w-full sm:w-auto px-4 py-2 rounded-md
         bg-indigo-600 text-white font-semibold shadow
         hover:bg-indigo-500
         disabled:opacity-50 disabled:cursor-not-allowed
         transition">
        上传文件
      </button>


      <!-- 已选择文件列表 -->
      <div v-if="files.length" class="mt-4 space-y-2">
        <div v-for="(f, index) in files" :key="f.name + f.size" class="flex items-center justify-between
           rounded-lg border border-zinc-200 dark:border-zinc-700
           bg-white dark:bg-zinc-800
           px-3 py-2 text-sm">
          <!-- 文件信息 -->
          <div class="min-w-0">
            <p class="truncate font-medium text-zinc-800 dark:text-zinc-100">
              {{ f.name }}
            </p>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">
              {{ (f.size / 1024 / 1024).toFixed(2) }} MB
            </p>
          </div>

          <!-- 删除按钮 -->
          <button @click="removeFile(index)" class="ml-3 inline-flex items-center justify-center
             rounded-md px-2 py-1
             text-xs font-medium
             text-red-600 dark:text-red-400
             hover:bg-red-50 dark:hover:bg-red-900/20
             transition" title="移除文件">
            ✕
          </button>
        </div>
      </div>


    </div>


    <!-- 图片 -->
    <section v-if="resources.image.length" class="mb-10 pt-7">
      <h2 class="mb-4 text-xl font-semibold pb-3">🖼 图片</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div v-for="item in resources.image" :key="item.name" @click="copyLink(item.fullUrl)" class="cursor-pointer rounded-xl border border-zinc-200 dark:border-zinc-700
                 bg-white dark:bg-zinc-800 p-3 transition hover:shadow-lg">
          <img :src="item.url" @click.stop="previewImage = item.fullUrl" class="h-36 w-full object-contain rounded-md
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
  <footer class="mt-16 border-t border-zinc-200 dark:border-zinc-700
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
        <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
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
