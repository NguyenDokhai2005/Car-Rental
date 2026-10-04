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

// Dạng chuẩn của biển số: chỉ chữ và số, viết hoa. "51K-123.45", "51k 123.45" và "51K12345" là cùng một xe,
// nên phải quy về một dạng trước khi kiểm tra trùng và lưu.
export function normalizePlate({ value }: TransformFnParams): unknown {
  return typeof value === "string" ? value.toUpperCase().replace(/[^A-Z0-9]/g, "") : value;
}

// "5,7" hoặc "5, 7" thành ["5", "7"]; phần tử rỗng bị bỏ ("5,,7" và "5," đều thành ["5", "7"] hoặc ["5"]).
export function splitList({ value }: TransformFnParams): unknown {
  return typeof value === "string"
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : value;
}

// Như splitList nhưng đổi từng phần tử sang số. Phần tử không phải số thành NaN để @IsInt từ chối.
export function splitIntList(params: TransformFnParams): unknown {
  const list = splitList(params);
  return Array.isArray(list) ? list.map(Number) : list;
}
