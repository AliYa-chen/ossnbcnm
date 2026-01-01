<script setup>
defineProps({
  repoUrl: {
    type: String,
    required: true,
  },
  stars: {
    type: [Number, String],
    default: 0,
  },
})
</script>

<template>
  <a :href="repoUrl" target="_blank" rel="noopener noreferrer" title="Star this repo" class="group inline-flex items-center gap-2
           rounded-lg border border-zinc-200 dark:border-zinc-700
           bg-white dark:bg-zinc-800
           px-3 py-2 text-sm font-medium
           transition
           hover:bg-zinc-100 dark:hover:bg-zinc-700">
    <!-- Icon 容器（固定尺寸，防抖动） -->
    <span class="relative h-5 w-5">
      <!-- GitHub Icon -->
      <svg class="absolute inset-0 h-5 w-5
               text-zinc-700 dark:text-zinc-200
               transition
               group-hover:opacity-0 group-hover:scale-75" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017
             c0 4.425 2.865 8.18 6.839 9.504
             .5.092.682-.217.682-.483
             0-.237-.009-.868-.014-1.703
             -2.782.605-3.369-1.343-3.369-1.343
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
             C22 6.484 17.523 2 12 2z" />
      </svg>

      <!-- ⭐ Star Icon -->
      <svg aria-hidden="true" class="absolute inset-0 h-5 w-5
               text-yellow-400
               opacity-0 scale-75
               transition
               group-hover:opacity-100 group-hover:scale-100" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 .25a.75.75 0 0 1 .673.418
             l1.882 3.815 4.21.612
             a.75.75 0 0 1 .416 1.279
             l-3.046 2.97.719 4.192
             a.751.751 0 0 1-1.088.791
             L8 12.347l-3.766 1.98
             a.75.75 0 0 1-1.088-.79
             l.72-4.194L.818 6.374
             a.75.75 0 0 1 .416-1.28
             l4.21-.611L7.327.668
             A.75.75 0 0 1 8 .25Z" />
      </svg>
    </span>

    <!-- 文本容器 -->
    <span class="relative overflow-hidden">
      <!-- GitHub 文本 -->
      <span class="block transition
               group-hover:opacity-0 group-hover:-translate-y-1">
        GitHub
      </span>

      <!-- Star 文本 -->
      <span class="absolute left-0 top-0
               text-yellow-500
               opacity-0 translate-y-2
               transition
               group-hover:opacity-100 group-hover:translate-y-0">
        Star {{ stars }}
      </span>
    </span>
  </a>
</template>
