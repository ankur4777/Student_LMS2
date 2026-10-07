from django.db import migrations, models
import django.db.models.deletion
import django.core.validators
from decimal import Decimal
from django.utils import timezone


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_studentprofile_profile_picture"),
        ("liveclasses", "0012_liveclassrecording_purchase_settings"),
        ("recordedcourses", "0003_merge_recordedcourse_storage"),
    ]

    operations = [
        migrations.CreateModel(
            name="RecordedClassPurchase",
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
                (
                    "buyer_type",
                    models.CharField(
                        choices=[
                            ("student", "Student"),
                            ("parent", "Parent"),
                        ],
                        max_length=10,
                    ),
                ),
                (
                    "amount",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=10,
                        validators=[
                            django.core.validators.MinValueValidator(
                                Decimal("0.00")
                            )
                        ],
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("paid", "Paid"),
                            ("failed", "Failed"),
                            ("refunded", "Refunded"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="pending",
                        max_length=12,
                    ),
                ),
                ("payment_method", models.CharField(blank=True, max_length=40)),
                (
                    "payment_reference",
                    models.CharField(blank=True, max_length=120),
                ),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="recorded_class_purchases",
                        to="institutions.organization",
                    ),
                ),
                (
                    "purchased_by_parent",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="recorded_class_purchases",
                        to="accounts.parentprofile",
                    ),
                ),
                (
                    "purchased_by_student",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="self_recorded_class_purchases",
                        to="accounts.studentprofile",
                    ),
                ),
                (
                    "recording",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="purchases",
                        to="liveclasses.liveclassrecording",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="recorded_class_purchases",
                        to="accounts.studentprofile",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="RecordedClassAccess",
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
                ("starts_at", models.DateTimeField(default=timezone.now)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                (
                    "revoke_reason",
                    models.CharField(blank=True, max_length=255),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="recorded_class_accesses",
                        to="institutions.organization",
                    ),
                ),
                (
                    "purchase",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="granted_access",
                        to="recordedcourses.recordedclasspurchase",
                    ),
                ),
                (
                    "recording",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="student_accesses",
                        to="liveclasses.liveclassrecording",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="recorded_class_accesses",
                        to="accounts.studentprofile",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="recordedclassaccess",
            constraint=models.UniqueConstraint(
                fields=("recording", "student"),
                name="unique_recorded_class_access",
            ),
        ),
    ]
