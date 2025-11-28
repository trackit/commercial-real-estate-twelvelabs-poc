# Commercial Real Estate TwelveLabs POC

An end-to-end **AI video pipeline** that turns a raw real-estate walkthrough into a polished ~60s social-media-ready house tour.

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Video & Font Paths](#video--font-paths)
- [Usage](#usage)
- [Pipeline Details](#pipeline-details)
  - [1. Retrieve Marengo Segments](#1-retrieve-marengo-segments)
  - [2. Annotate Segments with Pegasus](#2-annotate-segments-with-pegasus)
  - [3. Select Best Segments with Gemini (~60s)](#3-select-best-segments-with-gemini-60s)
  - [4. Generate Voiceover Text with Pegasus](#4-generate-voiceover-text-with-pegasus)
  - [5. Synthesize Speech with AWS Polly](#5-synthesize-speech-with-aws-polly)
  - [6. Cut, Label, and Concatenate with ffmpeg](#6-cut-label-and-concatenate-with-ffmpeg)
- [Troubleshooting](#troubleshooting)

## Features

- 🔍 **AI scene understanding**  
  Uses TwelveLabs Marengo (visual embeddings) and Pegasus (generative video understanding) to classify each segment as _Exterior, Entry, Living, Kitchen, Bedroom,_ etc., and assign an appeal score (0–10).

- 🎬 **Automatic short creation (~60 seconds)**  
  Gemini selects a subset of candidate segments that totals **~60 seconds** (approx. 50–70s), ordered in a natural house-tour flow.

- 🗣️ **AI-generated narration**  
  Pegasus writes one natural English sentence per selected segment. Sentences are chained together for coherent narration across the entire tour.

- 🔊 **Text-to-speech with AWS Polly**  
  Each narration sentence is synthesized into an MP3 using the `synthesize-speech` command from the AWS CLI.

- 🎨 **Branded overlays**  
  The script randomly picks an agency name + street address and overlays:

  - Agency + street name on the intro/exterior segment;
  - A room label (e.g. "LIVING AREA", "KITCHEN VIEW") on each segment.

- 🎥 **Single MP4 output**  
  All segments are concatenated using the ffmpeg concat demuxer into a fast-start MP4 suitable for YouTube Shorts, Instagram Reels, TikTok, etc.

## Architecture Overview

High-level flow:

1. **Index & Embedding (TwelveLabs)** – you supply an `INDEX_ID` and `VIDEO_ID` for a video already indexed with Marengo visual embeddings.
2. **Annotation (TwelveLabs Pegasus)** – for each embedding segment, the script calls the TwelveLabs `analyze` endpoint with a Pegasus prompt asking for room type, title, appeal score, and whether it is a hero shot or a transition.
3. **Selection (Google Gemini)** – the enriched list of segments is passed as part of a text prompt to the Gemini API’s `generateContent` method. Gemini returns a list of chosen segments (id, title, start/end).
4. **Narration (Pegasus + Polly)** – Pegasus generates a single sentence per segment; AWS Polly turns each sentence into audio.
5. **Editing (ffmpeg)** – ffmpeg cuts, overlays, and concatenates the segments using the concat demuxer into one final MP4.

## Prerequisites

You will need:

- **bash** (tested on Linux; macOS should work with minor tweaks)
- **curl**
- **jq**
- **ffmpeg** with H.264 and AAC support
- **AWS CLI** configured with access to Amazon Polly
- A TwelveLabs account with at least one video already uploaded, indexed, and embedded using a Marengo-based index:
  - An index configured with Marengo visual embeddings
  - A corresponding VIDEO_ID and INDEX_ID for that embedded video
- A Google Gemini API key (Generative Language API / Gemini API)

## Installation

Clone the repository:

```bash
git clone git@github.com:trackit/commercial-real-estate-twelvelabs-poc.git
cd commercial-real-estate-twelvelabs-poc
```

Make the script executable:

```bash
chmod +x script.sh
```

Make sure `ffmpeg`, `curl`, `jq`, and `aws` are installed and on your `PATH`.

Example (Debian/Ubuntu):

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg jq curl awscli
```

## Configuration

### Environment Variables

The script reads its configuration primarily from environment variables, with safe defaults/placeholders:

```bash
# TwelveLabs
export TL_API_KEY="your_twelvelabs_api_key"
export TL_VIDEO_ID="your_video_id"
export TL_INDEX_ID="your_index_id"

# Gemini
export GEMINI_API_KEY="your_gemini_api_key"

# TTS provider: choose either AWS Polly (default) or ElevenLabs
export TTS_PROVIDER="polly"         # or "elevenlabs"

# AWS Polly (via AWS CLI)
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_DEFAULT_REGION="eu-west-1"  # or any Polly-supported region
export POLLY_VOICE_ID="Joanna"

# ElevenLabs
export ELEVENLABS_API_KEY="your_elevenlabs_api_key"
export ELEVENLABS_VOICE_ID="your_voice_id"

# Paths
export VIDEO_PATH="./house-tour.mp4"
export OUTPUT_PATH="./house_tour_pegasus_cut.mp4"

# Optional overrides
export FONT_PATH="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
export POLLY_VOICE_ID="Joanna"
export MAX_JOBS=4
export MAX_ANN_JOBS=40
```

If you don’t set these variables, the script will fall back to placeholder values for the API keys and will exit with a clear error message instead of failing silently.

### Video & Font Paths

- `VIDEO_PATH`: local path to the original walkthrough video (must match the TwelveLabs indexed video).
- `OUTPUT_PATH`: path for the final MP4 short.
- `FONT_PATH`: font used by `ffmpeg drawtext`. You can change this to another TTF font available on your system.

## Usage

Once your environment variables are configured and your video is indexed in TwelveLabs:

```bash
bash ./script.sh
```

For the insights script, you can use the `insights.sh` script:

```bash
bash ./insights.sh "12 Rue Exemple, Paris, France"
```

## Pipeline Details

### 1. Retrieve Marengo Segments

The script calls TwelveLabs’ index/video endpoint with `embedding_option=visual` to get the list of Marengo visual embedding segments for the specified `VIDEO_ID` in the given `INDEX_ID`. These segments contain `start_offset_sec` and `end_offset_sec`, which the script converts into a TSV list (`start<TAB>end`) for further processing.

### 2. Annotate Segments with Pegasus

For each Marengo segment, the script calls the TwelveLabs Pegasus analyze endpoint with a prompt asking for:

- Primary room type (e.g., Exterior, Entry, Living, Kitchen, Bedroom, Bathroom, Hallway, etc.)
- Short title (1–4 words)
- Appeal score (0–10)
- Whether it is a hero candidate
- Whether it is just a transition/dead shot
- A short description of what is visible

Segments marked as pure transitions or with `appeal_score <= 0` are filtered out before passing them to Gemini.

### 3. Select Best Segments with Gemini (~60s)

The enriched JSON array of candidates is inlined into a text prompt and sent to the Gemini API using the `generateContent` method. The prompt instructs Gemini to:

- Pick a subset of segments whose total duration is close to **60 seconds** (50–70 seconds acceptable).
- Follow a natural house-tour narrative (exterior → entry → living → kitchen → bedroom/bathroom/special → strong final shot).
- Prefer high appeal scores and visual variety.
- Avoid redundant or low-value segments.
- Maintain roughly chronological order.

The JSON response is parsed and converted into bash arrays: `SEG_TITLES[]`, `SEG_STARTS[]`, `SEG_ENDS[]`.

### 4. Generate Voiceover Text with Pegasus

For each selected segment, the script calls Pegasus with a voiceover prompt that:

- Describes the visible area and its appeal.
- Produces exactly one English sentence.
- Avoids mentioning "segment", "video", "camera", etc.
- Respects a max word count based on segment duration (~2.5 words/sec).

A running `VO_HISTORY` is passed into each request so Pegasus can keep the narration coherent across segments. Sentences are stored in `SEG_VOICES[]`.

### 5. Synthesize Speech with AWS Polly or ElevenLabs

Depending on configuration:

- AWS Polly is used via aws polly synthesize-speech, producing MP3 audio for each sentence.
- ElevenLabs TTS can be used instead. ElevenLabs supports voice speed control via the speed parameter (range 0.7–1.2) in its API, which can make the speech faster than the default pace.

If TTS fails or returns empty audio, the script will continue—those segments will remain silent.

> Note: You must have valid AWS credentials and a default region configured for Polly.

### 6. Cut, Label, and Concatenate with ffmpeg

For each chosen segment:

1. `ffmpeg` cuts the video between `start_time` and `end_time` and overlays:
   - A room label (upper-case `title`).
   - On the intro segment, agency name + street name at the top.
2. If Polly audio exists, the script merges video + audio with `-shortest` so audio does not exceed video length.
3. The per-segment MP4 files are listed in a text file and concatenated using the ffmpeg concat demuxer into `OUTPUT_PATH`.

## Troubleshooting

### Polly: "returned empty audio or failed"

If the script prints messages like:

```text
[JOB i] Polly returned empty audio or failed, keeping silent segment.
```

Check:

1. AWS CLI configuration:

   ```bash
   aws sts get-caller-identity
   aws configure list
   ```

2. Polly works in isolation:

   ```bash
   aws polly synthesize-speech      --output-format mp3      --voice-id Joanna      --text "Hello from Polly"      test_hello.mp3
   ```

If this fails, fix your AWS credentials or region.

### Gemini: "could not parse JSON from response"

If the script reports JSON parse errors:

- Check the printed "Raw Gemini text" in the logs.
- Ensure `GEMINI_API_KEY` is valid and correctly set.
- Optionally log the full `GEMINI_RESPONSE` for debugging.

### TwelveLabs errors

If you see:

```text
!! TwelveLabs index API returned an error:
```

then check:

- `TL_API_KEY`, `TL_INDEX_ID`, `TL_VIDEO_ID` values.
- That your index actually uses a Marengo model with visual embeddings for this video.
