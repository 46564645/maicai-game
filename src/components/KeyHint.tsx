/**
 * KeyHint.tsx —— 选项左侧的圆形数字键徽标（ww 线框：1/2/3）。
 */
export function KeyHint({ value }: { value: string }) {
  return (
    <span className="key-hint" aria-hidden="true">
      {value}
    </span>
  );
}
