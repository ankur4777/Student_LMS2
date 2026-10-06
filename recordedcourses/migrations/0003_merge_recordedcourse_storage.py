import django.core.validators
import recordedcourses.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("recordedcourses", "0002_alter_recordedlesson_video"),
        (
            "recordedcourses",
            "0002_use_environment_independent_private_storage",
        ),
    ]

    operations = [
        migrations.AlterField(
            model_name="recordedlesson",
            name="video",
            field=models.FileField(
                max_length=500,
                storage=recordedcourses.models.PrivateRecordedCourseStorage(),
                upload_to=recordedcourses.models.recorded_lesson_upload_path,
                validators=[
                    django.core.validators.FileExtensionValidator(
                        allowed_extensions=["mp4", "webm", "mov"]
                    )
                ],
            ),
        ),
    ]
