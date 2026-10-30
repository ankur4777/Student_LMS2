"""ffprobe duration verification tests; binary is mocked for portability."""
import json
import os
from types import SimpleNamespace
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase

from .learning_media import MediaProbeError, probe_video_duration


class VideoDurationProbeTests(SimpleTestCase):
    @patch("recordedcourses.learning_media.shutil.which", return_value="/usr/bin/ffprobe")
    @patch("recordedcourses.learning_media.subprocess.run")
    def test_reads_video_duration_and_cleans_up(self, run, which):
        run.return_value = SimpleNamespace(
            returncode=0, stdout=json.dumps({
                "streams": [{"codec_type": "video", "duration": "12.52"}],
                "format": {"duration": "12.5"},
            }),
        )
        video = SimpleUploadedFile("video.mp4", b"video content")
        self.assertEqual(probe_video_duration(video), 12.52)
        self.assertEqual(video.tell(), 0)
        command = run.call_args.args[0]
        self.assertEqual(command[0], "/usr/bin/ffprobe")
        self.assertEqual(command[-2], "-i")
        self.assertFalse(os.path.exists(command[-1]))
        self.assertNotIn("video.mp4", command)
        self.assertNotIn("shell", run.call_args.kwargs)

    @patch("recordedcourses.learning_media.shutil.which", return_value="/usr/bin/ffprobe")
    @patch("recordedcourses.learning_media.subprocess.run")
    def test_rejects_audio_only_and_unknown_duration(self, run, which):
        video = SimpleUploadedFile("audio.mp4", b"content")
        run.return_value = SimpleNamespace(
            returncode=0, stdout=json.dumps({
                "streams": [{"codec_type": "audio"}],
                "format": {"duration": "20"},
            }),
        )
        with self.assertRaisesRegex(MediaProbeError, "no detectable video"):
            probe_video_duration(video)
        run.return_value = SimpleNamespace(
            returncode=0, stdout=json.dumps({
                "streams": [{"codec_type": "video"}],
                "format": {"duration": "N/A"},
            }),
        )
        with self.assertRaisesRegex(MediaProbeError, "cannot be determined"):
            probe_video_duration(video)

    @patch("recordedcourses.learning_media.shutil.which", return_value=None)
    def test_missing_ffprobe_is_explicit_server_error(self, which):
        with self.assertRaises(MediaProbeError) as issue:
            probe_video_duration(SimpleUploadedFile("video.mp4", b"content"))
        self.assertTrue(issue.exception.unavailable)

    @patch("recordedcourses.learning_media.MAX_UPLOAD_BYTES", 2)
    def test_invalid_extension_and_oversized_file_rejected(self):
        with self.assertRaisesRegex(MediaProbeError, "512 MB"):
            probe_video_duration(SimpleUploadedFile("video.mp4", b"1234"))
        with self.assertRaisesRegex(MediaProbeError, "MP4"):
            probe_video_duration(SimpleUploadedFile("not-video.pdf", b"test"))
