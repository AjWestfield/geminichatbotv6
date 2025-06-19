/**
 * Test data for TTS multi-speaker functionality
 * Contains various multi-speaker scripts for testing different scenarios
 */

export interface TTSTestScript {
  id: string;
  name: string;
  command: string;
  script: string;
  expectedSpeakers: number;
  expectedDuration?: string;
  description: string;
}

export const TTS_TEST_SCRIPTS: TTSTestScript[] = [
  {
    id: 'basic-dialogue',
    name: 'Basic Two-Speaker Dialogue',
    command: 'generate speech for this: [S1] Welcome to our podcast! [S2] Thanks for having me, I\'m excited to be here!',
    script: '[S1] Welcome to our podcast! [S2] Thanks for having me, I\'m excited to be here!',
    expectedSpeakers: 2,
    expectedDuration: '5-10 seconds',
    description: 'Simple two-speaker conversation for basic functionality testing'
  },
  {
    id: 'interview-format',
    name: 'Interview Format',
    command: 'read this aloud: [S1] Today we\'re discussing AI technology. [S2] It\'s fascinating how quickly it\'s evolving. [S1] What do you think is the most exciting development? [S2] I believe natural language processing has made tremendous strides.',
    script: '[S1] Today we\'re discussing AI technology. [S2] It\'s fascinating how quickly it\'s evolving. [S1] What do you think is the most exciting development? [S2] I believe natural language processing has made tremendous strides.',
    expectedSpeakers: 2,
    expectedDuration: '10-15 seconds',
    description: 'Longer dialogue with back-and-forth conversation'
  },
  {
    id: 'three-speakers',
    name: 'Three Speaker Conversation',
    command: 'TTS: [S1] Good morning everyone! [S2] Hello there! [S3] Hey, how\'s everyone doing today?',
    script: '[S1] Good morning everyone! [S2] Hello there! [S3] Hey, how\'s everyone doing today?',
    expectedSpeakers: 3,
    expectedDuration: '8-12 seconds',
    description: 'Testing support for three different speakers'
  },
  {
    id: 'emotional-dialogue',
    name: 'Emotional Dialogue',
    command: 'generate speech: [S1] I can\'t believe we won the championship! [S2] I know, I\'m so excited I could cry!',
    script: '[S1] I can\'t believe we won the championship! [S2] I know, I\'m so excited I could cry!',
    expectedSpeakers: 2,
    expectedDuration: '6-10 seconds',
    description: 'Testing emotional context in dialogue'
  },
  {
    id: 'rapid-exchange',
    name: 'Rapid Exchange',
    command: 'say this: [S1] Yes? [S2] No! [S1] Really? [S2] Absolutely! [S1] Incredible!',
    script: '[S1] Yes? [S2] No! [S1] Really? [S2] Absolutely! [S1] Incredible!',
    expectedSpeakers: 2,
    expectedDuration: '5-8 seconds',
    description: 'Quick back-and-forth exchange testing speaker switching'
  }
];

export const TTS_ERROR_TEST_CASES = [
  {
    id: 'invalid-format',
    name: 'Invalid Speaker Format',
    command: 'generate speech for this: Speaker 1: Hello there! Speaker 2: Hi back!',
    script: 'Speaker 1: Hello there! Speaker 2: Hi back!',
    expectedError: 'Should handle non-standard speaker format gracefully',
    description: 'Testing error handling for incorrect speaker format'
  },
  {
    id: 'single-speaker-fallback',
    name: 'Single Speaker Fallback',
    command: 'read this: Hello world, this is a test without speaker tags.',
    script: 'Hello world, this is a test without speaker tags.',
    expectedError: false,
    description: 'Should fallback to single speaker for text without speaker tags'
  }
];

export const TTS_PERFORMANCE_TEST_CASES = [
  {
    id: 'long-dialogue',
    name: 'Long Multi-Speaker Dialogue',
    command: `generate speech for this: [S1] Welcome to today's discussion about artificial intelligence and its impact on society. [S2] Thank you for having me. I think AI is one of the most transformative technologies of our time. [S1] Could you elaborate on that? What specific areas do you think will be most affected? [S2] Well, I believe we'll see significant changes in healthcare, education, and transportation. Each of these sectors stands to benefit enormously from AI advancements.`,
    script: `[S1] Welcome to today's discussion about artificial intelligence and its impact on society. [S2] Thank you for having me. I think AI is one of the most transformative technologies of our time. [S1] Could you elaborate on that? What specific areas do you think will be most affected? [S2] Well, I believe we'll see significant changes in healthcare, education, and transportation. Each of these sectors stands to benefit enormously from AI advancements.`,
    expectedSpeakers: 2,
    expectedDuration: '30-45 seconds',
    description: 'Long dialogue to test performance and memory handling'
  }
];

/**
 * Helper function to count speakers in a script
 */
export function countSpeakers(script: string): number {
  const speakerPattern = /\[S(\d+)\]/g;
  const speakers = new Set<string>();
  let match;
  
  while ((match = speakerPattern.exec(script)) !== null) {
    speakers.add(match[1]);
  }
  
  return speakers.size;
}