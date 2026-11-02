#!/usr/bin/env bash
# Encode rendered JPEG frames + master audio into the deliverable MP4.
# usage: render/encode.sh <frames_dir> <master.wav> <out.mp4> [target_mbps]
set -e
FR="$1"; AU="$2"; OUT="$3"; MBPS="${4:-3.6}"
BR="${MBPS}M"; MAX=$(python3 -c "print(f'{float(\"$MBPS\")*1.8:.1f}M')"); BUF=$(python3 -c "print(f'{float(\"$MBPS\")*3:.1f}M')")
# two-pass x264 for predictable size; tuned for animation-like content
ffmpeg -loglevel error -y -framerate 24 -i "$FR/f%05d.jpg" -c:v libx264 -preset slow -tune animation -b:v $BR -maxrate $MAX -bufsize $BUF \
  -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -pass 1 -passlogfile /tmp/claude-0/x264pass -an -f null /dev/null
ffmpeg -loglevel error -y -framerate 24 -i "$FR/f%05d.jpg" -i "$AU" -c:v libx264 -preset slow -tune animation -b:v $BR -maxrate $MAX -bufsize $BUF \
  -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -pass 2 -passlogfile /tmp/claude-0/x264pass \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest -metadata title="キミの右手のアイロニー 本予告" "$OUT"
ls -la "$OUT"; ffprobe -v error -show_entries format=duration,bit_rate -of default=nw=1 "$OUT"
