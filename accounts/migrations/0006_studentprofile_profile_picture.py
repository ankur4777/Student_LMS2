from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_studentprofile_address"),
    ]

    operations = [
        migrations.AddField(
            model_name="studentprofile",
            name="profile_picture",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="students/profile_pictures/",
            ),
        ),
    ]
