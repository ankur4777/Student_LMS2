from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0007_rollnumbersequence"),
    ]

    operations = [
        migrations.AlterField(
            model_name="studentenrollment",
            name="roll_number",
            field=models.CharField(blank=True, max_length=50),
        ),
    ]
