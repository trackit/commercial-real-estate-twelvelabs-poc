# FFmpeg Lambda Layer

This directory should contain the ffmpeg Lambda layer ZIP file.

**IMPORTANT:** The layer must use FFmpeg 6.0.1 or earlier. Newer versions (7.0+) have a broken `drawtext` filter.

## Building the FFmpeg Layer

Run the build script:

```bash
cd terraform/layers
./build-ffmpeg-layer.sh
```

This will download FFmpeg 6.0.1 (which has a working drawtext filter) and create `ffmpeg-layer.zip`.

### Option 1: Use a Pre-built Layer

You can use a community-maintained FFmpeg layer ARN directly by setting the `ffmpeg_layer_arn` variable:

```hcl
ffmpeg_layer_arn = "arn:aws:lambda:us-east-1:123456789012:layer:ffmpeg:1"
```

### Option 2: Build Your Own Layer

To build the FFmpeg layer yourself:

1. Create an Amazon Linux 2023 EC2 instance or use a Docker container:

```bash
docker run -it --rm -v $(pwd):/output amazonlinux:2023 bash
```

2. Install FFmpeg:

```bash
yum install -y tar gzip xz
cd /tmp

curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o ffmpeg.tar.xz

tar xf ffmpeg.tar.xz
cd ffmpeg-*-amd64-static

mkdir -p /opt/bin /opt/fonts
cp ffmpeg ffprobe /opt/bin/

chmod 755 /opt/bin/ffmpeg /opt/bin/ffprobe
```

3. Add the font file:

```bash
curl -L https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.tar.bz2 -o dejavu.tar.bz2
tar xf dejavu.tar.bz2
cp dejavu-fonts-ttf-2.37/ttf/DejaVuSans-Bold.ttf /opt/fonts/
```

4. Create the ZIP file:

```bash
cd /opt
zip -r9 /output/ffmpeg-layer.zip bin fonts
```

5. Copy `ffmpeg-layer.zip` to this directory.

## Layer Structure

The layer should have the following structure:

```
ffmpeg-layer.zip
├── bin/
│   ├── ffmpeg
│   └── ffprobe
└── fonts/
    └── DejaVuSans-Bold.ttf
```

## Usage in Lambda

The binaries will be available at:

- `/opt/bin/ffmpeg`
- `/opt/bin/ffprobe`

The font file will be at:

- `/opt/fonts/DejaVuSans-Bold.ttf`

Make sure your Lambda function has the `/opt/bin` directory in its PATH.
