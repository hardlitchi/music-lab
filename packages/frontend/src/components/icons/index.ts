import { h, type FunctionalComponent } from 'vue'

type IconProps = { size?: number; style?: Record<string, string> | string; class?: string }

const S = (props: IconProps, children: ReturnType<typeof h>[]) =>
  h('svg', {
    width: props.size ?? 18,
    height: props.size ?? 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.6',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    style: props.style,
    class: props.class,
  }, children)

const path = (d: string, extra?: Record<string, string>) => h('path', { d, ...extra })
const circle = (cx: number, cy: number, r: number, extra?: Record<string, string>) => h('circle', { cx, cy, r, ...extra })
const rect = (x: number, y: number, width: number, height: number, rx?: number, extra?: Record<string, string>) =>
  h('rect', { x, y, width, height, rx, ...extra })

export const IconSpark: FunctionalComponent<IconProps> = (props) =>
  S(props, [
    path('M12 3v4M12 17v4M3 12h4M17 12h4'),
    path('M12 8.5l1.4 2.1L15.5 12l-2.1 1.4L12 15.5l-1.4-2.1L8.5 12l2.1-1.4z', { fill: 'currentColor', stroke: 'none' }),
  ])

export const IconLibrary: FunctionalComponent<IconProps> = (props) =>
  S(props, [
    rect(4, 4, 5, 16, 1),
    rect(11, 4, 5, 16, 1),
    path('M18.5 5.5l2.2 14.3'),
  ])

export const IconShare: FunctionalComponent<IconProps> = (props) =>
  S(props, [
    circle(6, 12, 2.4),
    circle(18, 6, 2.4),
    circle(18, 18, 2.4),
    path('M8.1 10.9l7.8-3.8M8.1 13.1l7.8 3.8'),
  ])

export const IconPlay: FunctionalComponent<IconProps> = (props) =>
  h('svg', {
    width: props.size ?? 18, height: props.size ?? 18,
    viewBox: '0 0 24 24', fill: 'currentColor',
    stroke: 'none', style: props.style, class: props.class,
  }, [path('M7 5.5v13l11-6.5z')])

export const IconPause: FunctionalComponent<IconProps> = (props) =>
  h('svg', {
    width: props.size ?? 18, height: props.size ?? 18,
    viewBox: '0 0 24 24', fill: 'currentColor',
    stroke: 'none', style: props.style, class: props.class,
  }, [
    rect(7, 5.5, 3.4, 13, 1),
    rect(13.6, 5.5, 3.4, 13, 1),
  ])

export const IconDice: FunctionalComponent<IconProps> = (props) =>
  S(props, [
    rect(4, 4, 16, 16, 3),
    circle(8.5, 8.5, 1.1, { fill: 'currentColor', stroke: 'none' }),
    circle(15.5, 8.5, 1.1, { fill: 'currentColor', stroke: 'none' }),
    circle(12, 12, 1.1, { fill: 'currentColor', stroke: 'none' }),
    circle(8.5, 15.5, 1.1, { fill: 'currentColor', stroke: 'none' }),
    circle(15.5, 15.5, 1.1, { fill: 'currentColor', stroke: 'none' }),
  ])

export const IconWand: FunctionalComponent<IconProps> = (props) =>
  S(props, [
    path('M5 19l9-9'),
    path('M14 6l1 1M17 4l.5.5M16 9l3 3M19.5 8.5l1 1'),
    path('M15 7l2 2', { 'stroke-width': '2' }),
  ])

export const IconSettings: FunctionalComponent<IconProps> = (props) =>
  S(props, [
    circle(12, 12, 3),
    path('M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1'),
  ])

export const IconDownload: FunctionalComponent<IconProps> = (props) =>
  S(props, [path('M12 3v12m0 0l-4-4m4 4l4-4M4 19h16')])

export const IconPlus: FunctionalComponent<IconProps> = (props) =>
  S(props, [path('M12 5v14M5 12h14')])

export const IconSearch: FunctionalComponent<IconProps> = (props) =>
  S(props, [circle(11, 11, 6), path('M20 20l-4.5-4.5')])

export const IconBack: FunctionalComponent<IconProps> = (props) =>
  S(props, [path('M15 5l-7 7 7 7')])

export const IconCheck: FunctionalComponent<IconProps> = (props) =>
  S(props, [path('M5 12.5l4.5 4.5L19 7')])

export const IconGrid: FunctionalComponent<IconProps> = (props) =>
  S(props, [
    rect(4, 4, 7, 7, 1.5),
    rect(13, 4, 7, 7, 1.5),
    rect(4, 13, 7, 7, 1.5),
    rect(13, 13, 7, 7, 1.5),
  ])

export const IconList: FunctionalComponent<IconProps> = (props) =>
  S(props, [
    path('M8 6h12M8 12h12M8 18h12'),
    circle(4, 6, 1, { fill: 'currentColor', stroke: 'none' }),
    circle(4, 12, 1, { fill: 'currentColor', stroke: 'none' }),
    circle(4, 18, 1, { fill: 'currentColor', stroke: 'none' }),
  ])

export const IconLayers: FunctionalComponent<IconProps> = (props) =>
  S(props, [path('M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 16.5l9 5 9-5')])

export const IconCopy: FunctionalComponent<IconProps> = (props) =>
  S(props, [
    rect(8, 8, 12, 12, 2),
    path('M4 16V5a1 1 0 011-1h11'),
  ])

export const IconWaveform: FunctionalComponent<IconProps> = (props) =>
  S(props, [path('M3 12h2l2-6 3 14 3-18 3 14 2-4h3')])

export const IconClose: FunctionalComponent<IconProps> = (props) =>
  S(props, [path('M6 6l12 12M18 6L6 18')])

export const IconClock: FunctionalComponent<IconProps> = (props) =>
  S(props, [circle(12, 12, 8), path('M12 8v4l3 2')])

export const IconSliders: FunctionalComponent<IconProps> = (props) =>
  S(props, [
    path('M6 4v6M6 14v6M12 4v3M12 11v9M18 4v9M18 17v3'),
    circle(6, 12, 2),
    circle(12, 9, 2),
    circle(18, 15, 2),
  ])

export const IconExternal: FunctionalComponent<IconProps> = (props) =>
  S(props, [
    path('M14 4h6v6'),
    path('M20 4l-9 9'),
    path('M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5'),
  ])

export const IconRefresh: FunctionalComponent<IconProps> = (props) =>
  S(props, [
    path('M20 11a8 8 0 10-2 6'),
    path('M20 4v6h-6'),
  ])

export const IconTag: FunctionalComponent<IconProps> = (props) =>
  S(props, [
    path('M3 11l8-8 9 1 1 9-8 8z'),
    circle(15, 9, 1.4),
  ])
