from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("liveclasses", "0011_use_environment_independent_private_storage"),
    ]

    operations = [
        migrations.AddField(
            model_name="liveclassrecording",
            name="price",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text=(
                    "Set by the college admin before students can purchase access."
                ),
                max_digits=10,
                null=True,
                validators=[MinValueValidator(Decimal("0.00"))],
            ),
        ),
        migrations.AddField(
            model_name="liveclassrecording",
            name="access_duration_days",
            field=models.PositiveIntegerField(default=180),
        ),
    ]
