#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR"
WORK_DIR=$(mktemp -d)

FFMPEG_URL="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz"
FONT_URL="https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.tar.bz2"

echo "Building FFmpeg Lambda layer (BtbN GPL with drawtext)..."
echo "Working directory: $WORK_DIR"

cleanup() {
    rm -rf "$WORK_DIR"
}
trap cleanup EXIT

cd "$WORK_DIR"

mkdir -p opt/bin opt/fonts

echo "Downloading FFmpeg (BtbN GPL Static Build with drawtext)..."
curl -sL "$FFMPEG_URL" -o ffmpeg.tar.xz

echo "Extracting FFmpeg..."
tar xf ffmpeg.tar.xz --strip-components=1

cp bin/ffmpeg opt/bin/
chmod 755 opt/bin/ffmpeg

echo "Downloading DejaVu fonts..."
curl -sL "$FONT_URL" -o dejavu.tar.bz2
tar xf dejavu.tar.bz2
cp dejavu-fonts-ttf-2.37/ttf/DejaVuSans-Bold.ttf opt/fonts/

echo "Creating ZIP file..."
cd opt
zip -r9 "$OUTPUT_DIR/ffmpeg-layer.zip" bin fonts

echo ""
echo "Layer built successfully: $OUTPUT_DIR/ffmpeg-layer.zip"
echo ""
echo "Layer contents:"
unzip -l "$OUTPUT_DIR/ffmpeg-layer.zip"
echo ""
ls -lh "$OUTPUT_DIR/ffmpeg-layer.zip"

UNZIPPED_SIZE=$(unzip -l "$OUTPUT_DIR/ffmpeg-layer.zip" | tail -1 | awk '{print $1}')
UNZIPPED_MB=$((UNZIPPED_SIZE / 1024 / 1024))
echo ""
echo "Unzipped size: ${UNZIPPED_MB} MB (Lambda limit: 250 MB)"
if [ $UNZIPPED_MB -gt 250 ]; then
    echo "WARNING: Layer exceeds Lambda 250 MB limit!"
    exit 1
fi
echo "Layer is within Lambda size limits."