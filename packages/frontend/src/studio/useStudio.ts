import { computed, reactive, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import type {
  StudioLoop,
  StudioProject,
  StudioScene,
  StudioTrack,
  StudioTrackType,
} from '@/types'
import { audioEngine } from './audioEngine'
import {
  BPM_MAX,
  BPM_MIN,
  DEFAULT_STUDIO_PROJECTS,
  DRUM_PART_IDS,
  SCALE_NOTES,
  STEPS,
  trackColor,
} from './constants'
import { exportStudioToMidiBlob } from './midiExport'

const LS_KEY = 'music-lab:studio-projects'

const createDrumNotes = (): Record<string, number[]> => {
  const notes: Record<string, number[]> = {}
  DRUM_PART_IDS.forEach((id) => {
    notes[id] = Array(STEPS).fill(0)
  })
  return notes
}

const createSynthNotes = (): string[][] => Array.from({ length: STEPS }, () => [] as string[])

const normalizeLoopCount = (raw: unknown): number => {
  const cleaned =
    raw === undefined || raw === null
      ? ''
      : String(raw).replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
  const parsed = parseInt(cleaned, 10)
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed
}

function midiNoteNumberToName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const name = names[midi % 12] ?? 'C'
  const oct = Math.floor(midi / 12) - 1
  return `${name}${oct}`
}

// ── シングルトン状態 ──
const projects = ref<StudioProject[]>([])
const currentProject = ref<StudioProject | null>(null)
const selectedProjectId = ref('')
const saveLoading = ref(false)
const exportLoading = ref(false)

const isPlaying = ref(false)
const currentStep = ref(-1)
const currentBpm = ref(120)
const activeSceneId = ref<string | null>(null)
const currentSceneCycle = ref(0)

const selectedTrackId = ref('')
const selectedLoopId = ref('')
const editingSceneId = ref<string | null>(null)

const trackMuteStates = reactive<Record<string, boolean>>({})
const trackSoloStates = reactive<Record<string, boolean>>({})
const playingLoopIds = reactive<Record<string, string | null>>({})

const midiDeviceCount = ref(0)

const layout = reactive({
  seqHeight: 330,
  seqCollapsed: false,
  mixerCollapsed: false,
})

const addTrackModalOpen = ref(false)
const addTrackForm = reactive({
  name: '',
  type: 'synth' as StudioTrackType,
  preset: 'sine_lead',
})

let initialized = false

export function useStudio() {
  const appStore = useAppStore()

  const tracks = computed<StudioTrack[]>(() => currentProject.value?.tracks ?? [])
  const scenes = computed<StudioScene[]>(() => currentProject.value?.scenes ?? [])

  const activeTrack = computed<StudioTrack | null>(() => {
    if (!currentProject.value || !selectedTrackId.value) return null
    return currentProject.value.tracks.find((t) => t.id === selectedTrackId.value) ?? null
  })

  const activeLoop = computed<StudioLoop | null>(() => {
    if (!activeTrack.value || !selectedLoopId.value) return null
    return activeTrack.value.loops.find((l) => l.id === selectedLoopId.value) ?? null
  })

  const editingScene = computed<StudioScene | null>(() => {
    if (!currentProject.value || !editingSceneId.value) return null
    return currentProject.value.scenes.find((s) => s.id === editingSceneId.value) ?? null
  })

  const activeTrackColor = computed(() => {
    if (!activeTrack.value) return trackColor(0)
    return trackColor(tracks.value.findIndex((t) => t.id === activeTrack.value!.id))
  })

  const colorOfTrack = (trackId: string): string =>
    trackColor(tracks.value.findIndex((t) => t.id === trackId))

  const getSlotLoopId = (scene: StudioScene, trackId: string): string => {
    const mapping = scene.mappings.find((m) => m.trackId === trackId)
    return mapping ? mapping.loopId : ''
  }

  const findLoop = (trackId: string, loopId: string): StudioLoop | null => {
    const track = tracks.value.find((t) => t.id === trackId)
    if (!track) return null
    return track.loops.find((l) => l.id === loopId) ?? null
  }

  // ── プロジェクト正規化と読み込み ──
  function normalizeAndActivateProject(proj: StudioProject) {
    audioEngine.stop()
    isPlaying.value = false

    const cloned: StudioProject = JSON.parse(JSON.stringify(proj))
    cloned.tracks.forEach((t) => {
      t.isMuted = trackMuteStates[t.id] || false
      t.isSolo = trackSoloStates[t.id] || false
      if (t.type === 'drum') {
        t.loops.forEach((l) => {
          if (l.notes && typeof l.notes === 'object' && !Array.isArray(l.notes)) {
            DRUM_PART_IDS.forEach((part) => {
              if (!l.notes[part]) l.notes[part] = Array(STEPS).fill(0)
            })
          } else {
            l.notes = createDrumNotes()
          }
        })
      } else {
        t.loops.forEach((l) => {
          if (Array.isArray(l.notes)) {
            l.notes = l.notes.map((v: unknown) => {
              if (Array.isArray(v)) return v
              if (typeof v === 'string') return [v]
              return []
            })
          } else {
            l.notes = createSynthNotes()
          }
        })
      }
    })

    if (Array.isArray(cloned.scenes)) {
      cloned.scenes.forEach((s) => {
        s.loopCount = normalizeLoopCount(s.loopCount)
        if (!s.endBehavior) s.endBehavior = 'loop'
      })
    }

    currentProject.value = cloned
    selectedProjectId.value = cloned.id
    currentBpm.value = cloned.bpm || 120
    audioEngine.setBpm(currentBpm.value)
    audioEngine.updateTracks(cloned.tracks)

    Object.keys(playingLoopIds).forEach((k) => delete playingLoopIds[k])
    if (cloned.scenes.length > 0) {
      cloned.scenes[0].mappings.forEach((m) => {
        playingLoopIds[m.trackId] = m.loopId
      })
      activeSceneId.value = cloned.scenes[0].id
      editingSceneId.value = cloned.scenes[0].id
    } else {
      activeSceneId.value = null
      editingSceneId.value = null
    }

    const firstWithLoops = cloned.tracks.find((t) => t.loops.length > 0)
    if (firstWithLoops) {
      selectedTrackId.value = firstWithLoops.id
      selectedLoopId.value = firstWithLoops.loops[0].id
    } else {
      selectedTrackId.value = cloned.tracks[0]?.id ?? ''
      selectedLoopId.value = ''
    }
  }

  async function fetchProjectsList() {
    try {
      const r = await fetch('/api/studio/projects')
      if (r.ok) {
        const list = (await r.json()) as StudioProject[]
        if (Array.isArray(list) && list.length > 0) {
          projects.value = list
          localStorage.setItem(LS_KEY, JSON.stringify(list))
          return
        }
      }
    } catch {
      // fallback to localStorage / defaults
    }
    try {
      const cached = localStorage.getItem(LS_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as StudioProject[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          projects.value = parsed
          return
        }
      }
    } catch {
      // ignore
    }
    projects.value = JSON.parse(JSON.stringify(DEFAULT_STUDIO_PROJECTS))
  }

  function loadProjectById(id: string) {
    const found = projects.value.find((p) => p.id === id)
    if (found) normalizeAndActivateProject(found)
  }

  async function createProject(name: string, bpm = 120) {
    const tId = `t_${Date.now()}`
    const lId = `l_${Date.now()}`
    const sId = `sc_${Date.now()}`
    const newProj: StudioProject = {
      id: `proj_${Date.now()}`,
      name: name.trim() || 'Untitled Studio Project',
      bpm,
      key: 'C Major',
      tracks: [
        {
          id: tId,
          name: 'Drum Kit',
          type: 'drum',
          soundPreset: 'default',
          volume: 0.85,
          orderIndex: 0,
          isMuted: false,
          isSolo: false,
          loops: [{ id: lId, trackId: tId, name: 'Beat A', notes: createDrumNotes() }],
        },
      ],
      scenes: [
        {
          id: sId,
          name: 'Scene 1',
          orderIndex: 0,
          loopCount: 2,
          endBehavior: 'loop',
          mappings: [{ trackId: tId, loopId: lId }],
        },
      ],
    }

    projects.value = [newProj, ...projects.value]
    localStorage.setItem(LS_KEY, JSON.stringify(projects.value))
    normalizeAndActivateProject(newProj)
    appStore.flash(`プロジェクト「${newProj.name}」を作成しました`)

    try {
      await fetch('/api/studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProj),
      })
    } catch {
      // offline ok
    }
  }

  async function saveProject() {
    if (!currentProject.value) return
    saveLoading.value = true
    try {
      currentProject.value.bpm = currentBpm.value
      const idx = projects.value.findIndex((p) => p.id === currentProject.value!.id)
      const snapshot: StudioProject = JSON.parse(JSON.stringify(currentProject.value))
      if (idx >= 0) projects.value[idx] = snapshot
      else projects.value.unshift(snapshot)

      localStorage.setItem(LS_KEY, JSON.stringify(projects.value))

      await fetch(`/api/studio/projects/${snapshot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      }).catch(() => {})

      appStore.flash(`🎹「${snapshot.name}」を保存しました`)
    } finally {
      saveLoading.value = false
    }
  }

  // ── トランスポート ──
  const togglePlay = async () => {
    if (isPlaying.value) {
      audioEngine.pause()
      isPlaying.value = false
    } else {
      // 音楽工房のプレイヤーが再生中なら停止して音が重ならないようにする
      if (appStore.playing) appStore.playing = false
      await audioEngine.start()
      isPlaying.value = true
    }
  }

  const stopPlay = () => {
    audioEngine.stop()
    isPlaying.value = false
    currentStep.value = -1
    currentSceneCycle.value = 0
  }

  const updateBpm = () => {
    if (!currentBpm.value || currentBpm.value < BPM_MIN) currentBpm.value = BPM_MIN
    if (currentBpm.value > BPM_MAX) currentBpm.value = BPM_MAX
    if (currentProject.value) currentProject.value.bpm = currentBpm.value
    audioEngine.setBpm(currentBpm.value)
  }

  const nudgeBpm = (delta: number) => {
    currentBpm.value = currentBpm.value + delta
    updateBpm()
  }

  // ── ミキサー ──
  const selectTrack = (trackId: string) => {
    selectedTrackId.value = trackId
    if (!currentProject.value) return
    const track = currentProject.value.tracks.find((t) => t.id === trackId)
    if (!track || track.loops.length === 0) {
      selectedLoopId.value = ''
      return
    }
    const mapped = editingScene.value ? getSlotLoopId(editingScene.value, trackId) : ''
    selectedLoopId.value = mapped || track.loops[0].id
  }

  const handleVolumeChange = (track: StudioTrack) => {
    audioEngine.setVolume(track.id, track.volume)
  }

  const toggleMute = (track: StudioTrack) => {
    track.isMuted = !track.isMuted
    trackMuteStates[track.id] = track.isMuted
    audioEngine.setMute(track.id, track.isMuted)
  }

  const toggleSolo = (track: StudioTrack) => {
    track.isSolo = !track.isSolo
    trackSoloStates[track.id] = track.isSolo
    if (!currentProject.value) return
    audioEngine.updateTracks(currentProject.value.tracks)
  }

  const auditionTrack = (track: StudioTrack) => {
    if (track.type === 'drum') {
      void audioEngine.playNotePreview(track.id, 'drum', 'kick')
    } else {
      void audioEngine.playNotePreview(track.id, 'synth', 'C4')
    }
  }

  const handlePresetChange = () => {
    if (!currentProject.value) return
    audioEngine.updateTracks(currentProject.value.tracks)
  }

  const openAddTrackModal = () => {
    const count = currentProject.value?.tracks.length ?? 0
    addTrackForm.name = `Synth ${count + 1}`
    addTrackForm.type = 'synth'
    addTrackForm.preset = 'pluck'
    addTrackModalOpen.value = true
  }

  const handleAddTrack = () => {
    if (!currentProject.value) return
    const trackId = `t_${Date.now()}`
    const loopId = `l_${Date.now()}`
    const newLoop: StudioLoop = {
      id: loopId,
      trackId,
      name: 'Loop A',
      notes: addTrackForm.type === 'drum' ? createDrumNotes() : createSynthNotes(),
    }
    const newTrack: StudioTrack = {
      id: trackId,
      name: addTrackForm.name.trim() || 'New Track',
      type: addTrackForm.type,
      soundPreset: addTrackForm.preset,
      volume: 0.8,
      orderIndex: currentProject.value.tracks.length,
      isMuted: false,
      isSolo: false,
      loops: [newLoop],
    }
    currentProject.value.tracks.push(newTrack)
    currentProject.value.scenes.forEach((sc) => {
      sc.mappings.push({ trackId, loopId })
    })
    playingLoopIds[trackId] = loopId
    audioEngine.updateTracks(currentProject.value.tracks)
    addTrackModalOpen.value = false
    selectTrack(trackId)
    appStore.flash(`トラック「${newTrack.name}」を追加しました`)
  }

  const deleteTrack = (track: StudioTrack) => {
    if (!currentProject.value) return
    if (currentProject.value.tracks.length <= 1) {
      appStore.flash('少なくとも1つのトラックが必要です')
      return
    }
    currentProject.value.tracks = currentProject.value.tracks.filter((t) => t.id !== track.id)
    currentProject.value.scenes.forEach((sc) => {
      sc.mappings = sc.mappings.filter((m) => m.trackId !== track.id)
    })
    delete playingLoopIds[track.id]
    audioEngine.updateTracks(currentProject.value.tracks)
    if (selectedTrackId.value === track.id && currentProject.value.tracks[0]) {
      selectTrack(currentProject.value.tracks[0].id)
    }
  }

  // ── クリップ & シーン ──
  const setSlotLoop = (scene: StudioScene, trackId: string, loopId: string) => {
    const mapping = scene.mappings.find((m) => m.trackId === trackId)
    if (mapping) mapping.loopId = loopId
    else scene.mappings.push({ trackId, loopId })

    selectedTrackId.value = trackId
    editingSceneId.value = scene.id
    selectedLoopId.value = loopId
    if (activeSceneId.value === scene.id) {
      playingLoopIds[trackId] = loopId || null
    }
  }

  const selectSlot = (scene: StudioScene, trackId: string) => {
    selectedTrackId.value = trackId
    editingSceneId.value = scene.id
    selectedLoopId.value = getSlotLoopId(scene, trackId)
    layout.seqCollapsed = false
  }

  const triggerScene = (scene: StudioScene) => {
    if (!currentProject.value) return
    activeSceneId.value = scene.id
    currentSceneCycle.value = 1
    currentProject.value.tracks.forEach((track) => {
      playingLoopIds[track.id] = getSlotLoopId(scene, track.id) || null
    })
    if (!isPlaying.value) void togglePlay()
  }

  const triggerSingleClip = (trackId: string, loopId: string) => {
    activeSceneId.value = null
    currentSceneCycle.value = 0
    if (playingLoopIds[trackId] === loopId) {
      playingLoopIds[trackId] = null
    } else {
      playingLoopIds[trackId] = loopId
      if (!isPlaying.value) void togglePlay()
    }
  }

  const editLoop = (trackId: string, loopId: string, sceneId?: string) => {
    selectedTrackId.value = trackId
    selectedLoopId.value = loopId
    editingSceneId.value = sceneId ?? null
    layout.seqCollapsed = false
  }

  const createNewLoop = (track: StudioTrack, scene?: StudioScene) => {
    const newLoop: StudioLoop = {
      id: `l_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      trackId: track.id,
      name: `Loop ${String.fromCharCode(65 + track.loops.length)}`,
      notes: track.type === 'drum' ? createDrumNotes() : createSynthNotes(),
    }
    track.loops.push(newLoop)
    selectedTrackId.value = track.id
    selectedLoopId.value = newLoop.id
    if (scene) setSlotLoop(scene, track.id, newLoop.id)
    layout.seqCollapsed = false
  }

  const addNewScene = () => {
    if (!currentProject.value) return
    const n = currentProject.value.scenes.length
    currentProject.value.scenes.push({
      id: `sc_${Date.now()}`,
      name: `Scene ${n + 1}`,
      orderIndex: n,
      loopCount: 2,
      endBehavior: 'loop',
      mappings: currentProject.value.tracks.map((t) => ({ trackId: t.id, loopId: '' })),
    })
  }

  // ── シーケンサー ──
  const toggleDrumStep = (drumId: string, stepIndex: number) => {
    if (!activeLoop.value || !activeTrack.value) return
    const row = activeLoop.value.notes[drumId]
    if (!row) return
    row[stepIndex] = row[stepIndex] === 1 ? 0 : 1
    if (row[stepIndex] === 1) {
      void audioEngine.playNotePreview(activeTrack.value.id, 'drum', drumId)
    }
  }

  const previewDrum = (drumId: string) => {
    if (!activeTrack.value) return
    void audioEngine.playNotePreview(activeTrack.value.id, 'drum', drumId)
  }

  const previewNote = (note: string) => {
    if (!activeTrack.value) return
    void audioEngine.playNotePreview(activeTrack.value.id, 'synth', note)
  }

  const toggleSynthStep = (note: string, stepIndex: number) => {
    if (!activeLoop.value || !activeTrack.value) return
    const raw = activeLoop.value.notes[stepIndex]
    const stepNotes: string[] = Array.isArray(raw) ? [...raw] : typeof raw === 'string' ? [raw] : []
    const idx = stepNotes.indexOf(note)
    if (idx >= 0) {
      stepNotes.splice(idx, 1)
    } else {
      stepNotes.push(note)
      void audioEngine.playNotePreview(activeTrack.value.id, 'synth', note)
    }
    activeLoop.value.notes[stepIndex] = stepNotes
  }

  const isNoteOn = (stepNotes: unknown, note: string): boolean => {
    if (!stepNotes) return false
    if (Array.isArray(stepNotes)) return stepNotes.includes(note)
    return stepNotes === note
  }

  const clearActiveLoop = () => {
    if (!activeLoop.value || !activeTrack.value) return
    activeLoop.value.notes =
      activeTrack.value.type === 'drum' ? createDrumNotes() : createSynthNotes()
  }

  // ── AI/アルゴリズム自動パターン生成 ──
  const randomizeActiveLoop = () => {
    if (!activeLoop.value || !activeTrack.value) return
    if (activeTrack.value.type === 'drum') {
      const n = createDrumNotes()
      for (let s = 0; s < STEPS; s++) {
        n.kick[s] = s % 4 === 0 || (s === 10 && Math.random() > 0.4) || (s === 14 && Math.random() > 0.6) ? 1 : 0
        n.snare[s] = s === 4 || s === 12 ? 1 : (s === 15 && Math.random() > 0.65 ? 1 : 0)
        n.hihat[s] = s % 2 === 0 || Math.random() > 0.55 ? 1 : 0
        n.openhihat[s] = s === 14 && Math.random() > 0.4 ? 1 : 0
        n.clap[s] = (s === 4 || s === 12) && Math.random() > 0.4 ? 1 : 0
        n.rimshot[s] = s % 4 === 2 && Math.random() > 0.7 ? 1 : 0
      }
      activeLoop.value.notes = n
    } else {
      const pentatonic = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'E5', 'G5'].filter((x) =>
        SCALE_NOTES.includes(x)
      )
      const bassNotes = ['C3', 'E3', 'G3', 'A3', 'F3']
      const pool = activeTrack.value.type === 'bass' ? bassNotes : pentatonic
      const next = createSynthNotes()
      for (let s = 0; s < STEPS; s++) {
        if (s % 2 === 0 || Math.random() > 0.55) {
          const pick = pool[Math.floor(Math.random() * pool.length)]
          next[s] = [pick]
        }
      }
      activeLoop.value.notes = next
    }
    appStore.flash('✨ 新しいパターンを生成しました')
  }

  // ── エクスポート & 統合連携 ──
  function getCurrentActiveLoopsMap(): Record<string, StudioLoop | null> {
    const map: Record<string, StudioLoop | null> = {}
    if (!currentProject.value) return map
    for (const t of currentProject.value.tracks) {
      const lid = playingLoopIds[t.id]
      map[t.id] = (lid ? findLoop(t.id, lid) : null) || t.loops[0] || null
    }
    return map
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const exportMidi = () => {
    if (!currentProject.value) return
    const blob = exportStudioToMidiBlob(currentProject.value, getCurrentActiveLoopsMap(), 4)
    const safe = currentProject.value.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'studio'
    downloadBlob(blob, `${safe}.mid`)
    appStore.flash(`🎹 ${safe}.mid を書き出しました`)
  }

  const exportWav = async () => {
    if (!currentProject.value || exportLoading.value) return
    exportLoading.value = true
    try {
      const blob = await audioEngine.renderToWavBlob(currentProject.value, getCurrentActiveLoopsMap(), 4)
      const safe = currentProject.value.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'studio'
      downloadBlob(blob, `${safe}.wav`)
      appStore.flash(`🔊 ${safe}.wav を書き出しました`)
    } finally {
      exportLoading.value = false
    }
  }

  async function renderAndUploadWav(): Promise<{ audioUrl: string; durationSec: number }> {
    if (!currentProject.value) throw new Error('No project')
    const blob = await audioEngine.renderToWavBlob(currentProject.value, getCurrentActiveLoopsMap(), 4)
    const base64Wav = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const resp = await fetch('/api/audio/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Wav, prefix: 'studio' }),
    })
    if (!resp.ok) throw new Error('Audio upload failed')
    return (await resp.json()) as { audioUrl: string; durationSec: number }
  }

  const saveMixToLibrary = async () => {
    if (!currentProject.value || exportLoading.value) return
    exportLoading.value = true
    try {
      const { audioUrl, durationSec } = await renderAndUploadWav()
      const trackNames = currentProject.value.tracks.map((t) => t.soundPreset || t.type).join(', ')
      const trk = await appStore.saveStudioTrackToLibrary({
        title: currentProject.value.name,
        bpm: currentBpm.value,
        key: currentProject.value.key || 'C Major',
        duration: durationSec,
        tags: ['midi-studio', 'loop', ...currentProject.value.tracks.map((t) => t.type)].slice(0, 5),
        caption: `instrumental electronic loop, ${currentBpm.value} bpm, ${trackNames}`,
        audioUrl,
        midiProjectId: currentProject.value.id,
      })
      appStore.playTrack(trk)
    } catch (e: any) {
      appStore.flash(`保存エラー: ${e?.message ?? e}`)
    } finally {
      exportLoading.value = false
    }
  }

  const sendToAiGenerator = async () => {
    if (!currentProject.value) return
    const presets = currentProject.value.tracks
      .map((t) => (t.type === 'drum' ? 'electronic drums' : t.soundPreset.replace('_', ' ')))
      .join(', ')
    appStore.sendStudioToGenerator({
      fromTitle: currentProject.value.name,
      caption: `${presets}, ${currentBpm.value} BPM, ${currentProject.value.key || 'C Major'}, polished mix`,
      bpm: currentBpm.value,
      key: currentProject.value.key || 'C Major',
      duration: 24,
      task: 'cover',
    })
  }

  // ── Web MIDI API 入力 ──
  async function initWebMidi() {
    if (!('requestMIDIAccess' in navigator)) return
    try {
      const access = await (navigator as any).requestMIDIAccess()
      const bindInputs = () => {
        let count = 0
        for (const input of access.inputs.values()) {
          count++
          input.onmidimessage = (msg: any) => {
            const [status, note, vel] = msg.data as Uint8Array
            const cmd = status & 0xf0
            if (cmd === 0x90 && vel > 0 && activeTrack.value) {
              if (activeTrack.value.type === 'drum') {
                void audioEngine.playNotePreview(activeTrack.value.id, 'drum', 'kick')
              } else {
                const name = midiNoteNumberToName(note)
                void audioEngine.playNotePreview(activeTrack.value.id, 'synth', name)
              }
            }
          }
        }
        midiDeviceCount.value = count
      }
      bindInputs()
      access.onstatechange = bindInputs
    } catch {
      // MIDI 権限なし
    }
  }

  // ── シーン自動進行 ──
  const handleSceneCycleEnd = () => {
    if (!activeSceneId.value || !currentProject.value) return
    const scene = currentProject.value.scenes.find((s) => s.id === activeSceneId.value)
    if (!scene) return
    const endBehavior = scene.endBehavior || 'loop'
    if (endBehavior === 'loop') return

    const loopCount = normalizeLoopCount(scene.loopCount)
    if (currentSceneCycle.value < loopCount) {
      currentSceneCycle.value++
      return
    }

    if (endBehavior === 'next') {
      const idx = currentProject.value.scenes.findIndex((s) => s.id === activeSceneId.value)
      const nextScene = currentProject.value.scenes[idx + 1]
      if (!nextScene) {
        stopPlay()
        return
      }
      activeSceneId.value = nextScene.id
      currentSceneCycle.value = 1
      currentProject.value.tracks.forEach((track) => {
        playingLoopIds[track.id] = getSlotLoopId(nextScene, track.id) || null
      })
    } else if (endBehavior === 'stop') {
      stopPlay()
    }
  }

  const init = async () => {
    if (initialized) return
    initialized = true

    await fetchProjectsList()
    if (projects.value.length > 0 && !currentProject.value) {
      normalizeAndActivateProject(projects.value[0])
    }

    audioEngine.onStep((step) => {
      currentStep.value = step
    })
    audioEngine.onStepLogic((step) => {
      if (step === STEPS - 1) handleSceneCycleEnd()
    })

    watch(
      () => ({ ...playingLoopIds }),
      (newPlayingLoops) => {
        if (!currentProject.value) return
        const payload: Record<string, StudioLoop | null> = {}
        currentProject.value.tracks.forEach((track) => {
          const lid = newPlayingLoops[track.id]
          payload[track.id] = lid ? findLoop(track.id, lid) : null
        })
        audioEngine.updateActiveLoops(payload)
      },
      { deep: true, immediate: true }
    )

    void initWebMidi()
  }

  return {
    projects,
    currentProject,
    selectedProjectId,
    saveLoading,
    exportLoading,
    isPlaying,
    currentStep,
    currentBpm,
    activeSceneId,
    currentSceneCycle,
    selectedTrackId,
    selectedLoopId,
    editingSceneId,
    playingLoopIds,
    midiDeviceCount,
    layout,
    addTrackModalOpen,
    addTrackForm,
    tracks,
    scenes,
    activeTrack,
    activeLoop,
    editingScene,
    activeTrackColor,
    colorOfTrack,
    getSlotLoopId,
    init,
    loadProjectById,
    createProject,
    saveProject,
    togglePlay,
    stopPlay,
    updateBpm,
    nudgeBpm,
    selectTrack,
    handleVolumeChange,
    toggleMute,
    toggleSolo,
    auditionTrack,
    handlePresetChange,
    openAddTrackModal,
    handleAddTrack,
    deleteTrack,
    setSlotLoop,
    selectSlot,
    triggerScene,
    triggerSingleClip,
    editLoop,
    createNewLoop,
    addNewScene,
    toggleDrumStep,
    toggleSynthStep,
    previewDrum,
    previewNote,
    isNoteOn,
    clearActiveLoop,
    randomizeActiveLoop,
    exportMidi,
    exportWav,
    saveMixToLibrary,
    sendToAiGenerator,
  }
}
