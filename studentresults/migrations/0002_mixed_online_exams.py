from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("studentresults", "0001_initial"),
        ("academics", "0011_subject_student_access"),
    ]

    operations = [
        migrations.AddField(
            model_name="exam",
            name="online_teacher_assignment",
            field=models.ForeignKey(
                to="academics.teacherassignment",
                on_delete=django.db.models.deletion.PROTECT,
                null=True, blank=True, related_name="online_exams",
            ),
        ),
        migrations.AddField(
            model_name="exam",
            name="online_starts_at",
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="exam",
            name="online_ends_at",
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="exam",
            name="online_duration_minutes",
            field=models.PositiveIntegerField(default=60),
        ),
        migrations.AddField(
            model_name="exam",
            name="online_is_open",
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name="ExamQuestion",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("kind", models.CharField(max_length=16, choices=[
                    ("mcq", "Multiple choice"), ("true_false", "True or false"),
                    ("short", "Short answer"), ("long", "Long answer"),
                ])),
                ("prompt", models.TextField()),
                ("marks", models.DecimalField(max_digits=7, decimal_places=2)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("exam", models.ForeignKey(
                    to="studentresults.exam", on_delete=django.db.models.deletion.CASCADE,
                    related_name="questions",
                )),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
        migrations.CreateModel(
            name="ExamChoice",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("text", models.CharField(max_length=500)),
                ("is_correct", models.BooleanField(default=False)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("question", models.ForeignKey(
                    to="studentresults.examquestion",
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="choices",
                )),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
        migrations.CreateModel(
            name="ExamAttempt",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("state", models.CharField(
                    max_length=16, default="in_progress",
                    choices=[("in_progress", "In progress"),
                             ("submitted", "Submitted (subjective pending)"),
                             ("graded", "Fully graded")],
                )),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("submitted_at", models.DateTimeField(null=True, blank=True)),
                ("objective_marks", models.DecimalField(
                    max_digits=8, decimal_places=2, default=0,
                )),
                ("subjective_marks", models.DecimalField(
                    max_digits=8, decimal_places=2, default=0,
                )),
                ("exam", models.ForeignKey(
                    to="studentresults.exam", on_delete=django.db.models.deletion.CASCADE,
                    related_name="attempts",
                )),
                ("student", models.ForeignKey(
                    to="accounts.studentprofile", on_delete=django.db.models.deletion.CASCADE,
                    related_name="online_exam_attempts",
                )),
            ],
        ),
        migrations.AddConstraint(
            model_name="examattempt",
            constraint=models.UniqueConstraint(
                fields=("exam", "student"), name="uniq_online_exam_attempt",
            ),
        ),
        migrations.CreateModel(
            name="ExamAnswer",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("text_answer", models.TextField(blank=True)),
                ("awarded_marks", models.DecimalField(
                    max_digits=7, decimal_places=2, null=True, blank=True,
                )),
                ("feedback", models.TextField(blank=True)),
                ("graded_at", models.DateTimeField(null=True, blank=True)),
                ("attempt", models.ForeignKey(
                    to="studentresults.examattempt",
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="answers",
                )),
                ("question", models.ForeignKey(
                    to="studentresults.examquestion",
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="answers",
                )),
                ("selected_choice", models.ForeignKey(
                    to="studentresults.examchoice",
                    on_delete=django.db.models.deletion.SET_NULL,
                    null=True, blank=True, related_name="student_answers",
                )),
            ],
        ),
        migrations.AddConstraint(
            model_name="examanswer",
            constraint=models.UniqueConstraint(
                fields=("attempt", "question"), name="uniq_online_exam_answer",
            ),
        ),
    ]
