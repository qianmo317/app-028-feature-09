/** 导出 CSV（带 BOM，Excel 直接打开不乱码） */
import type { SplitInfo } from './splits'
import type { Paper, Sheet, Task } from './types'

export function toCsv(rows: Array<Array<string | number>>): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? '')
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(','),
    )
    .join('\r\n')
}

export function csvBlob(rows: Array<Array<string | number>>): Blob {
  return new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' })
}

/** 某 itemId 对应的拆散摘要；未拆散时返回空串 */
export function splitMarkOf(itemId: string, splits: SplitInfo[]): string {
  const s = splits.find((x) => x.itemId === itemId)
  return s ? `是：${s.summary}` : ''
}

/** 「同尺寸拆散」汇总行（没有拆散项时返回空数组） */
export function splitSummaryRows(splits: SplitInfo[]): Array<Array<string | number>> {
  if (!splits.length) return []
  return [
    ['同尺寸拆散种数', splits.length],
    ...splits.map((s) => [
      '拆散明细',
      s.name,
      `共 ${s.copies} 张`,
      `分到第 ${s.sheetIndexes.map((i) => i + 1).join('、')} 张`,
      `各 ${s.perSheet.join('、')} 张`,
    ]),
  ]
}

export function cutListRows(
  task: Task,
  paper: Paper,
  sheets: Sheet[],
  sizeLabelOf: (seq: number) => string,
  splits: SplitInfo[] = [],
): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    ['相纸', `${paper.name} ${paper.wMm}x${paper.hMm}mm`],
    ['隙距 mm', task.gapMm],
    ['刀宽补偿 mm', task.kerfMm],
    ['安全边 mm', task.safeEdgeMm],
    ['禁止拆散（严格模式）', task.strictKeepTogether ? '是' : '否'],
    ['相纸张数', sheets.length],
    ...splitSummaryRows(splits),
    [],
    ['相纸序号', '刀序', '方向', '坐标 mm', '起点 mm', '终点 mm', '长度 mm', '是否共边合并'],
  ]
  for (const s of sheets) {
    s.cutSteps.forEach((c, i) => {
      rows.push([
        s.index + 1,
        i + 1,
        c.axis === 'v' ? '竖切' : '横切',
        Math.round(c.at * 100) / 100,
        Math.round(c.from * 100) / 100,
        Math.round(c.to * 100) / 100,
        Math.round((c.to - c.from) * 100) / 100,
        c.merged ? '是' : '否',
      ])
    })
    rows.push([])
  }
  rows.push([
    '照片编号',
    '所在相纸',
    '尺寸',
    'x mm',
    'y mm',
    '宽 mm',
    '高 mm',
    '旋转',
    '同尺寸拆散',
  ])
  for (const s of sheets) {
    for (const p of s.placements) {
      rows.push([
        p.seq,
        s.index + 1,
        sizeLabelOf(p.seq),
        Math.round(p.x * 100) / 100,
        Math.round(p.y * 100) / 100,
        Math.round(p.w * 100) / 100,
        Math.round(p.h * 100) / 100,
        p.rotated ? '90°' : '无',
        splitMarkOf(p.itemId, splits),
      ])
    }
  }
  return rows
}
