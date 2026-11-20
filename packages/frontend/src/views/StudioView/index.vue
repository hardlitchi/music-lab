<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  IconDownload, IconLibrary, IconMinus, IconMusic, IconPause,
  IconPlay, IconPlus, IconSave, IconSpark, IconSquare,
} from '@/components/icons'
import { BPM_MAX, BPM_MIN, SOUND_PRESETS } from '@/studio/constants'
import { useStudio } from '@/studio/useStudio'
import StudioMatrix from './StudioMatrix.vue'
import StudioMixer from './StudioMixer.vue'
import StudioSequencer from './StudioSequencer.vue'

const {
  projects,
  currentProject,
  selectedProjectId,
  saveLoading,
  exportLoading,
  isPlaying,
  currentStep,
  currentBpm,
  midiDeviceCount,
  layout,
  addTrackModalOpen,
  addTrackForm,
  init,
  loadProjectById,
  createProject,
  saveProject,
  togglePlay,
  stopPlay,
  updateBpm,
  nudgeBpm,
  handleAddTrack,
  exportMidi,
  exportWav,
  saveMixToLibrary,
  sendToAiGenerator,
} = useStudio()

const activeBeat = computed(() =>
  currentStep.value < 0 ? -1 : Math.floor(currentStep.value / 4)
)

const newProjModal = ref(false)
const newProjName = ref('')

function openNewProjectModal() {
  newProjName.value = `New Beat ${projects.value.length + 1}`
  newProjModal.value = true
}

async function confirmCreateProject() {
  if (!newProjName.value.trim()) return
  await createProject(newProjName.value, 120)
  newProjModal.value = false
}

function onKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag && /^(INPUT|SELECT|TEXTAREA)$/.test(tag)) return
  if (e.code === 'Space') {
    e.preventDefault()
    void togglePlay()
  }
}

onMounted(() => {
  void init()
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="view studio-view">
    <!-- ヘッダー＆トランスポートバー -->
    <header class="st-topbar">
      <div class="st-group">
        <div class="st-title">
          <IconMusic :size="18" style="color: #4ecdc4" />
          <span>MIDI Studio</span>
        </div>

        <select
          v-model="selectedProjectId"
          class="st-proj-select"
          @change="loadProjectById(selectedProjectId)"
        >
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>

        <button class="btn btn-outline btn-sm" title="新規プロジェクト" @click="openNewProjectModal">
          <IconPlus :size="13" /> 新規
        </button>

        <span v-if="midiDeviceCount > 0" class="st-midi-badge mono" title="Web MIDI デバイス接続中">
          MIDI ×{{ midiDeviceCount }}
        </span>
      </div>

      <!-- トランスポート -->
      <div class="st-transport">
        <button
          :class="['st-play', { 'is-on': isPlaying }]"
          title="再生 / 一時停止 (Space)"
          @click="togglePlay"
        >
          <IconPause v-if="isPlaying" :size="16" />
          <IconPlay v-else :size="16" />
        </button>
        <button class="st-stop" title="停止" @click="stopPlay">
          <IconSquare :size="12" />
        </button>

        <div class="st-beats">
          <span
            v-for="b in 4"
            :key="b"
            :class="['st-beat-dot', { 'is-on': activeBeat === b - 1 }]"
          />
        </div>

        <div class="st-bpm">
          <span class="st-bpm-lbl mono">BPM</span>
          <button class="st-bpm-btn" @click="nudgeBpm(-1)"><IconMinus :size="11" /></button>
          <input
            v-model.number="currentBpm"
            class="st-bpm-val mono"
            type="number"
            :min="BPM_MIN"
            :max="BPM_MAX"
            @change="updateBpm"
          />
          <button class="st-bpm-btn" @click="nudgeBpm(1)"><IconPlus :size="11" /></button>
        </div>
      </div>

      <!-- 保存＆統合アクション -->
      <div class="st-group st-actions">
        <button class="btn btn-outline btn-sm" :disabled="!currentProject" @click="exportMidi" title="標準 MIDI (.mid) をダウンロード">
          <IconDownload :size="13" /> .MID
        </button>
        <button class="btn btn-outline btn-sm" :disabled="!currentProject || exportLoading" @click="exportWav" title="ステレオ WAV をレンダリングしてダウンロード">
          <IconDownload :size="13" /> .WAV
        </button>
        <button
          class="btn btn-outline btn-sm"
          :disabled="!currentProject || exportLoading"
          title="ミックスをWAVとしてライブラリに保存"
          @click="saveMixToLibrary"
        >
          <IconLibrary :size="13" /> {{ exportLoading ? '書出中...' : 'ライブラリへ保存' }}
        </button>
        <button
          class="btn btn-accent btn-sm"
          :disabled="!currentProject"
          title="この構成を AI 工房に引き継いで生成"
          @click="sendToAiGenerator"
        >
          <IconSpark :size="13" /> AI工房でアレンジ
        </button>
        <button
          class="btn btn-outline btn-sm"
          :disabled="saveLoading || !currentProject"
          @click="saveProject"
        >
          <IconSave :size="13" /> {{ saveLoading ? '保存中' : '保存' }}
        </button>
      </div>
    </header>

    <!-- メインワークスペース -->
    <div class="st-stage" :class="{ 'is-rail': layout.mixerCollapsed }">
      <StudioMixer />
      <StudioMatrix />
    </div>

    <!-- 下部シーケンサードック -->
    <div class="st-dock">
      <StudioSequencer />
    </div>

    <!-- トラック追加モーダル -->
    <div v-if="addTrackModalOpen" class="st-modal-backdrop" @click.self="addTrackModalOpen = false">
      <div class="st-modal">
        <h3>新しいトラックを追加</h3>
        <label class="st-field">
          <span>トラック名</span>
          <input v-model="addTrackForm.name" class="input" placeholder="例: Acid Bass" />
        </label>
        <label class="st-field">
          <span>タイプ</span>
          <select v-model="addTrackForm.type" class="input">
            <option value="synth">Synth (ポリフォニック)</option>
            <option value="bass">Bass</option>
            <option value="lead">Lead</option>
            <option value="drum">Drum Kit (8パート)</option>
          </select>
        </label>
        <label v-if="addTrackForm.type !== 'drum'" class="st-field">
          <span>サウンドプリセット</span>
          <select v-model="addTrackForm.preset" class="input">
            <option v-for="p in SOUND_PRESETS" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </label>
        <div class="st-modal-foot">
          <button class="btn btn-ghost btn-sm" @click="addTrackModalOpen = false">キャンセル</button>
          <button class="btn btn-accent btn-md" @click="handleAddTrack">追加する</button>
        </div>
      </div>
    </div>

    <!-- 新規プロジェクトモーダル -->
    <div v-if="newProjModal" class="st-modal-backdrop" @click.self="newProjModal = false">
      <div class="st-modal">
        <h3>新しいスタジオプロジェクト</h3>
        <label class="st-field">
          <span>プロジェクト名</span>
          <input v-model="newProjName" class="input" @keyup.enter="confirmCreateProject" />
        </label>
        <div class="st-modal-foot">
          <button class="btn btn-ghost btn-sm" @click="newProjModal = false">キャンセル</button>
          <button class="btn btn-accent btn-md" @click="confirmCreateProject">作成</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.studio-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 56px);
  max-width: 1520px;
}

.st-topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r);
}
.st-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.st-title { display: flex; align-items: center; gap: 7px; font-weight: 700; font-size: 14.5px; }
.st-proj-select {
  background: var(--bg2); color: var(--ink);
  border: 1px solid var(--line); border-radius: 8px;
  padding: 5px 10px; font-size: 12.5px; font-weight: 500; max-width: 240px;
}
.st-midi-badge {
  font-size: 10.5px; padding: 2px 7px; border-radius: 99px;
  background: rgba(78, 205, 196, 0.16); color: #4ecdc4;
  border: 1px solid rgba(78, 205, 196, 0.4);
}

.st-transport {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 10px; border-radius: 99px;
  background: var(--bg2); border: 1px solid var(--line);
}
.st-play {
  width: 30px; height: 30px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--surface2); color: var(--ink); transition: .15s;
}
.st-play:hover, .st-play.is-on { background: #4ecdc4; color: #072220; }
.st-stop {
  width: 26px; height: 26px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--surface); color: var(--muted);
}
.st-stop:hover { color: var(--ink); background: var(--surface2); }

.st-beats { display: flex; gap: 4px; padding: 0 4px; }
.st-beat-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--line2); transition: .08s; }
.st-beat-dot.is-on { background: #ffe066; box-shadow: 0 0 8px #ffe066; }

.st-bpm { display: flex; align-items: center; gap: 4px; padding-left: 6px; border-left: 1px solid var(--line); }
.st-bpm-lbl { font-size: 10px; color: var(--muted); }
.st-bpm-btn {
  width: 20px; height: 20px; border-radius: 5px;
  display: grid; place-items: center; background: var(--surface); color: var(--ink2);
}
.st-bpm-btn:hover { background: var(--surface2); color: var(--ink); }
.st-bpm-val {
  width: 44px; text-align: center; background: var(--surface);
  border: 1px solid var(--line); border-radius: 6px; font-size: 12px; padding: 2px;
}

.st-stage {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 17rem minmax(0, 1fr);
  gap: 12px;
}
.st-stage.is-rail { grid-template-columns: 3.25rem minmax(0, 1fr); }
.st-dock { min-height: 0; }

.st-modal-backdrop {
  position: fixed; inset: 0; z-index: 900;
  background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px);
  display: grid; place-items: center;
}
.st-modal {
  width: min(400px, 92vw);
  background: var(--surface); border: 1px solid var(--line2); border-radius: var(--r);
  padding: 20px; display: flex; flex-direction: column; gap: 14px;
}
.st-modal h3 { font-size: 16px; }
.st-field { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: var(--ink2); }
.st-field .input {
  background: var(--bg2); border: 1px solid var(--line2); border-radius: 8px;
  padding: 8px 10px; color: var(--ink); font-size: 13px;
}
.st-modal-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }

@media (max-width: 960px) {
  .studio-view { height: auto; min-height: calc(100vh - 56px); }
  .st-stage { grid-template-columns: 1fr; }
}
</style>
