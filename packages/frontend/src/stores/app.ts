import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { INITIAL_TRACKS } from '@/data'
import type { Track, Take, SeedForm, RepaintRegion, ViewId, TaskId } from '@/types'

export const useAppStore = defineStore('app', () => {
  const view = ref<ViewId>('generate')
  const tracks = ref<Track[]>(INITIAL_TRACKS.map(t => ({ ...t })))
  const openId = ref<string | null>(null)
  const nowPlaying = ref<Track | null>(null)
  const playing = ref(false)
  const progress = ref(0)
  const seedForm = ref<SeedForm | null>(null)
  const genKey = ref(0)
  const toast = ref<string | null>(null)
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  const openTrack = computed(() => tracks.value.find(t => t.id === openId.value) ?? null)
  const publishedCount = computed(() => tracks.value.filter(t => t.status === 'published').length)

  function flash(msg: string) {
    toast.value = msg
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toast.value = null }, 2800)
  }

  // バックエンドから永続化トラック一覧をロード
  async function fetchTracks() {
    try {
      const r = await fetch('/api/tracks')
      if (r.ok) {
        const list = await r.json() as Track[]
        if (Array.isArray(list) && list.length > 0) {
          tracks.value = list
        }
      }
    } catch {
      // オフライン時は INITIAL_TRACKS を維持
    }
  }

  function playTrack(track: Track | Take) {
    const t = track as Track
    if (nowPlaying.value && nowPlaying.value.id === t.id) {
      playing.value = !playing.value
      return
    }
    nowPlaying.value = t
    progress.value = 0
    playing.value = true
  }

  function togglePlay() { playing.value = !playing.value }
  function seekTo(p: number) { progress.value = p }

  async function saveTake(take: Take) {
    const title = take.caption.split(',')[0].replace(/^\w/, c => c.toUpperCase()).slice(0, 28) || '新規トラック'
    const tags = take.caption.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4)
    const trk: Track = {
      ...take,
      id: 'trk_' + take.id,
      title,
      tags,
      status: 'saved',
      created: Date.now(),
      lineage: [],
      audioUrl: take.audioUrl,
      source: take.engineMode === 'acestep' ? 'acestep' : 'synth',
    }
    tracks.value = [trk, ...tracks.value]
    flash(`「${title}」をライブラリに保存しました`)

    try {
      await fetch('/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trk),
      })
    } catch {
      // ignore offline error
    }
  }

  // MIDI Studio で作成したループ/シーンを実WAV付きでライブラリへ保存
  async function saveStudioTrackToLibrary(params: {
    title: string
    bpm: number
    key: string
    duration: number
    tags: string[]
    caption: string
    audioUrl: string
    midiProjectId?: string
  }): Promise<Track> {
    const trk: Track = {
      id: `trk_studio_${Date.now()}`,
      title: params.title,
      task: 'text2music',
      caption: params.caption,
      lyrics: '[Instrumental — Created in MIDI Studio]',
      bpm: params.bpm,
      key: params.key,
      timesig: '4/4',
      lang: 'Instrumental',
      duration: params.duration,
      dit: 'turbo',
      lm: 'none',
      seed: Math.floor(10000 + Math.random() * 89999),
      cfg: null,
      steps: 16,
      tags: params.tags,
      color: 170,
      scores: { lyrics: null, quality: 0.94, diversity: 0.85 },
      wave: Math.floor(Math.random() * 40) + 1,
      status: 'saved',
      created: Date.now(),
      lineage: [],
      audioUrl: params.audioUrl,
      source: 'midi-studio',
      midiProjectId: params.midiProjectId,
    }
    tracks.value = [trk, ...tracks.value]
    try {
      await fetch('/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trk),
      })
    } catch {
      // ignore
    }
    flash(`🎹「${params.title}」をライブラリに保存しました`)
    return trk
  }

  // MIDI Studio の楽曲構成を AI 工房 (GenerateView) に種として送る
  function sendStudioToGenerator(params: {
    fromTitle: string
    caption: string
    bpm: number
    key: string
    duration: number
    task?: TaskId
    audioUrl?: string
  }) {
    seedForm.value = {
      caption: params.caption,
      lyrics: '[Intro]\n\n[Main Groove - from MIDI Studio]\n\n[Build]\n\n[Drop / Chorus]\n\n[Outro]',
      task: params.task ?? 'cover',
      from: `🎹 MIDI Studio: ${params.fromTitle}`,
      bpm: params.bpm,
      key: params.key,
      duration: Math.max(16, params.duration),
      audioUrl: params.audioUrl,
    }
    genKey.value++
    view.value = 'generate'
    window.scrollTo(0, 0)
    flash(`🎹「${params.fromTitle}」の設定をAI工房に引き継ぎました`)
  }

  function openDetail(id: string) {
    openId.value = id
    view.value = 'detail'
    window.scrollTo(0, 0)
  }

  function setView(v: ViewId) {
    view.value = v
    if (v !== 'detail') openId.value = null
  }

  function remix(track: Track, op: TaskId, region?: RepaintRegion) {
    let caption = track.caption
    const lyrics = track.lyrics
    if (op === 'repaint' && region) {
      caption = region.prompt?.trim() ? region.prompt.trim() : track.caption
    }
    seedForm.value = {
      caption,
      lyrics,
      task: op,
      from: track.title,
      bpm: track.bpm,
      key: track.key,
      duration: track.duration,
      audioUrl: track.audioUrl,
      region,
    }
    genKey.value++
    view.value = 'generate'
    window.scrollTo(0, 0)
    const msg = op === 'repaint' && region
      ? `Repaint ${region.end - region.start}s 区間を工房に読み込みました`
      : `${op} を工房に読み込みました`
    flash(msg)
  }

  async function updateTrack(next: Partial<Track> & { id: string }) {
    tracks.value = tracks.value.map(t => t.id === next.id ? { ...t, ...next } : t)
    flash(`「${next.title ?? ''}」のメタ情報を保存しました`)
    try {
      await fetch(`/api/tracks/${next.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
    } catch {
      // ignore
    }
  }

  async function publish(id: string) {
    tracks.value = tracks.value.map(t => t.id === id ? { ...t, status: 'published' as const } : t)
    flash('公開ステータスに変更しました')
    try {
      await fetch(`/api/tracks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      })
    } catch {
      // ignore
    }
  }

  async function deleteTrack(id: string) {
    const target = tracks.value.find(t => t.id === id)
    tracks.value = tracks.value.filter(t => t.id !== id)
    if (nowPlaying.value?.id === id) {
      playing.value = false
      nowPlaying.value = null
    }
    if (openId.value === id) {
      openId.value = null
      view.value = 'library'
    }
    flash(`「${target?.title ?? 'トラック'}」を削除しました`)
    try {
      await fetch(`/api/tracks/${id}`, { method: 'DELETE' })
    } catch {
      // ignore
    }
  }

  return {
    view, tracks, openId, nowPlaying, playing, progress,
    seedForm, genKey, toast,
    openTrack, publishedCount,
    flash, fetchTracks, playTrack, togglePlay, seekTo,
    saveTake, saveStudioTrackToLibrary, sendStudioToGenerator,
    openDetail, setView, remix, updateTrack, publish, deleteTrack,
  }
})
