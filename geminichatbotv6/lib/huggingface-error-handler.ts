// Enhanced error handling for HuggingFace API responses

export class HuggingFaceErrorHandler {
  static parseError(status: number, errorText: string): {
    userMessage: string;
    developerMessage: string;
    action: 'retry' | 'fail' | 'wait' | 'authenticate';
  } {
    // Common HuggingFace error codes
    switch (status) {
      case 401:
        return {
          userMessage: 'Authentication failed. Please check your HuggingFace credentials.',
          developerMessage: `Invalid or missing HF token. Error: ${errorText}`,
          action: 'authenticate'
        };
      
      case 402:
        return {
          userMessage: 'HuggingFace quota exceeded. Please check your billing or upgrade your plan.',
          developerMessage: `Payment required or quota exceeded. Error: ${errorText}`,
          action: 'fail'
        };
      
      case 403:
        return {
          userMessage: 'Access denied. Your token may not have the required permissions.',
          developerMessage: `Token missing required scopes (write, api, inference). Error: ${errorText}`,
          action: 'authenticate'
        };
      
      case 429:
        return {
          userMessage: 'Rate limit exceeded. Please try again in a few minutes.',
          developerMessage: `Rate limit hit. Consider implementing exponential backoff. Error: ${errorText}`,
          action: 'wait'
        };
      
      case 500:
        return {
          userMessage: 'HuggingFace server error. Please try again later.',
          developerMessage: `Internal server error at HF. Error: ${errorText}`,
          action: 'retry'
        };
      
      case 503:
        // Model loading or cold start
        if (errorText.includes('loading') || errorText.includes('starting')) {
          return {
            userMessage: 'The model is starting up. This may take 2-3 minutes for the first request.',
            developerMessage: `Model cold start in progress. Error: ${errorText}`,
            action: 'wait'
          };
        }
        return {
          userMessage: 'HuggingFace service temporarily unavailable. Please try again.',
          developerMessage: `Service unavailable. Error: ${errorText}`,
          action: 'retry'
        };
      
      case 504:
        return {
          userMessage: 'Request timed out. The video generation is taking longer than expected.',
          developerMessage: `Gateway timeout - consider implementing async/polling. Error: ${errorText}`,
          action: 'retry'
        };
      
      default:
        return {
          userMessage: `HuggingFace error (${status}). Please try again or contact support.`,
          developerMessage: `Unexpected status ${status}. Error: ${errorText}`,
          action: 'fail'
        };
    }
  }

  static async handleResponse(response: Response): Promise<any> {
    if (response.ok) {
      return response.json();
    }

    const errorText = await response.text();
    const errorInfo = this.parseError(response.status, errorText);
    
    // Log for developers
    console.error('HuggingFace API Error:', {
      status: response.status,
      ...errorInfo
    });

    // Create user-friendly error
    const error = new Error(errorInfo.userMessage) as any;
    error.status = response.status;
    error.action = errorInfo.action;
    error.developerMessage = errorInfo.developerMessage;
    
    throw error;
  }

  static shouldRetry(error: any): boolean {
    return error.action === 'retry' || error.action === 'wait';
  }

  static getRetryDelay(attempt: number, error: any): number {
    if (error.status === 429) {
      // Rate limit - use exponential backoff
      return Math.min(1000 * Math.pow(2, attempt), 60000); // Max 1 minute
    }
    if (error.status === 503 && error.action === 'wait') {
      // Cold start - wait longer
      return 30000; // 30 seconds
    }
    // Default retry delay
    return Math.min(1000 * attempt, 10000); // Max 10 seconds
  }
}
