import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("institutions", "0002_roll_number_settings"),
        ("academics", "0006_classfeatureaccess"),
    ]

    operations = [
        migrations.CreateModel(
            name="RollNumberSequence",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("next_number", models.PositiveIntegerField(default=1)),
                (
                    "academic_session",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="roll_number_sequences",
                        to="academics.academicsession",
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="roll_number_sequences",
                        to="institutions.organization",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="rollnumbersequence",
            constraint=models.UniqueConstraint(
                fields=("organization", "academic_session"),
                name="uniq_roll_sequence_org_session",
            ),
        ),
    ]
