/**
 * types.ts —— 字典同构类型：zh 字典必须与 en 字典键结构完全一致，
 * 叶子类型放宽为 string（en 是 as const 字面量，zh 是普通译文）。
 */
import type { enStrings } from './en';

export type DeepString<T> =
  T extends string
    ? string
    : T extends readonly (infer U)[]
      ? readonly DeepString<U>[]
      : T extends object
        ? { readonly [K in keyof T]: DeepString<T[K]> }
        : T;

export type StringsDict = DeepString<typeof enStrings>;
