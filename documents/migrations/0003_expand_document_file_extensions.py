# Generated for expanded teacher document upload formats.

from django.conf import settings
import django.core.files.storage
import django.core.validators
from django.db import migrations, models
import documents.models


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0002_rename_documents_d_organiz_84fef0_idx_documents_d_organiz_c8c476_idx_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="document",
            name="file",
            field=models.FileField(
                storage=django.core.files.storage.FileSystemStorage(
                    location=settings.PRIVATE_MEDIA_ROOT
                ),
                upload_to=documents.models.document_upload_path,
                validators=[
                    django.core.validators.FileExtensionValidator(
                        allowed_extensions=[
                            "pdf",
                            "doc",
                            "docx",
                            "odt",
                            "rtf",
                            "txt",
                            "md",
                            "xls",
                            "xlsx",
                            "csv",
                            "ods",
                            "ppt",
                            "pptx",
                            "odp",
                            "jpg",
                            "jpeg",
                            "png",
                            "webp",
                            "gif",
                            "bmp",
                            "mp3",
                            "wav",
                            "m4a",
                            "mp4",
                            "mov",
                            "webm",
                            "zip",
                        ]
                    )
                ],
            ),
        ),
    ]
