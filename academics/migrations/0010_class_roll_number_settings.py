import django.db.models.deletion
from django.db import migrations, models


def copy_organization_roll_settings_to_classes(apps, schema_editor):
    ClassRoom = apps.get_model("academics", "ClassRoom")

    for classroom in ClassRoom.objects.select_related("organization").all():
        organization = classroom.organization

        if not organization:
            continue

        classroom.roll_number_prefix = (
            organization.roll_number_prefix
            or organization.code.upper()
        )
        classroom.roll_number_digits = organization.roll_number_digits or 4
        classroom.roll_number_start = organization.roll_number_start or 1
        classroom.save(
            update_fields=[
                "roll_number_prefix",
                "roll_number_digits",
                "roll_number_start",
            ]
        )


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0009_merge_20261001_1719"),
    ]

    operations = [
        migrations.AddField(
            model_name="classroom",
            name="roll_number_prefix",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="classroom",
            name="roll_number_digits",
            field=models.PositiveSmallIntegerField(default=4),
        ),
        migrations.AddField(
            model_name="classroom",
            name="roll_number_start",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.RunPython(
            copy_organization_roll_settings_to_classes,
            migrations.RunPython.noop,
        ),
        migrations.RemoveConstraint(
            model_name="rollnumbersequence",
            name="uniq_roll_sequence_org_session",
        ),
        migrations.AddField(
            model_name="rollnumbersequence",
            name="classroom",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="roll_number_sequences",
                to="academics.classroom",
            ),
        ),
        migrations.AddConstraint(
            model_name="rollnumbersequence",
            constraint=models.UniqueConstraint(
                fields=("organization", "classroom"),
                name="uniq_roll_sequence_org_class",
            ),
        ),
    ]
