<script setup lang="ts">
import { computed } from 'vue'
import {
  IconArrowRight, IconGrid, IconLayers, IconPause, IconPencil,
  IconPlay, IconPlus, IconRepeat, IconSquare,
} from '@/components/icons'
import { END_BEHAVIORS, trackColor } from '@/studio/constants'
import { useStudio } from '@/studio/useStudio'
import type { StudioScene } from '@/types'

const {
  currentProject,
  tracks,
  scenes,
  selectedTrackId,
  editingSceneId,
  activeSceneId,
  currentSceneCycle,
  isPlaying,
  playingLoopIds,
  selectTrack,
  addNewScene,
  getSlotLoopId,
  setSlotLoop,
  selectSlot,
  triggerScene,
  triggerSingleClip,
  editLoop,
  createNewLoop,
  togglePlay,
} = useStudio()

const gridVars = computed(() => ({
  '--cols': `13rem repeat(${Math.max(tracks.value.length, 1)}, minmax(9.5rem, 1fr))`,
  '--min-w': `calc(13rem + ${Math.max(tracks.value.length, 1)} * 9.5rem)`,
}))

const isLive = (sceneId: string) => activeSceneId.value === sceneId && isPlaying.value

const isClipPlaying = (scene: StudioScene, trackId: string, loopId: string) =>
  !!loopId &&
  isPlaying.value &&
  playingLoopIds[trackId] === loopId &&
  (activeSceneId.value === null || activeSceneId.value === scene.id)

const onSceneClick = (scene: StudioScene) => {
  if (isLive(scene.id)) {
    void togglePlay()
    return
  }
  triggerScene(scene)
}
</script>

<template>
  <section class="st-matrix st-panel">
    <div class="st-panel-head">
      <IconGrid :size="15" style="color: #a78bfa" />
      <span class="st-panel-title">Loop Matrix</span>
      <span class="st-chip mono">シーン {{ scenes.length }}</span>
      <button class="btn btn-outline btn-sm" style="margin-left: auto" @click="addNewScene">
        <IconPlus :size="13" /> シーンを追加
      </button>
    </div>

    <div v-if="currentProject" class="st-matrix-scroll">
      <div class="st-matrix-inner" :style="gridVars">
        <!-- ヘッダー行 -->
        <div class="st-row st-row-head">
          <div class="st-corner mono">
            <IconLayers :size="13" /> SCENES
          </div>
          <button
            v-for="(track, index) in tracks"
            :key="track.id"
            class="st-col-head"
            :class="{ 'is-active': selectedTrackId === track.id }"
            :style="{ '--tc': trackColor(index) }"
            @click="selectTrack(track.id)"
          >
            <span class="st-col-dot" />
            <span class="st-col-name">{{ track.name }}</span>
            <span class="st-col-type mono">{{ track.type.toUpperCase() }}</span>
          </button>
        </div>

        <!-- シーン行 -->
        <div
          v-for="scene in scenes"
          :key="scene.id"
          class="st-row"
          :class="{ 'is-live': activeSceneId === scene.id }"
        >
          <div class="st-scene">
            <div class="st-scene-top">
              <button
                class="st-scene-play"
                :class="{ 'is-on': isLive(scene.id) }"
                :title="isLive(scene.id) ? '一時停止' : 'シーンを再生'"
                @click="onSceneClick(scene)"
              >
                <IconPause v-if="isLive(scene.id)" :size="12" />
                <IconPlay v-else :size="12" />
              </button>
              <span class="st-scene-name">{{ scene.name }}</span>
              <span v-if="isLive(scene.id) && scene.endBehavior !== 'loop'" class="st-scene-cycle mono">
                {{ currentSceneCycle }}/{{ scene.loopCount }}
              </span>
            </div>

            <div class="st-scene-bottom">
              <div class="st-seg">
                <button
                  v-for="opt in END_BEHAVIORS"
                  :key="opt.value"
                  type="button"
                  :class="{ 'is-on': (scene.endBehavior || 'loop') === opt.value }"
                  :title="opt.hint"
                  @click="scene.endBehavior = opt.value"
                >
                  <IconRepeat v-if="opt.value === 'loop'" :size="11" />
                  <IconArrowRight v-else-if="opt.value === 'next'" :size="11" />
                  <IconSquare v-else :size="10" />
                </button>
              </div>
              <label v-if="scene.endBehavior !== 'loop'" class="st-scene-count mono">
                ×<input v-model.number="scene.loopCount" type="number" min="1" max="64" />
              </label>
              <span v-else class="st-scene-lbl">リピート</span>
            </div>
          </div>

          <!-- クリップセル -->
          <div
            v-for="(track, index) in tracks"
            :key="track.id"
            class="st-slot"
            :class="{
              'is-filled': !!getSlotLoopId(scene, track.id),
              'is-live': isClipPlaying(scene, track.id, getSlotLoopId(scene, track.id)),
              'is-editing': editingSceneId === scene.id && selectedTrackId === track.id,
            }"
            :style="{ '--tc': trackColor(index) }"
            @click="selectSlot(scene, track.id)"
          >
            <select
              class="st-slot-select"
              :value="getSlotLoopId(scene, track.id)"
              @click.stop
              @change="setSlotLoop(scene, track.id, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">— 空 —</option>
              <option v-for="loop in track.loops" :key="loop.id" :value="loop.id">
                {{ loop.name }}
              </option>
            </select>

            <div v-if="getSlotLoopId(scene, track.id)" class="st-slot-actions">
              <button
                class="st-slot-play mono"
                @click.stop="triggerSingleClip(track.id, getSlotLoopId(scene, track.id))"
              >
                <span class="st-slot-pulse" />
                {{ isClipPlaying(scene, track.id, getSlotLoopId(scene, track.id)) ? 'PLAYING' : 'PLAY' }}
              </button>
              <button
                class="st-slot-edit"
                title="シーケンサーで編集"
                @click.stop="editLoop(track.id, getSlotLoopId(scene, track.id), scene.id)"
              >
                <IconPencil :size="12" />
              </button>
            </div>

            <button v-else class="st-slot-create" @click.stop="createNewLoop(track, scene)">
              <IconPlus :size="12" /> ループ作成
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.st-panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.st-panel-head {
  display: flex; align-items: center; gap: 7px;
  padding: 10px 12px; border-bottom: 1px solid var(--line); background: var(--bg2);
}
.st-panel-title { font-weight: 600; font-size: 13px; }
.st-chip {
  font-size: 11px; padding: 1px 7px; border-radius: 99px;
  background: var(--surface2); color: var(--ink2);
}
.st-matrix-scroll { flex: 1; min-height: 0; overflow: auto; padding: 10px; }
.st-matrix-inner { display: flex; flex-direction: column; gap: 6px; min-width: var(--min-w); }
.st-row {
  display: grid; grid-template-columns: var(--cols); gap: 6px;
  border-radius: var(--r-sm); padding: 2px;
}
.st-row-head { position: sticky; top: 0; z-index: 2; background: var(--surface); padding-bottom: 4px; }
.st-row.is-live { box-shadow: inset 0 0 0 1px rgba(255, 224, 102, 0.4); background: rgba(255, 224, 102, 0.03); }

.st-corner {
  display: flex; align-items: center; gap: 5px; padding: 6px 8px;
  font-size: 11px; color: var(--muted); font-weight: 600;
}
.st-col-head {
  --tc: #ff6b9d;
  display: flex; align-items: center; gap: 6px;
  padding: 6px 9px; border-radius: 8px;
  background: var(--bg2); border: 1px solid var(--line); text-align: left;
  transition: .14s;
}
.st-col-head:hover { background: var(--surface2); }
.st-col-head.is-active { border-color: var(--tc); }
.st-col-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tc); flex-shrink: 0; }
.st-col-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; }
.st-col-type { font-size: 10px; color: var(--muted); }

.st-scene {
  display: flex; flex-direction: column; gap: 6px;
  padding: 8px; border-radius: 8px; background: var(--bg2); border: 1px solid var(--line);
}
.st-scene-top { display: flex; align-items: center; gap: 6px; }
.st-scene-play {
  width: 24px; height: 24px; border-radius: 50%;
  display: grid; place-items: center; background: var(--surface2); color: var(--ink);
  flex-shrink: 0; transition: .14s;
}
.st-scene-play:hover, .st-scene-play.is-on { background: var(--accent); color: #1a1206; }
.st-scene-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; font-weight: 600; }
.st-scene-cycle { font-size: 10.5px; padding: 1px 6px; border-radius: 99px; background: var(--accent); color: #1a1206; font-weight: 700; }

.st-scene-bottom { display: flex; align-items: center; gap: 6px; }
.st-seg { display: flex; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
.st-seg button { padding: 3px 6px; color: var(--muted); display: grid; place-items: center; }
.st-seg button.is-on { background: #a78bfa; color: #160d30; }
.st-scene-lbl { font-size: 11px; color: var(--muted); }
.st-scene-count { display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--muted); }
.st-scene-count input {
  width: 36px; text-align: center; background: var(--surface); border: 1px solid var(--line);
  border-radius: 5px; color: var(--ink); font-size: 11px; padding: 1px 3px;
}

.st-slot {
  --tc: #ff6b9d;
  display: flex; flex-direction: column; gap: 5px;
  padding: 7px; border-radius: 8px;
  background: rgba(255, 255, 255, 0.02); border: 1px solid var(--line);
  cursor: pointer; transition: .14s;
}
.st-slot:hover { background: var(--surface2); }
.st-slot.is-filled { background: color-mix(in srgb, var(--tc) 12%, var(--bg2)); }
.st-slot.is-live { background: color-mix(in srgb, var(--tc) 42%, var(--bg2)); border-color: var(--tc); }
.st-slot.is-editing { box-shadow: 0 0 0 1.5px var(--ink); }

.st-slot-select {
  width: 100%; background: rgba(0, 0, 0, 0.25); color: var(--ink);
  border: 1px solid var(--line); border-radius: 6px;
  font-size: 11.5px; font-weight: 600; padding: 3px 5px;
}
.st-slot-actions { display: flex; gap: 4px; }
.st-slot-play {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 3px 5px; border-radius: 5px;
  background: rgba(0, 0, 0, 0.25); color: var(--ink2); font-size: 10px; font-weight: 700;
}
.st-slot-play:hover { background: rgba(0, 0, 0, 0.45); color: var(--ink); }
.st-slot-pulse { width: 6px; height: 6px; border-radius: 50%; background: var(--tc); }
.st-slot.is-live .st-slot-pulse { background: #fff; animation: st-pulse .9s infinite; }
@keyframes st-pulse { 50% { opacity: .25; transform: scale(.75); } }

.st-slot-edit {
  width: 24px; display: grid; place-items: center; border-radius: 5px;
  background: rgba(0, 0, 0, 0.25); color: var(--ink2);
}
.st-slot-edit:hover { background: rgba(0, 0, 0, 0.45); color: var(--ink); }

.st-slot-create {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 5px; border-radius: 6px; border: 1px dashed var(--line2);
  color: var(--muted); font-size: 11px;
}
.st-slot-create:hover { color: var(--tc); border-color: var(--tc); }
</style>
