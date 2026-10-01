from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("institutions", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="organization",
            name="roll_number_prefix",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="organization",
            name="roll_number_digits",
            field=models.PositiveSmallIntegerField(default=4),
        ),
        migrations.AddField(
            model_name="organization",
            name="roll_number_start",
            field=models.PositiveIntegerField(default=1),
        ),
    ]
