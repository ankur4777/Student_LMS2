from rest_framework import serializers
from .models import LiveClass, LiveClassRecording


class LiveClassSerializer(serializers.ModelSerializer):

    teacher_name = serializers.CharField(
        source='teacher_assignment.teacher.user.get_full_name',
        read_only=True
    )

    subject_name = serializers.CharField(
        source='teacher_assignment.subject.name',
        read_only=True
    )

    section_name = serializers.CharField(
        source='teacher_assignment.section.name',
        read_only=True
    )

    meeting_link = serializers.SerializerMethodField()

    # Unique ID of uploaded recording
    recording_public_id = serializers.UUIDField(
        source='recording.public_id',
        read_only=True
    )

    # Purchase-aware recording information
    recording_price = serializers.SerializerMethodField()
    recording_access_duration_days = serializers.SerializerMethodField()
    recording_price_configured = serializers.SerializerMethodField()
    recording_has_access = serializers.SerializerMethodField()
    recording_access_expires_at = serializers.SerializerMethodField()
    recording_purchase_status = serializers.SerializerMethodField()

    # Secure playback endpoint
    recording_playback_url = serializers.SerializerMethodField()

    # Students can join only after the assigned teacher starts the class.
    can_join = serializers.SerializerMethodField()

    def get_meeting_link(self, obj):
        if obj.status != LiveClass.Status.LIVE:
            return ""

        return obj.meeting_link

    def get_can_join(self, obj):
        return bool(
            obj.meeting_link
            and obj.status == LiveClass.Status.LIVE
        )

    def _recording(self, obj):
        try:
            return obj.recording
        except Exception:
            return None

    def _recording_state(self, obj):
        recording = self._recording(obj)
        student = self.context.get("student_profile")

        if not recording or not student:
            return {
                "has_access": False,
                "access_expires_at": None,
                "purchase_status": None,
            }

        cache = getattr(self, "_recording_state_cache", None)

        if cache is None:
            cache = {}
            self._recording_state_cache = cache

        cache_key = (recording.id, student.id)

        if cache_key in cache:
            return cache[cache_key]

        from recordedcourses.models import (
            RecordedClassAccess,
            RecordedClassPurchase,
        )

        access = RecordedClassAccess.objects.filter(
            organization=student.user.organization,
            recording=recording,
            student=student,
            is_active=True,
            revoked_at__isnull=True,
        ).first()

        has_access = bool(access and access.has_access)

        purchase = RecordedClassPurchase.objects.filter(
            organization=student.user.organization,
            recording=recording,
            student=student,
        ).order_by("-created_at").first()

        state = {
            "has_access": has_access,
            "access_expires_at": (
                access.expires_at if has_access else None
            ),
            "purchase_status": (
                purchase.status if purchase else None
            ),
        }

        cache[cache_key] = state
        return state

    def get_recording_price(self, obj):
        recording = self._recording(obj)
        return recording.price if recording else None

    def get_recording_access_duration_days(self, obj):
        recording = self._recording(obj)
        return recording.access_duration_days if recording else None

    def get_recording_price_configured(self, obj):
        recording = self._recording(obj)
        return bool(recording and recording.price is not None)

    def get_recording_has_access(self, obj):
        return self._recording_state(obj)["has_access"]

    def get_recording_access_expires_at(self, obj):
        return self._recording_state(obj)["access_expires_at"]

    def get_recording_purchase_status(self, obj):
        return self._recording_state(obj)["purchase_status"]

    def get_recording_playback_url(self, obj):
        recording = self._recording(obj)

        if not recording:
            return None

        if not self._recording_state(obj)["has_access"]:
            return None

        return (
            f'/api/live-classes/student/recordings/'
            f'{recording.public_id}/play/'
        )

    class Meta:
        model = LiveClass

        fields = [
            'id',
            'title',
            'description',
            'class_date',
            'start_time',
            'end_time',
            'meeting_link',
            'status',
            'can_join',

            'teacher_name',
            'subject_name',
            'section_name',

            'recording_public_id',
            'recording_price',
            'recording_access_duration_days',
            'recording_price_configured',
            'recording_has_access',
            'recording_access_expires_at',
            'recording_purchase_status',
            'recording_playback_url',

            'created_at',
            'updated_at',
        ]


class TeacherRecordingUploadSerializer(serializers.ModelSerializer):

    class Meta:
        model = LiveClassRecording

        fields = [
            'live_class',
            'title',
            'video',
        ]
        
class TeacherRecordingUpdateSerializer(serializers.ModelSerializer):

    class Meta:
        model = LiveClassRecording

        fields = [
            'title',
            'is_available',
            'video',
        ]