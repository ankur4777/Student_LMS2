"""Server-side video duration inspection for the optional Learning Center.

Only local temporary files are handed to ffprobe. Never invoke a shell or
pass user filenames/URLs to ffprobe. Legacy recorded-course uploads remain
untouched. Requires the ffprobe executable (FFmpeg) on the backend host.
"""
import json
import math
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

MAX_UPLOAD_BYTES = 512 * 1024 * 1024
MAX_DURATION_SECONDS = 28800
VIDEO_SUFFIXES = frozenset({".mp4", ".webm", ".mov"})


class MediaProbeError(Exception):
    def __init__(self, message, unavailable=False):
        super().__init__(message)
        self.unavailable = unavailable


def probe_video_duration(upload):
    """Read a Django upload or stored File without trusting metadata.

    Rewinds seekable inputs before returning (including after probe failure).
    Outputs a positive finite floating-point duration with millisecond
    precision; rejects missing video streams and unsupported media.
    """
    name = Path(getattr(upload, "name", "") or "").name
    suffix = Path(name).suffix.lower()
    if suffix not in VIDEO_SUFFIXES:
        raise MediaProbeError("Use an MP4, WebM, or MOV video file.")
    size = getattr(upload, "size", None)
    if isinstance(size, int) and size > MAX_UPLOAD_BYTES:
        raise MediaProbeError("Video exceeds the 512 MB upload limit.")

    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        raise MediaProbeError(
            "Video inspection is unavailable: install FFmpeg/ffprobe on the backend server.",
            unavailable=True,
        )

    path = None
    try:
        # A random path keeps upload filenames and URL-like strings out of the
        # ffprobe command. Bound the streamed copy even when size was absent.
        with tempfile.NamedTemporaryFile(
            mode="wb", prefix="mysls-video-", suffix=suffix, delete=False,
        ) as dest:
            path = dest.name
            count = 0
            source = upload.chunks() if hasattr(upload, "chunks") else iter(
                lambda: upload.read(1024 * 1024), b"",
            )
            for chunk in source:
                count += len(chunk)
                if count > MAX_UPLOAD_BYTES:
                    raise MediaProbeError("Video exceeds the 512 MB upload limit.")
                dest.write(chunk)
            if count == 0:
                raise MediaProbeError("The uploaded video is empty.")
        command = [
            ffprobe, "-v", "error",
            "-protocol_whitelist", "file,pipe",
            "-show_entries",
            "format=duration:stream=codec_type,duration",
            "-of", "json", "-i", path,
        ]
        process = subprocess.run(
            command, capture_output=True, text=True, timeout=25,
            check=False,
        )
        if process.returncode != 0 or len(process.stdout) > 100000:
            raise MediaProbeError("Cannot read the uploaded video; check its encoding.")
        try:
            metadata = json.loads(process.stdout)
            streams = metadata.get("streams", [])
            videos = [s for s in streams if s.get("codec_type") == "video"]
            if not videos:
                raise MediaProbeError("The file contains no detectable video stream.")
            candidates = [metadata.get("format", {}).get("duration")]
            candidates += [stream.get("duration") for stream in videos]
            durations = []
            for value in candidates:
                try:
                    parsed = float(value)
                except (TypeError, ValueError):
                    continue
                if math.isfinite(parsed) and parsed > 0:
                    durations.append(parsed)
            if not durations:
                raise MediaProbeError("Video duration cannot be determined.")
            duration = max(durations)
            if duration < 0.1 or duration > MAX_DURATION_SECONDS:
                raise MediaProbeError("Video duration must be between 0.1 seconds and 8 hours.")
            return round(duration, 3)
        except (TypeError, ValueError, KeyError, AttributeError, json.JSONDecodeError) as exc:
            raise MediaProbeError("Invalid video metadata returned by the inspector.") from exc
    except subprocess.TimeoutExpired as exc:
        raise MediaProbeError("Video inspection timed out. Try a smaller video.") from exc
    except (OSError, PermissionError) as exc:
        raise MediaProbeError("Unable to inspect video on this server.", unavailable=True) from exc
    finally:
        if path:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass
        try:
            upload.seek(0)
        except (AttributeError, OSError):
            pass
