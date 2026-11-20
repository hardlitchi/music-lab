<script setup lang="ts">
import {
  IconChevronLeft, IconChevronRight, IconHeadphones, IconPlus,
  IconSliders, IconTrash, IconVolume,
} from '@/components/icons'
import { SOUND_PRESETS, trackColor } from '@/studio/constants'
import { useStudio } from '@/studio/useStudio'

const {
  layout,
  tracks,
  selectedTrackId,
  selectTrack,
  deleteTrack,
  handlePresetChange,
  handleVolumeChange,
  toggleMute,
  toggleSolo,
  auditionTrack,
  openAddTrackModal,
} = useStudio()
</script>

<template>
  <aside v-if="layout.mixerCollapsed" class="st-rail st-panel">
    <button class="st-icon-btn" title="ミキサーを開く" @click="layout.mixerCollapsed = false">
      <IconChevronRight :size="16" />
    </button>
    <span class="st-rail-label">MIXER</span>
    <div class="st-rail-dots">
      <button
        v-for="(track, index) in tracks"
        :key="track.id"
        class="st-rail-dot"
        :style="{ background: trackColor(index) }"
        :class="{ 'is-muted': track.isMuted }"
        :title="track.name"
        @click="selectTrack(track.id)"
      />
    </div>
  </aside>

  <aside v-else class="st-mixer st-panel">
    <div class="st-panel-head">
      <IconSliders :size="15" style="color: #ff6b9d" />
      <span class="st-panel-title">Mixer</span>
      <span class="st-chip mono">{{ tracks.length }}</span>
      <div class="st-head-actions">
        <button class="st-icon-btn" title="トラックを追加" @click="openAddTrackModal">
          <IconPlus :size="16" />
        </button>
        <button class="st-icon-btn" title="折りたたむ" @click="layout.mixerCollapsed = true">
          <IconChevronLeft :size="16" />
        </button>
      </div>
    </div>

    <div class="st-mixer-body">
      <div
        v-for="(track, index) in tracks"
        :key="track.id"
        class="st-strip"
        :class="{ 'is-active': selectedTrackId === track.id }"
        :style="{ '--tc': trackColor(index) }"
        @click="selectTrack(track.id)"
      >
        <div class="st-strip-head">
          <span class="st-strip-num mono">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="st-strip-name">{{ track.name }}</span>
          <button
            class="st-icon-btn st-strip-del"
            title="トラックを削除"
            @click.stop="deleteTrack(track)"
          >
            <IconTrash :size="13" />
          </button>
        </div>

        <div class="st-strip-sound">
          <span class="st-strip-type mono">{{ track.type.toUpperCase() }}</span>
          <select
            v-if="track.type !== 'drum'"
            v-model="track.soundPreset"
            class="st-select"
            @click.stop
            @change="handlePresetChange()"
          >
            <option v-for="preset in SOUND_PRESETS" :key="preset.value" :value="preset.value">
              {{ preset.label }}
            </option>
          </select>
          <span v-else class="st-strip-kit">80s Analog Kit</span>
        </div>

        <div class="st-strip-fader">
          <IconVolume :size="14" class="st-vol-icon" />
          <input
            v-model.number="track.volume"
            class="range"
            type="range"
            min="0"
            max="1"
            step="0.01"
            @click.stop
            @input="handleVolumeChange(track)"
          />
          <span class="st-strip-vol mono">{{ Math.round(track.volume * 100) }}</span>
        </div>

        <div class="st-strip-actions">
          <button
            :class="['st-ms', 'st-ms-mute', { 'is-on': track.isMuted }]"
            title="ミュート"
            @click.stop="toggleMute(track)"
          >M</button>
          <button
            :class="['st-ms', 'st-ms-solo', { 'is-on': track.isSolo }]"
            title="ソロ"
            @click.stop="toggleSolo(track)"
          >S</button>
          <button class="st-ms st-ms-aud" title="試聴" @click.stop="auditionTrack(track)">
            <IconHeadphones :size="12" /> 試聴
          </button>
        </div>
      </div>

      <button class="st-strip-add" @click="openAddTrackModal">
        <IconPlus :size="15" /> トラックを追加
      </button>
    </div>
  </aside>
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
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--bg2);
}
.st-panel-title { font-weight: 600; font-size: 13px; }
.st-chip {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 99px;
  background: var(--surface2);
  color: var(--ink2);
}
.st-head-actions { display: flex; gap: 4px; margin-left: auto; }
.st-icon-btn {
  width: 26px; height: 26px; border-radius: 7px;
  display: grid; place-items: center; color: var(--muted);
  transition: .14s;
}
.st-icon-btn:hover { background: var(--surface2); color: var(--ink); }

.st-mixer-body {
  display: flex; flex-direction: column; gap: 8px;
  padding: 10px; overflow-y: auto; flex: 1;
}
.st-strip {
  --tc: #ff6b9d;
  display: flex; flex-direction: column; gap: 7px;
  padding: 10px; border-radius: var(--r-sm);
  background: var(--bg2); border: 1px solid var(--line);
  cursor: pointer; transition: .15s;
}
.st-strip:hover { background: var(--surface2); }
.st-strip.is-active {
  border-color: var(--tc);
  background: color-mix(in srgb, var(--tc) 10%, var(--bg2));
}
.st-strip-head { display: flex; align-items: center; gap: 7px; }
.st-strip-num {
  width: 22px; height: 22px; border-radius: 6px;
  display: grid; place-items: center; flex-shrink: 0;
  background: var(--tc); color: #121218; font-size: 11px; font-weight: 700;
}
.st-strip-name {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 13px; font-weight: 600;
}
.st-strip-del { opacity: 0; width: 22px; height: 22px; }
.st-strip:hover .st-strip-del { opacity: 1; }
.st-strip-del:hover { color: #ff6b7a; }

.st-strip-sound { display: flex; align-items: center; gap: 6px; }
.st-strip-type {
  font-size: 10px; padding: 2px 6px; border-radius: 5px;
  background: var(--surface2); color: var(--muted); font-weight: 600;
}
.st-select {
  flex: 1; min-width: 0; font-size: 12px;
  background: var(--surface); color: var(--ink);
  border: 1px solid var(--line); border-radius: 6px; padding: 3px 6px;
}
.st-strip-kit { font-size: 11.5px; color: var(--muted); }

.st-strip-fader { display: flex; align-items: center; gap: 6px; }
.st-vol-icon { color: var(--muted); flex-shrink: 0; }
.st-strip-fader .range { flex: 1; accent-color: var(--tc); }
.st-strip-vol { font-size: 11px; color: var(--ink2); width: 24px; text-align: right; }

.st-strip-actions { display: flex; gap: 5px; }
.st-ms {
  height: 24px; border-radius: 6px; background: var(--surface);
  border: 1px solid var(--line); color: var(--muted);
  font-size: 11px; font-weight: 700; display: grid; place-items: center;
  transition: .14s;
}
.st-ms-mute, .st-ms-solo { width: 28px; }
.st-ms-aud {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;
  font-weight: 500;
}
.st-ms:hover { background: var(--surface2); color: var(--ink); }
.st-ms-mute.is-on { background: #ff5f76; color: #fff; border-color: #ff5f76; }
.st-ms-solo.is-on { background: #ffe066; color: #2b2304; border-color: #ffe066; }

.st-strip-add {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 10px; border-radius: var(--r-sm);
  border: 1px dashed var(--line2); color: var(--muted);
  font-size: 12.5px; font-weight: 500; transition: .15s;
}
.st-strip-add:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }

.st-rail { align-items: center; padding: 10px 0; gap: 12px; }
.st-rail-label {
  font-size: 10px; font-weight: 700; letter-spacing: .16em; color: var(--muted);
  writing-mode: vertical-rl;
}
.st-rail-dots { display: flex; flex-direction: column; gap: 7px; }
.st-rail-dot { width: 14px; height: 14px; border-radius: 50%; transition: .15s; }
.st-rail-dot:hover { transform: scale(1.2); }
.st-rail-dot.is-muted { opacity: .3; }
</style>
