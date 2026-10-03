/** 尺寸库查询与任务 -> 排样输入 的转换 */
import papersJson from '../data/papers.json'
import type { PackGroup, PackOptions } from './packer'
import type { Item, Paper, PaperTemplate, PhotoSize, Sheet, SplitGroupInfo, Task } from './types'

export const BUILTIN_PAPERS: Paper[] = papersJson.papers as Paper[]
export const BUILTIN_PHOTO_SIZES: PhotoSize[] = papersJson.photoSizes as PhotoSize[]
export const BUILTIN_TEMPLATES: PaperTemplate[] = papersJson.templates as PaperTemplate[]

export function findPaper(all: Paper[], id: string): Paper | undefined {
  return all.find((p) => p.id === id)
}

export function findPhotoSize(all: PhotoSize[], id: string): PhotoSize | undefined {
  return all.find((s) => s.id === id)
}

export function resolvePaper(task: Task, all: Paper[]): Paper {
  if (task.paperId === 'custom' && task.customPaper) return task.customPaper
  return findPaper(all, task.paperId) ?? all[0]
}

export function sizeLabel(size: PhotoSize | undefined): string {
  if (!size) return '未知尺寸'
  return `${size.name} ${size.wMm}×${size.hMm}mm`
}

export function itemLabel(item: Item, sizes: PhotoSize[]): string {
  const s = findPhotoSize(sizes, item.sizeId)
  return s ? s.name : '自定义'
}

/** 任务 -> 排样器输入 */
export function groupsFromTask(task: Task, sizes: PhotoSize[]): PackGroup[] {
  const out: PackGroup[] = []
  for (const item of task.items) {
    const s = findPhotoSize(sizes, item.sizeId)
    if (!s || item.qty <= 0) continue
    out.push({
      itemId: item.id,
      copies: item.qty,
      photoW: s.wMm,
      photoH: s.hMm,
      allowRotate: item.rotateAllowed,
      keepTogether: item.keepTogether,
      label: s.name,
    })
  }
  return out
}

export function optionsFromTask(task: Task, paper: Paper): PackOptions {
  return {
    paperW: paper.wMm,
    paperH: paper.hMm,
    marginMm: paper.marginMm,
    safeEdgeMm: task.safeEdgeMm,
    gapMm: task.gapMm,
    kerfMm: task.kerfMm,
    allowRotate: task.allowRotate,
    strictKeepTogether: task.strictKeepTogether ?? false,
  }
}

/**
 * 从当前生效的版面推导「不拆散」却被分到多张相纸的尺寸及其分布。
 * 直接读 placements，因此手工微调后的结果同样准确。
 */
export function splitGroupsOf(task: Task, sheets: Sheet[]): SplitGroupInfo[] {
  const keep = new Set(task.items.filter((i) => i.keepTogether && i.qty > 1).map((i) => i.id))
  if (!keep.size) return []
  const counts = new Map<string, Map<number, number>>()
  for (const s of sheets) {
    for (const p of s.placements) {
      if (!keep.has(p.itemId)) continue
      let m = counts.get(p.itemId)
      if (!m) {
        m = new Map()
        counts.set(p.itemId, m)
      }
      m.set(s.index, (m.get(s.index) ?? 0) + 1)
    }
  }
  const out: SplitGroupInfo[] = []
  for (const item of task.items) {
    const m = counts.get(item.id)
    if (!m || m.size <= 1) continue
    const perSheet = [...m.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([sheetIndex, count]) => ({ sheetIndex, count }))
    out.push({
      itemId: item.id,
      total: perSheet.reduce((acc, x) => acc + x.count, 0),
      perSheet,
    })
  }
  return out
}

/** 分布明细的人读文本，如「第1张×4、第2张×1」 */
export function splitDistributionText(sg: SplitGroupInfo): string {
  return sg.perSheet.map((x) => `第${x.sheetIndex + 1}张×${x.count}`).join('、')
}

export function totalPhotoCount(task: Task): number {
  return task.items.reduce((acc, i) => acc + Math.max(0, i.qty), 0)
}

export function newId(prefix = 'id'): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${rnd}`
}
