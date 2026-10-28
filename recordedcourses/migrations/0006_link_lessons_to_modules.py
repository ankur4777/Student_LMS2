"""Additive link: old recordings remain valid with module=None."""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("recordedcourses", "0005_learning_foundation")]
    operations = [
        migrations.AddField(
            model_name="recordedlesson",
            name="module",
            field=models.ForeignKey(
                to="recordedcourses.coursemodule",
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="lessons",
                null=True, blank=True,
            ),
        ),
    ]
