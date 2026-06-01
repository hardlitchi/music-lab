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
    toastTimer = setTimeout(() => { toast.value = null }, 2400)
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

  function saveTake(take: Take) {
    const title = take.caption.split(',')[0].replace(/^\w/, c => c.toUpperCase()).slice(0, 28) || '新規トラック'
    const tags = take.caption.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4)
    const trk: Track = {
      ...take,
      id: 'trk_' + take.id,
      title,
      tags,
      status: 'draft',
      created: Date.now(),
      lineage: [],
    }
    tracks.value = [trk, ...tracks.value]
    flash(`「${title}」をライブラリに保存しました`)
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
    let lyrics = track.lyrics
    if (op === 'repaint' && region) {
      caption = region.prompt?.trim() ? region.prompt.trim() : track.caption
    }
    seedForm.value = { caption, lyrics, task: op, from: track.title, region }
    genKey.value++
    view.value = 'generate'
    window.scrollTo(0, 0)
    const msg = op === 'repaint' && region
      ? `Repaint ${region.end - region.start}s 区間を工房に読み込みました`
      : `${op} を工房に読み込みました`
    flash(msg)
  }

  function updateTrack(next: Partial<Track> & { id: string }) {
    tracks.value = tracks.value.map(t => t.id === next.id ? { ...t, ...next } : t)
    flash(`「${next.title ?? ''}」のメタ情報を保存しました`)
  }

  function publish(id: string) {
    tracks.value = tracks.value.map(t => t.id === id ? { ...t, status: 'published' as const } : t)
    flash('公開しました')
  }

  return {
    view, tracks, openId, nowPlaying, playing, progress,
    seedForm, genKey, toast,
    openTrack, publishedCount,
    flash, playTrack, togglePlay, seekTo,
    saveTake, openDetail, setView, remix, updateTrack, publish,
  }
})
