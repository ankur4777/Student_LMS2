from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0011_subject_student_access"),
    ]

    operations = [
        migrations.AlterField(
            model_name="classfeatureaccess",
            name="feature_key",
            field=models.CharField(
                choices=[
                    ("classes", "My Classes"),
                    ("recorded_classes", "Recorded Classes"),
                    ("recorded_courses", "Recorded Courses"),
                    ("attendance", "Attendance"),
                    ("assignments", "Assignments"),
                    ("results", "Results"),
                    ("documents", "Documents"),
                    ("fees", "Fees"),
                    ("notifications", "Notifications"),
                    ("ai_assistant", "AI Assistant"),
                ],
                max_length=50,
            ),
        ),
    ]
