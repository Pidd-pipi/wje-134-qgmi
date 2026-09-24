import { ApiResponse } from '../types/interfaces';

export function ok<T>(data: T, message = 'success', requestId?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    requestId
  };
}

export function fail(message: string, requestId?: string): ApiResponse<never> {
  return {
    success: false,
    message,
    requestId
  };
}
