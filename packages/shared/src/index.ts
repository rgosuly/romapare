export const APP_NAME = "Romapare";

export type ApiResponse<T> = {
  data: T;
  error: null;
} | {
  data: null;
  error: string;
};
