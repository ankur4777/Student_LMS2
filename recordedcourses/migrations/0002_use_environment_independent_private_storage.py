import django.core.validators
import recordedcourses.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("recordedcourses", "0001_initial"),
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
