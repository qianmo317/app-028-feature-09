/**
 * 「同一种尺寸被拆散到多张相纸」的统计。
 * 直接从最终 sheet 上的 placement 派生，所以自动排样、手工微调、旧任务都适用；
 * 判定范围 = 单项勾选了「不拆散」，或任务开启了「禁止拆散」严格模式。
 */
import type { KeepTogetherBreak, Sheet, Task } from './types'

export interface SplitInfo extends KeepTogetherBreak {
  /** 尺寸名称（找不到尺寸时的兜底名） */
  name: string
  /** 例：第 1、3 张（各 4、2 张） */
  summary: string
}

/**
 * @param labelOf itemId -> 展示名（通常传尺寸名）
 */
export function collectSplits(
  task: Task,
  sheets: Sheet[],
  labelOf: (itemId: string) => string,
): SplitInfo[] {
  const relevant = new Set(
    task.items
      .filter((i) => i.qty > 1 && (i.keepTogether || task.strictKeepTogether))
      .map((i) => i.id),
  )
  const byItem = new Map<string, Map<number, number>>()
  for (const s of sheets) {
    for (const p of s.placements) {
      if (!relevant.has(p.itemId)) continue
      let m = byItem.get(p.itemId)
      if (!m) {
        m = new Map()
        byItem.set(p.itemId, m)
      }
      m.set(s.index, (m.get(s.index) ?? 0) + 1)
    }
  }
  const out: SplitInfo[] = []
  for (const itemId of relevant) {
    const m = byItem.get(itemId)
    if (!m) continue
    const sheetIndexes = Array.from(m.keys()).sort((a, b) => a - b)
    if (sheetIndexes.length <= 1) continue
    const item = task.items.find((i) => i.id === itemId)
    const perSheet = sheetIndexes.map((i) => m.get(i) ?? 0)
    const copies = item?.qty ?? perSheet.reduce((a, b) => a + b, 0)
    out.push({
      itemId,
      copies,
      sheetCount: sheetIndexes.length,
      sheetIndexes,
      perSheet,
      name: labelOf(itemId),
      summary:
        `第 ${sheetIndexes.map((i) => i + 1).join('、')} 张` +
        `（各 ${perSheet.join('、')} 张，共 ${copies} 张，分到 ${sheetIndexes.length} 张纸）`,
    })
  }
  return out.sort((a, b) => b.sheetCount - a.sheetCount || a.sheetIndexes[0] - b.sheetIndexes[0])
}

/** 被拆散的 itemId 集合（给纸面视图做高亮用） */
export function splitItemIds(splits: SplitInfo[]): Set<string> {
  return new Set(splits.map((s) => s.itemId))
}
