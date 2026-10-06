import django.core.validators
import liveclasses.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("liveclasses", "0010_alter_liveclassrecording_video"),
    ]

    operations = [
        migrations.AlterField(
            model_name="liveclassrecording",
            name="video",
            field=models.FileField(
                storage=liveclasses.models.PrivateRecordingStorage(),
                upload_to=liveclasses.models.live_class_recording_upload_path,
                validators=[
                    django.core.validators.FileExtensionValidator(
                        allowed_extensions=["mp4", "webm", "mov"]
                    )
                ],
            ),
        ),
    ]
