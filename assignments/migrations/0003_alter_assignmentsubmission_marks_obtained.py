from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assignments", "0002_assignmentsubmission"),
    ]

    operations = [
        migrations.AlterField(
            model_name="assignmentsubmission",
            name="marks_obtained",
            field=models.CharField(
                blank=True,
                max_length=50,
                null=True,
            ),
        ),
    ]
