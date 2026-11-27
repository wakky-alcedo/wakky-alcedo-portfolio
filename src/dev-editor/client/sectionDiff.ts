/**
 * 見出しで区切って取る差分（unifiedMergeView の diffConfig.override に渡す）。
 *
 * 文字単位の差分を記事全体で一度に取ると、変更が多いときに近くの変更がつながって1つの大きな塊になる。
 * そこで、両方の版に同じ文面で残っている見出しの行を目印にして（順番を保つ最長の組み合わせ）、
 * 見出しと見出しの間ごとに差分を取る。目印の見出しの行は変更に含まれないので、塊は見出しのところで分かれる。
 */
import { Change, diff, type DiffConfig } from '@codemirror/merge';

interface Heading {
  text: string;
  /** 行の先頭 */
  from: number;
  /** 改行の次 */
  to: number;
}

const HEADING = /^#{1,6}\s/;
const FENCE = /^(```|~~~)/;

/** 見出しの行（コードブロックの中は除く） */
function headings(text: string): Heading[] {
  const result: Heading[] = [];
  let inFence = false;
  for (let from = 0; from < text.length;) {
    const nl = text.indexOf('\n', from);
    const to = nl < 0 ? text.length : nl + 1;
    const line = text.slice(from, nl < 0 ? text.length : nl);
    if (FENCE.test(line)) inFence = !inFence;
    else if (!inFence && HEADING.test(line)) result.push({ text: line.trimEnd(), from, to });
    from = to;
  }
  return result;
}

/** 両方にある見出しを、順番を保って最も多く組み合わせる（最長共通部分列） */
function matchHeadings(a: Heading[], b: Heading[]): [Heading, Heading][] {
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i].text === b[j].text ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs: [Heading, Heading][] = [];
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i].text === b[j].text) pairs.push([a[i++], b[j++]]);
    else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

/** 見出しの間ごとの差分。sectionConfig は区間ごとの差分に渡す設定（override は入れない） */
export function sectionDiff(sectionConfig: Omit<DiffConfig, 'override'>) {
  return (a: string, b: string): readonly Change[] => {
    const changes: Change[] = [];
    const add = (fromA: number, toA: number, fromB: number, toB: number) => {
      for (const c of diff(a.slice(fromA, toA), b.slice(fromB, toB), sectionConfig)) {
        changes.push(new Change(c.fromA + fromA, c.toA + fromA, c.fromB + fromB, c.toB + fromB));
      }
    };
    let posA = 0;
    let posB = 0;
    for (const [ha, hb] of matchHeadings(headings(a), headings(b))) {
      add(posA, ha.from, posB, hb.from);
      posA = ha.to;
      posB = hb.to;
    }
    add(posA, a.length, posB, b.length);
    return changes;
  };
}
