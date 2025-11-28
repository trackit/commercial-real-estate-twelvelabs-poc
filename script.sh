#!/usr/bin/env bash
#
# script.sh
#
# End-to-end pipeline to:
#  - retrieve Marengo segments from a TwelveLabs index
#  - annotate each segment with Pegasus (room type + appeal score)
#  - select the best segments (~60s total) via Gemini
#  - generate per-segment voiceover with Pegasus
#  - synthesize audio via AWS Polly or ElevenLabs
#  - overlay labels and concatenate with ffmpeg into a final short video
#
# Requirements:
#  - bash, curl, jq, ffmpeg, aws CLI (if using Polly)
#  - TwelveLabs API key
#  - Google Gemini API key
#  - AWS credentials with polly:SynthesizeSpeech (if using Polly)
#  - ElevenLabs API key (if using ElevenLabs)
#
# Usage:
#  - Adjust the CONFIG section below or set env vars.
#  - Run: bash script.sh
#

if [ -f ".env" ]; then
  set -a
  . ".env"
  set +a
fi

########################################
# 1) CONFIG – EDIT THESE (or use env)
########################################

API_KEY="${TL_API_KEY:-"CHANGE_ME_TWELVELABS_API_KEY"}"
VIDEO_ID="${TL_VIDEO_ID:-"CHANGE_ME_VIDEO_ID"}"
INDEX_ID="${TL_INDEX_ID:-"CHANGE_ME_INDEX_ID"}"

# Local video paths
VIDEO_PATH="${VIDEO_PATH:-"CHANGE_ME_VIDEO_PATH.mp4"}"
OUTPUT_PATH="${OUTPUT_PATH:-"CHANGE_ME_OUTPUT_PATH.mp4"}"

# Font for ffmpeg drawtext
FONT_PATH="./DejaVuSans-Bold.ttf"

# TTS provider: "polly" (default) or "elevenlabs"
TTS_PROVIDER="${TTS_PROVIDER:-"elevenlabs"}"

# AWS Polly config
POLLY_VOICE_ID="${POLLY_VOICE_ID:-"Joanna"}"

# ElevenLabs config
ELEVENLABS_API_KEY="${ELEVENLABS_API_KEY:-""}"
ELEVENLABS_VOICE_ID="${ELEVENLABS_VOICE_ID:-"CHANGE_ME_ELEVENLABS_VOICE_ID"}"

# Gemini config (API key from env)
GEMINI_API_KEY="${GEMINI_API_KEY:-"CHANGE_ME_GEMINI_API_KEY"}"

# Max number of parallel ffmpeg + TTS jobs
MAX_JOBS="${MAX_JOBS:-1}"

# Max number of parallel Pegasus annotation jobs (per-segment scoring)
MAX_ANN_JOBS="${MAX_ANN_JOBS:-40}"

########################################
# 2) DYNAMIC BEHAVIOR (PROMPTS, LABELS)
########################################

# Prompt builder for PER-SEGMENT voiceover Pegasus calls
build_voiceover_prompt() {
  local title="$1"
  local start_norm="$2"
  local end_norm="$3"
  local duration="$4"
  local max_words="$5"
  local previous_script="$6"

  local context_line
  if [ -n "$previous_script" ]; then
    context_line="Here is the narration script that has already been spoken before this segment in the tour:\n\"$previous_script\"\nWrite the next single sentence that naturally continues this narration, only for the current segment, without explicitly referencing 'previous sentences' or 'as before'."
  else
    context_line="This is the first narration line of the tour."
  fi

  cat << EOF
You are writing a single voiceover line for a professional real-estate house tour.

Segment:
- Title: "$title"
- Starts at second $start_norm and ends at second $end_norm (about $duration seconds).

$context_line

Write exactly ONE natural English sentence that a real-estate agent could say over this segment:
- Describe what makes this area appealing (space, light, finishes, function).
- Do NOT mention the camera, video, editing, timing, or "segment".
- Do NOT use quotation marks in the sentence.
- No more than $max_words words.
EOF
}

# Pegasus: write a single voiceover sentence for a segment
pegasus_voiceover() {
  local title="$1"
  local start_norm="$2"
  local end_norm="$3"
  local narration_so_far="$4"

  # Approx allowed max words based on duration (2.5 words/sec, min 5)
  local duration
  duration=$(awk -v s="$start_norm" -v e="$end_norm" 'BEGIN { print e - s }')
  local max_words
  max_words=$(awk -v d="$duration" 'BEGIN { m = int(d * 2.5); if (m < 5) m = 5; print m }')

  # Sanitize / truncate previous script
  local safe_prev=${narration_so_far//\"/}
  safe_prev=$(printf '%s' "$safe_prev" | awk '{ if (length($0) > 1200) print substr($0, length($0)-1199); else print $0 }')

  local prompt_vo
  prompt_vo=$(build_voiceover_prompt "$title" "$start_norm" "$end_norm" "$duration" "$max_words" "$safe_prev")

  local request_vo
  request_vo=$(jq -n \
    --arg video_id "$VIDEO_ID" \
    --arg prompt "$prompt_vo" '
    {
      video_id: $video_id,
      prompt: $prompt,
      temperature: 0.4,
      stream: false,
      response_format: {
        "type": "json_schema",
        "json_schema": {
          "type": "object",
          "properties": {
            "voiceover": { "type": "string" }
          },
          "required": ["voiceover"]
        }
      },
      max_tokens: 128
    }')

  local response_vo
  response_vo=$(curl -s -X POST "https://api.twelvelabs.io/v1.3/analyze" \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$request_vo")

  if echo "$response_vo" | jq -e '.error' >/dev/null 2>&1; then
    echo "  !! Pegasus voiceover error for segment \"$title\":" >&2
    echo "$response_vo" | jq '.error' >&2
    echo ""
    return
  fi

  echo "$response_vo" | jq -r '
    .data
    | (if type == "string" then (fromjson) else . end)
    | .voiceover // ""
  '
}

# Pegasus: annotate ONE Marengo scene with type + score
pegasus_annotate_segment() {
  local idx="$1"
  local start="$2"
  local end="$3"

  local duration
  duration=$(awk -v s="$start" -v e="$end" 'BEGIN { print e - s }')

  local prompt
  prompt=$(cat << EOF
You are analyzing a single segment of a real-estate walkthrough video.

The full video shows a person walking through a property with a handheld camera.
Focus ONLY on the part of the video between $start and $end seconds.

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
- 7–10 = visually attractive, good for a promo.
EOF
)

  local request_json
  request_json=$(jq -n \
    --arg video_id "$VIDEO_ID" \
    --arg prompt "$prompt" '
    {
      video_id: $video_id,
      prompt: $prompt,
      temperature: 0.0,
      stream: false,
      response_format: {
        "type": "json_schema",
        "json_schema": {
          "type": "object",
          "properties": {
            "room_type": { "type": "string" },
            "title": { "type": "string" },
            "appeal_score": { "type": "number" },
            "is_hero_candidate": { "type": "boolean" },
            "is_transition_only": { "type": "boolean" },
            "short_description": { "type": "string" }
          },
          "required": ["room_type","title","appeal_score","is_hero_candidate","is_transition_only"]
        }
      },
      max_tokens: 256
    }')

  local response
  response=$(curl -s -X POST "https://api.twelvelabs.io/v1.3/analyze" \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$request_json")

  if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
    echo "  !! Pegasus annotation error for segment $idx ($start -> $end):" >&2
    echo "$response" | jq '.error' >&2
    return 1
  fi

  echo "$response" | jq -c '
    .data
    | (if type == "string" then (fromjson) else . end)
  '
}

# Prompt for Gemini: choose best segments & order for ~60s promo
build_gemini_selection_prompt() {
  local candidates_json="$1"
  cat <<EOF
You are an expert short-form real-estate video editor.

You are given an array of candidate segments in JSON:

$candidates_json

Each segment object has at least:
- id: integer (original chronological index)
- start_time: number (seconds)
- end_time: number (seconds)
- duration: number (seconds)
- room_type: string (like "Exterior", "Entry", "Living", "Kitchen", "Bedroom", "Bathroom", "Hallway", "Outdoor", etc.)
- title: short on-screen label
- appeal_score: number between 0 and 10 (higher means more visually appealing)
- is_hero_candidate: boolean
- is_transition_only: boolean
- short_description: short natural-language description of what is visible in the segment.

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
- Prefer segments with high appeal_score and clear, stable views.
- Avoid redundant segments that show almost the same thing as a better one.
- Keep chronological consistency: within the selected subset, do not reorder segments in a way that feels jarring relative to their id and times. Small swaps are fine, but do not go backwards and forwards many times.

Output:
Return ONLY valid JSON in this exact structure:

{
  "segments": [
    {
      "id": number,          // must be one of the ids from the input objects
      "title": "string",     // copy from the chosen input object
      "start_time": number,  // copy from the chosen input object
      "end_time": number     // copy from the chosen input object
    },
    ...
  ]
}

Do not include any explanation, commentary, Markdown, or code fences.
Only return the pure JSON object.
EOF
}

# Agency + street labels for branding
pick_agency_and_street() {
  local agencies=(
    "Skyline Estates"
    "Aurora Home Studio"
    "PrimeNest Realty"
    "UrbanVista Media"
    "Horizon House Tours"
  )

  local streets=(
    "12 Oakwood Lane"
    "45 Sunset Boulevard"
    "78 Riverside Drive"
    "23 Maple Avenue"
    "91 Cedar Street"
    "5 Willow Park"
    "34 Hillside Crescent"
  )

  local agency_name="${agencies[$((RANDOM % ${#agencies[@]}))]}"
  local street_name="${streets[$((RANDOM % ${#streets[@]}))]}"

  # Sanitize for drawtext
  local agency_label=${agency_name//\'/}
  agency_label=${agency_label//:/-}
  local street_label=${street_name//\'/}
  street_label=${street_label//:/-}

  echo "$agency_label;$street_label"
}

synthesize_tts_audio() {
  local text="$1"
  local text_file="$2"
  local output_path="$3"

  case "$TTS_PROVIDER_NORMALIZED" in
    polly)
      aws polly synthesize-speech \
        --output-format mp3 \
        --voice-id "$POLLY_VOICE_ID" \
        --text "file://$text_file" \
        "$output_path" >/dev/null 2>&1
      ;;
    elevenlabs)
      local eleven_payload
      eleven_payload=$(jq -n --arg txt "$text" '
        {
          text: $txt,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.35,
            similarity_boost: 0.6,
            speed: 1.2
          }
        }
      ')

      curl -s -X POST \
        -H "xi-api-key: $ELEVENLABS_API_KEY" \
        -H "Content-Type: application/json" \
        -H "Accept: audio/mpeg" \
        -d "$eleven_payload" \
        "https://api.elevenlabs.io/v1/text-to-speech/$ELEVENLABS_VOICE_ID/stream" \
        -o "$output_path"
      ;;
    *)
      return 1
      ;;
  esac

  # Fichier vide → échec
  if [ ! -s "$output_path" ]; then
    return 1
  fi

  # Vérif rapide pour ElevenLabs : si ça ne commence pas par ID3 (header MP3),
  # c'est probablement un JSON d'erreur → on considère que c'est un échec.
  if [ "$TTS_PROVIDER_NORMALIZED" = "elevenlabs" ]; then
    local header
    header=$(head -c 3 "$output_path" 2>/dev/null || true)

    if [ "$header" != $'ID3' ]; then
      echo "  [TTS] ElevenLabs did not return valid MP3, first bytes were:" >&2
      head -c 200 "$output_path" >&2 || true
      echo >&2
      rm -f "$output_path"
      return 1
    fi
  fi

  return 0
}

# Per-segment processing: cut video, overlay text, generate TTS audio, merge
process_segment() {
  local i="$1"
  local title="$2"
  local start_norm="$3"
  local end_norm="$4"
  local voice_text="$5"
  local tmp_dir="$6"

  if [ -z "$title" ] || [ -z "$start_norm" ] || [ -z "$end_norm" ]; then
    return
  fi

  echo "  [JOB $i] Processing \"$title\" ($start_norm -> $end_norm)"

  local video_no_audio="$tmp_dir/part_${i}_video.mp4"
  local audio_file="$tmp_dir/part_${i}_audio.mp3"
  local final_seg="$tmp_dir/part_${i}.mp4"

  # Room label for on-screen text
  local ROOM_LABEL
  ROOM_LABEL=$(echo "$title" | tr '[:lower:]' '[:upper:]')
  ROOM_LABEL=${ROOM_LABEL//\'/}
  ROOM_LABEL=${ROOM_LABEL//:/-}

  local ROOM_TEXT_FILTER="drawtext=fontfile=$FONT_PATH:text='$ROOM_LABEL':x=w-text_w-40:y=h-text_h-40:fontsize=48:fontcolor=white:bordercolor=black:borderw=3:shadowx=2:shadowy=2"

  local FILTER
  if [ "$i" -eq "$ENTRY_IDX" ]; then
    local AGENCY_TEXT_FILTER="drawtext=fontfile=$FONT_PATH:text='$AGENCY_LABEL':x=(w-text_w)/2:y=h*0.15-60:fontsize=64:fontcolor=white:bordercolor=black:borderw=5:shadowx=3:shadowy=3"
    local STREET_TEXT_FILTER="drawtext=fontfile=$FONT_PATH:text='$STREET_LABEL':x=(w-text_w)/2:y=h*0.15:fontsize=48:fontcolor=white:bordercolor=black:borderw=4:shadowx=3:shadowy=3"
    FILTER="$AGENCY_TEXT_FILTER,$STREET_TEXT_FILTER,$ROOM_TEXT_FILTER"
  else
    FILTER="$ROOM_TEXT_FILTER"
  fi

  # 1) Cut video segment with overlays, no original audio
  ffmpeg -nostdin -loglevel error -y \
    -ss "$start_norm" -to "$end_norm" \
    -i "$VIDEO_PATH" \
    -vf "$FILTER" \
    -an \
    -c:v libx264 -preset veryfast -crf 18 \
    -movflags +faststart \
    "$video_no_audio"

  # 2) Generate voiceover audio with configured TTS provider if we have text
  if [ -n "$voice_text" ]; then
    local voice_text_file="$tmp_dir/vo_${i}.txt"
    printf '%s' "$voice_text" > "$voice_text_file"

    if ! synthesize_tts_audio "$voice_text" "$voice_text_file" "$audio_file"; then
      echo "  [JOB $i] TTS provider \"$TTS_PROVIDER\" returned empty audio or failed, keeping silent segment."
      cp "$video_no_audio" "$final_seg"
      return
    fi

    # 3) Merge video and audio (shortest so audio never exceeds segment length)
    ffmpeg -nostdin -loglevel error -y \
      -i "$video_no_audio" -i "$audio_file" \
      -c:v copy \
      -c:a aac -b:a 128k \
      -shortest \
      -movflags +faststart \
      "$final_seg"
  else
    # If no voiceover text, keep a silent version
    cp "$video_no_audio" "$final_seg"
  fi
}


########################################
# 3) RUNTIME CHECKS
########################################

TTS_PROVIDER_NORMALIZED=$(printf '%s' "$TTS_PROVIDER" | tr '[:upper:]' '[:lower:]')

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found. Please install ffmpeg."
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl not found. Please install curl."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq not found. Please install jq."
  exit 1
fi

case "$TTS_PROVIDER_NORMALIZED" in
  polly)
    if ! command -v aws >/dev/null 2>&1; then
      echo "aws CLI not found. Please install and configure AWS CLI (Polly), or set TTS_PROVIDER=elevenlabs."
      exit 1
    fi
    ;;
  elevenlabs)
    if [ -z "$ELEVENLABS_API_KEY" ]; then
      echo "ELEVENLABS_API_KEY is not set. Please export it to use ElevenLabs TTS."
      exit 1
    fi
    if [ -z "$ELEVENLABS_VOICE_ID" ] || [ "$ELEVENLABS_VOICE_ID" = "CHANGE_ME_ELEVENLABS_VOICE_ID" ]; then
      echo "ELEVENLABS_VOICE_ID is not set. Please export it to use ElevenLabs TTS."
      exit 1
    fi
    ;;
  *)
    echo "Unsupported TTS_PROVIDER \"$TTS_PROVIDER\". Use \"polly\" or \"elevenlabs\"."
    exit 1
    ;;
esac

if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "CHANGE_ME_GEMINI_API_KEY" ]; then
  echo "GEMINI_API_KEY is not set. Please export your Gemini API key:"
  echo "  export GEMINI_API_KEY=\"your_api_key_here\""
  exit 1
fi

if [ -z "$API_KEY" ] || [ "$API_KEY" = "CHANGE_ME_TWELVELABS_API_KEY" ]; then
  echo "TL_API_KEY / API_KEY is not set. Please export TL_API_KEY or edit the script."
  exit 1
fi


########################################
# 4) TEMP DIR
########################################

TMP_DIR=$(mktemp -d)
LIST_FILE="$TMP_DIR/segments.txt"


########################################
# 5) MARENGO SCENES (CANDIDATES)
########################################

echo "Retrieving Marengo scene segments from index..."
VIDEO_INFO=$(curl -s -G "https://api.twelvelabs.io/v1.3/indexes/$INDEX_ID/videos/$VIDEO_ID" \
  -H "x-api-key: $API_KEY" \
  --data-urlencode "embedding_option=visual")

if echo "$VIDEO_INFO" | jq -e '.code? // empty' >/dev/null 2>&1; then
  echo "!! TwelveLabs index API returned an error:"
  echo "$VIDEO_INFO" | jq '.'
  exit 1
fi

RAW_SEGMENTS_JSON=$(echo "$VIDEO_INFO" | jq '.embedding.video_embedding.segments // []')

SEG_COUNT=$(echo "$RAW_SEGMENTS_JSON" | jq 'length')
echo "---------------- MARENGO segments summary ----------------"
echo "Total segments: $SEG_COUNT"
echo "First 5 segments (start/end only):"
echo "$RAW_SEGMENTS_JSON" | jq 'sort_by(.start_offset_sec)[0:5] | map({start_offset_sec, end_offset_sec})'
echo "----------------------------------------------------------"

if [ "$SEG_COUNT" -eq 0 ]; then
  echo "No embedding segments found. Check INDEX_ID/VIDEO_ID and that the index uses a Marengo model with visual embeddings."
  exit 1
fi

MARSEGS_TSV=$(
  echo "$RAW_SEGMENTS_JSON" | jq -r '
    sort_by(.start_offset_sec)[]
    | "\(.start_offset_sec)\t\(.end_offset_sec)"
  '
)

echo "Using temp directory: $TMP_DIR"


########################################
# 6) PASS 1 – ANNOTATE EACH CANDIDATE SEGMENT WITH PEGASUS (PARALLEL)
########################################

echo "Annotating Marengo segments with Pegasus (room type + appeal score) in parallel..."

ENRICHED_JSONL="$TMP_DIR/segments_enriched.jsonl"
> "$ENRICHED_JSONL"

seg_idx=0
ann_pids=()

# MARSEGS_TSV: lines of "start<TAB>end"
while IFS=$'\t' read -r start end; do
  # Skip invalid raw segments
  if [ -z "$start" ] || [ -z "$end" ]; then
    seg_idx=$((seg_idx + 1))
    continue
  fi

  # Normalize times: ensure start < end and positive duration
  if ! read -r start_norm end_norm < <(
    awk -v s="$start" -v e="$end" 'BEGIN {
      if (e < s) { t=s; s=e; e=t; }
      d=e-s;
      if (d <= 0) exit 1;
      print s, e;
    }'
  ); then
    seg_idx=$((seg_idx + 1))
    continue
  fi

  duration=$(awk -v s="$start_norm" -v e="$end_norm" 'BEGIN { print e - s }')

  echo "  [ANN] $seg_idx ($start_norm -> $end_norm)"

  {
    annotated_json=$(pegasus_annotate_segment "$seg_idx" "$start_norm" "$end_norm" || echo "")
    if [ -z "$annotated_json" ]; then
      exit 0
    fi

    # Wrap Pegasus annotation into our enriched JSON schema for this segment
    printf '%s\n' "$annotated_json" | jq -c \
      --arg id "$seg_idx" \
      --arg start "$start_norm" \
      --arg end "$end_norm" \
      --arg dur "$duration" '
        . as $m
        | {
            id: ($id | tonumber),
            start_time: ($start | tonumber),
            end_time: ($end | tonumber),
            duration: ($dur | tonumber),
            room_type: $m.room_type,
            title: $m.title,
            appeal_score: $m.appeal_score,
            is_hero_candidate: $m.is_hero_candidate,
            is_transition_only: $m.is_transition_only,
            short_description: ($m.short_description // "")
          }
      ' > "$TMP_DIR/ann_${seg_idx}.json"
  } &

  ann_pids+=("$!")

  # Throttle concurrency
  if (( ${#ann_pids[@]} >= MAX_ANN_JOBS )); then
    wait "${ann_pids[0]}" || true
    ann_pids=("${ann_pids[@]:1}")
  fi

  seg_idx=$((seg_idx + 1))
done <<< "$MARSEGS_TSV"

# Wait for all remaining annotation jobs
for pid in "${ann_pids[@]}"; do
  wait "$pid" || true
done

# Merge per-segment ann_<idx>.json into a single JSONL file in index order
for ((i=0; i<seg_idx; i++)); do
  if [ -f "$TMP_DIR/ann_${i}.json" ]; then
    cat "$TMP_DIR/ann_${i}.json" >> "$ENRICHED_JSONL"
  fi
done


########################################
# 7) BUILD ENRICHED ARRAY & FILTER FOR GEMINI
########################################

if [ ! -s "$ENRICHED_JSONL" ]; then
  echo "No segments could be annotated by Pegasus."
  exit 1
fi

# Build a single JSON array from the JSONL file
ENRICHED_JSON=$(jq -s '.' "$ENRICHED_JSONL")
TOTAL_ENRICHED=$(echo "$ENRICHED_JSON" | jq 'length')
echo "Pegasus annotated $TOTAL_ENRICHED segments."

# Filter out pure transitions and segments with non-positive appeal_score
CANDIDATES_FOR_GEMINI_JSON=$(echo "$ENRICHED_JSON" | jq '
  map(
    select(
      (.appeal_score // 0) > 0
      and
      (.is_transition_only | not)
    )
  )
')
CANDIDATE_COUNT=$(echo "$CANDIDATES_FOR_GEMINI_JSON" | jq 'length')
echo "After filtering, $CANDIDATE_COUNT candidates remain for Gemini selection."

if [ "$CANDIDATE_COUNT" -eq 0 ]; then
  echo "No candidates left after filtering, falling back to all enriched segments."
  CANDIDATES_FOR_GEMINI_JSON="$ENRICHED_JSON"
  CANDIDATE_COUNT="$TOTAL_ENRICHED"
fi


########################################
# 8) GEMINI SELECTION – PICK BEST SEGMENTS (~60s)
########################################

# Quick sanity check
if [ -z "${CANDIDATES_FOR_GEMINI_JSON:-}" ] || \
   [ "$(printf '%s\n' "$CANDIDATES_FOR_GEMINI_JSON" | jq 'length')" -eq 0 ]; then
  echo "!! Gemini selection: CANDIDATES_FOR_GEMINI_JSON is empty."
  exit 1
fi

echo "Calling Gemini to pick and order the best segments for a ~60s short..."

# Build prompt text with the candidate JSON inlined as plain text
GEMINI_PROMPT=$(build_gemini_selection_prompt "$CANDIDATES_FOR_GEMINI_JSON")

# Build Gemini request body
GEMINI_REQUEST=$(jq -n --arg text "$GEMINI_PROMPT" '{
  contents: [
    {
      role: "user",
      parts: [ { text: $text } ]
    }
  ]
}')

# Call Gemini API
GEMINI_RESPONSE=$(
  curl -s -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$GEMINI_REQUEST"
)

# Check for API-level error
if echo "$GEMINI_RESPONSE" | jq -e 'has("error")' >/dev/null 2>&1; then
  echo "!! Gemini selection error (API error):"
  echo "$GEMINI_RESPONSE" | jq '.error'
  exit 1
fi

# Extract the text returned by Gemini
GEMINI_TEXT=$(echo "$GEMINI_RESPONSE" | jq -r '.candidates[0].content.parts[0].text // empty')

if [ -z "$GEMINI_TEXT" ]; then
  echo "!! Gemini selection error: empty response text."
  exit 1
fi

# In case Gemini still wraps the JSON in ``` fences, strip them
GEMINI_TEXT_CLEAN=$(
  printf '%s\n' "$GEMINI_TEXT" \
    | sed -e 's/^```json[[:space:]]*//g' \
          -e 's/^```[[:space:]]*//g' \
          -e 's/```[[:space:]]*$//g'
)

# Parse JSON and extract the "segments" array
FINAL_SEGMENTS_JSON=$(printf '%s\n' "$GEMINI_TEXT_CLEAN" | jq '.segments') || {
  echo "!! Gemini selection error: could not parse JSON from response."
  echo "Raw Gemini text was:"
  echo "$GEMINI_TEXT"
  exit 1
}

FINAL_SEG_COUNT=$(printf '%s\n' "$FINAL_SEGMENTS_JSON" | jq 'length')
echo "Gemini selected $FINAL_SEG_COUNT segments for the ~60s short."

if [ "$FINAL_SEG_COUNT" -eq 0 ]; then
  echo "!! Gemini selection returned 0 segments."
  exit 1
fi


########################################
# 9) CONVERT GEMINI RESULT INTO ARRAYS
#    (SEG_TITLES / SEG_STARTS / SEG_ENDS)
########################################

unset SEG_TITLES SEG_STARTS SEG_ENDS SEG_VOICES
declare -a SEG_TITLES SEG_STARTS SEG_ENDS SEG_VOICES

idx=0
while read -r seg; do
  title=$(echo "$seg"  | jq -r '.title')
  start=$(echo "$seg"  | jq -r '.start_time')
  end=$(echo "$seg"    | jq -r '.end_time')

  # basic sanity
  if [ -z "$title" ] || [ -z "$start" ] || [ -z "$end" ]; then
    continue
  fi

  SEG_TITLES[$idx]="$title"
  SEG_STARTS[$idx]="$start"
  SEG_ENDS[$idx]="$end"
  idx=$((idx + 1))
done < <(printf '%s\n' "$FINAL_SEGMENTS_JSON" | jq -c '.[]')


########################################
# 10) BRANDING (AGENCY + STREET) & INTRO SEGMENT
########################################

IFS=';' read -r AGENCY_LABEL STREET_LABEL <<< "$(pick_agency_and_street)"

ENTRY_IDX=-1
for i in "${!SEG_TITLES[@]}"; do
  title="${SEG_TITLES[$i]}"
  if [[ "$title" =~ [Ee]xterior || "$title" =~ [Ff]ront || "$title" =~ [Oo]utdoor ]]; then
    ENTRY_IDX=$i
    break
  fi
done

if [ "$ENTRY_IDX" -lt 0 ]; then
  ENTRY_IDX=0
fi

echo "Using intro overlay: $AGENCY_LABEL – $STREET_LABEL (intro segment index: $ENTRY_IDX)"


########################################
# 11) PASS 1 – PEGASUS VOICEOVER TEXTS (SEQUENTIAL)
########################################

echo "Generating voiceover script with Pegasus (sequential for coherence)..."

VO_HISTORY=""

for i in "${!SEG_TITLES[@]}"; do
  title="${SEG_TITLES[$i]}"
  start="${SEG_STARTS[$i]}"
  end="${SEG_ENDS[$i]}"

  if [ -z "$title" ] || [ -z "$start" ] || [ -z "$end" ]; then
    SEG_TITLES[$i]=""
    SEG_STARTS[$i]=""
    SEG_ENDS[$i]=""
    SEG_VOICES[$i]=""
    continue
  fi

  if ! read -r start_norm end_norm < <(
    awk -v s="$start" -v e="$end" 'BEGIN {
      if (e < s) { t=s; s=e; e=t; }
      d=e-s;
      if (d <= 0) exit 1;
      print s, e;
    }'
  ); then
    echo "  [VO] Skipping invalid duration: $title ($start -> $end)"
    SEG_TITLES[$i]=""
    SEG_STARTS[$i]=""
    SEG_ENDS[$i]=""
    SEG_VOICES[$i]=""
    continue
  fi

  SEG_STARTS[$i]="$start_norm"
  SEG_ENDS[$i]="$end_norm"

  echo "  [VO] $i: $title ($start_norm -> $end_norm)"

  VOICEOVER_TEXT=$(pegasus_voiceover "$title" "$start_norm" "$end_norm" "$VO_HISTORY" || echo "")

  if [ -n "$VOICEOVER_TEXT" ]; then
    SEG_VOICES[$i]="$VOICEOVER_TEXT"
    if [ -n "$VO_HISTORY" ]; then
      VO_HISTORY="$VO_HISTORY $VOICEOVER_TEXT"
    else
      VO_HISTORY="$VOICEOVER_TEXT"
    fi
  else
    SEG_VOICES[$i]=""
  fi
done


########################################
# 12) PASS 2 – CUT, POLLY TTS, MERGE (PARALLEL)
########################################

echo "Cutting segments, generating audio with $TTS_PROVIDER, and building per-segment videos..."

pids=()

for i in "${!SEG_TITLES[@]}"; do
  title="${SEG_TITLES[$i]}"
  start_norm="${SEG_STARTS[$i]}"
  end_norm="${SEG_ENDS[$i]}"
  voice_text="${SEG_VOICES[$i]}"

  # Skip invalidated segments
  if [ -z "$title" ] || [ -z "$start_norm" ] || [ -z "$end_norm" ]; then
    continue
  fi

  process_segment "$i" "$title" "$start_norm" "$end_norm" "$voice_text" "$TMP_DIR" &

  pids+=("$!")

  if (( ${#pids[@]} >= MAX_JOBS )); then
    wait "${pids[0]}" || true
    pids=("${pids[@]:1}")
  fi
done

for pid in "${pids[@]}"; do
  wait "$pid" || true
done

> "$LIST_FILE"
for i in "${!SEG_TITLES[@]}"; do
  final_seg="$TMP_DIR/part_${i}.mp4"
  if [ -f "$final_seg" ]; then
    echo "file '$final_seg'" >> "$LIST_FILE"
  fi
done

if [ ! -s "$LIST_FILE" ]; then
  echo "No valid segments were written to the concat list. Aborting."
  exit 1
fi


########################################
# 13) FINAL CONCAT
########################################

echo "Concatenating segments into $OUTPUT_PATH ..."
ffmpeg -nostdin -loglevel error -y \
  -f concat -safe 0 \
  -i "$LIST_FILE" \
  -c:v libx264 -preset veryfast -crf 18 \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  "$OUTPUT_PATH"

echo "Done. Final short video: $OUTPUT_PATH"
echo "Temporary files in: $TMP_DIR  (you can delete this directory after checking the result)"
