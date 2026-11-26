/**
 * ColorPicker — 플레이어 보석 색상 선택(P1..P6 팔레트). 대기실/게임/대시보드에서 동일 색 유지.
 */
// 최대 10명 → 보석 색 10종.
export const PLAYER_COLORS = [
  '#ef4444', '#a855f7', '#3b82f6', '#22c55e', '#f59e0b',
  '#94a3b8', '#06b6d4', '#ec4899', '#f97316', '#14b8a6',
] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export function ColorPicker({ value, onChange, taken = [] }: {
  value: PlayerColor | null;
  onChange: (c: PlayerColor) => void;
  taken?: string[];
}) {
  return (
    <div className="colorpick">
      {PLAYER_COLORS.map((c) => {
        const isTaken = taken.includes(c) && c !== value;
        return (
          <button
            key={c}
            type="button"
            disabled={isTaken}
            className={`colorpick__gem${value === c ? ' is-on' : ''}${isTaken ? ' is-taken' : ''}`}
            style={{ ['--gem' as string]: c }}
            onClick={() => onChange(c)}
            aria-label={`색상 ${c}`}
          />
        );
      })}
    </div>
  );
}
