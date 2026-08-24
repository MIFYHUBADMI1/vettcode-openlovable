/**
 * Token estimation utility
 * 1 token = 1 character sent/received to AI
 */

export interface TokenEstimate {
  promptTokens: number;
  scrapedContentTokens: number;
  estimatedResponseTokens: number;
  totalEstimated: number;
  requiredBalance: number; // 3x the total
}

/**
 * Estimate tokens for a website clone operation
 */
export function estimateCloneTokens(
  prompt: string,
  scrapedContent: string,
  systemPrompt?: string
): TokenEstimate {
  // Count characters (1 char = 1 token in our system)
  const promptTokens = prompt.length;
  const scrapedContentTokens = scrapedContent.length;
  const systemPromptTokens = systemPrompt?.length || 0;
  
  // Estimate response size (usually similar to input for code generation)
  // Conservative estimate: response is typically 1.5x the input
  const estimatedResponseTokens = Math.ceil(
    (promptTokens + scrapedContentTokens + systemPromptTokens) * 1.5
  );
  
  const totalEstimated = promptTokens + scrapedContentTokens + systemPromptTokens + estimatedResponseTokens;
  
  // User needs 3x the estimated tokens
  const requiredBalance = totalEstimated * 3;
  
  return {
    promptTokens,
    scrapedContentTokens,
    estimatedResponseTokens,
    totalEstimated,
    requiredBalance,
  };
}

/**
 * Calculate actual tokens used from AI response
 */
export function calculateActualTokens(
  prompt: string,
  scrapedContent: string,
  aiResponse: string,
  systemPrompt?: string
): number {
  const promptTokens = prompt.length;
  const scrapedContentTokens = scrapedContent.length;
  const systemPromptTokens = systemPrompt?.length || 0;
  const responseTokens = aiResponse.length;
  
  return promptTokens + scrapedContentTokens + systemPromptTokens + responseTokens;
}

/**
 * Check if user has sufficient tokens
 */
export function hassufficientTokens(
  userBalance: number,
  estimate: TokenEstimate
): { sufficient: boolean; shortage: number } {
  const sufficient = userBalance >= estimate.requiredBalance;
  const shortage = sufficient ? 0 : estimate.requiredBalance - userBalance;
  
  return { sufficient, shortage };
}

/**
 * Format token amount for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}
