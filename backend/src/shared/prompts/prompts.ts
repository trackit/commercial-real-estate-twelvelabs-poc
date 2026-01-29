import { SegmentAnalysis } from '../../models/segment';
import { calculateMaxWords, truncateText } from '../utils/utils';

export function buildAnalysisPrompt(startSec: number, endSec: number): string {
  return `You are analyzing a single segment of a real-estate walkthrough video.

The full video shows a person walking through a property with a handheld camera.
Focus ONLY on the part of the video between ${startSec} and ${endSec} seconds.

For this time window:

- Identify which area of the property is most clearly visible overall.
- Classify it into one of these room types:
  "Exterior", "Entry", "Living", "Kitchen", "Bedroom", "Bathroom",
  "Hallway", "Stairs", "Balcony", "Garage", "Outdoor", "Other".
- Decide if this segment could be a strong hero shot for a short promotional tour.
- Decide if this segment is mostly a dead or transition moment (corridor with no real view, camera shake, etc.).

Return a JSON object with:
{
  "room_type": "one of the allowed room types",
  "title": "short on-screen label (1-4 words)",
  "appeal_score": number from 0 to 10,
  "is_hero_candidate": boolean,
  "is_transition_only": boolean,
  "short_description": "one short sentence describing what we see"
}

Be strict:
- appeal_score 0–3 = useless or very shaky,
- 4–6 = acceptable but not great,
- 7–10 = visually attractive, good for a promo.`;
}

export function buildVoiceoverPrompt(
  title: string,
  startSec: number,
  endSec: number,
  previousScript: string,
  agencyName?: string,
  streetAddress?: string,
): string {
  const duration = endSec - startSec;
  const maxWords = calculateMaxWords(duration);
  const safePrev = truncateText(previousScript.replace(/"/g, ''), 1200);

  const contextLine = previousScript
    ? `Here is the narration script that has already been spoken before this segment in the tour:
"${safePrev}"
Write the next single sentence that naturally continues this narration, only for the current segment, without explicitly referencing 'previous sentences' or 'as before'.`
    : 'This is the first narration line of the tour.';

  const propertyContext =
    agencyName || streetAddress
      ? `Property Information:
${agencyName ? `- Agency: ${agencyName}` : ''}
${streetAddress ? `- Address: ${streetAddress}` : ''}
`
      : '';

  return `You are writing a single voiceover line for a professional real-estate house tour.

${propertyContext}Segment:
- Title: "${title}"
- Starts at second ${startSec} and ends at second ${endSec} (about ${duration} seconds).

${contextLine}

Write exactly ONE natural English sentence that a real-estate agent could say over this segment:
- Describe what makes this area appealing (space, light, finishes, function).
- Do NOT mention the camera, video, editing, timing, or "segment".
- Do NOT use quotation marks in the sentence.
- No more than ${maxWords} words.

Return a JSON object with:
{
  "voiceover": "your single sentence here"
}`;
}

export function buildSelectionPrompt(candidates: SegmentAnalysis[]): string {
  const candidatesJson = JSON.stringify(candidates, null, 2);

  return `You are an expert short-form real-estate video editor.

You are given an array of candidate segments in JSON:

${candidatesJson}

Each segment object has at least:
- id: integer (original chronological index)
- startTime: number (seconds)
- endTime: number (seconds)
- duration: number (seconds)
- roomType: string (like "Exterior", "Entry", "Living", "Kitchen", "Bedroom", "Bathroom", "Hallway", "Outdoor", etc.)
- title: short on-screen label
- appealScore: number between 0 and 10 (higher means more visually appealing)
- isHeroCandidate: boolean
- isTransitionOnly: boolean
- shortDescription: short natural-language description of what is visible in the segment.

Goal:
Create a concise ~60 second YouTube Shorts style house-tour highlight.
Select only the strongest segments and order them so that the tour feels natural and flows well.

Rules:
- Total sum of durations of selected segments should be close to 60 seconds (between 50 and 70 seconds is acceptable).
- Always start with the best available exterior / approach segment if any.
- Then show entry / foyer.
- Then the most attractive main living areas (living / dining).
- Then the best kitchen views.
- Then, if time allows, one or two of the most appealing bedrooms / bathrooms / special features (balcony, view, staircase, etc.).
- End with a strong closing view (could be exterior, main living area, or kitchen).
- Prefer segments with high appealScore and clear, stable views.
- Avoid redundant segments that show almost the same thing as a better one.
- Keep chronological consistency: within the selected subset, do not reorder segments in a way that feels jarring relative to their id and times. Small swaps are fine, but do not go backwards and forwards many times.

Output:
Return ONLY valid JSON in this exact structure:

{
  "segments": [
    {
      "id": number,
      "title": "string",
      "start_time": number,
      "end_time": number
    }
  ]
}

Do not include any explanation, commentary, Markdown, or code fences.
Only return the pure JSON object.`;
}

export const PEGASUS_ANALYSIS_JSON_SCHEMA = {
  jsonSchema: {
    name: 'segment_analysis',
    schema: {
      type: 'object',
      properties: {
        room_type: { type: 'string' },
        title: { type: 'string' },
        appeal_score: { type: 'number' },
        is_hero_candidate: { type: 'boolean' },
        is_transition_only: { type: 'boolean' },
        short_description: { type: 'string' },
      },
      required: [
        'room_type',
        'title',
        'appeal_score',
        'is_hero_candidate',
        'is_transition_only',
      ],
    },
  },
};

export const PEGASUS_VOICEOVER_JSON_SCHEMA = {
  jsonSchema: {
    name: 'voiceover_response',
    schema: {
      type: 'object',
      properties: {
        voiceover: { type: 'string' },
      },
      required: ['voiceover'],
    },
  },
};
