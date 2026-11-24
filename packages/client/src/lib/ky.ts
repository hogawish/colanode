import { HTTPError } from 'ky';

import { ApiErrorCode, ApiErrorOutput } from '@colanode/core';

export const parseApiError = async (
  error: unknown
): Promise<ApiErrorOutput> => {
  if (
    error instanceof Error ||
    (typeof DOMException !== 'undefined' && error instanceof DOMException)
  ) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return {
        code: ApiErrorCode.Unknown,
        message:
          'The server response was interrupted or timed out. Check the current state before retrying.',
      };
    }
    if (
      error instanceof TypeError &&
      /failed to fetch|networkerror|load failed|fetch failed/i.test(
        error.message
      )
    ) {
      return {
        code: ApiErrorCode.Unknown,
        message:
          'Could not reach the server. Check your connection and browser network permissions, and check the current state before retrying.',
      };
    }
  }
  if (error instanceof HTTPError) {
    try {
      const errorData = await error.response.json();
      if (errorData && errorData.code && errorData.message) {
        return errorData as ApiErrorOutput;
      }
    } catch {
      switch (error.response.status) {
        case 401:
          return {
            code: ApiErrorCode.Unauthorized,
            message: 'You are not authorized to perform this action',
          };
        case 403:
          return {
            code: ApiErrorCode.Forbidden,
            message: 'You are forbidden from performing this action',
          };
        case 404:
          return {
            code: ApiErrorCode.NotFound,
            message: 'Resource not found',
          };
        case 400:
          return {
            code: ApiErrorCode.BadRequest,
            message: 'Bad request',
          };
      }
    }
  }

  return {
    code: ApiErrorCode.Unknown,
    message: 'An unknown error occurred',
  };
};
