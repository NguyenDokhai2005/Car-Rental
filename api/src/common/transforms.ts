import { TransformFnParams } from "class-transformer";

export function trim({ value }: TransformFnParams): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export function normalizeEmail({ value }: TransformFnParams): unknown {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

// "09xx xxx xxx", "09xx.xxx.xxx", "09xx-xxx-xxx" đều về dạng liền "09xxxxxxxx".
export function normalizePhone({ value }: TransformFnParams): unknown {
  return typeof value === "string" ? value.replace(/[\s.-]/g, "") : value;
}

export const PHONE_PATTERN = /^(\+84|0)\d{9}$/;
export const PHONE_MESSAGE = "Số điện thoại không hợp lệ (ví dụ 0901234567 hoặc +84901234567).";
