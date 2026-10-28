"""Local Django-admin organization master switch for Recorded Learning.

Log in as a Django superuser, add each organization's settings record once,
then tick/untick the Enabled column and click Save.
"""
from django.contrib import admin
from django import forms

from .models import OrganizationLearningSettings


class LearningSettingsForm(forms.ModelForm):
    """Display a form validation message rather than a server error."""

    class Meta:
        model = OrganizationLearningSettings
        fields = "__all__"

    def clean(self):
        data = super().clean()
        org = data.get("organization") or getattr(self.instance, "organization", None)
        if data.get("is_enabled") and org is not None and not org.is_active:
            raise forms.ValidationError("An inactive organization cannot enable learning.")
        return data


@admin.register(OrganizationLearningSettings)
class OrganizationLearningSettingsAdmin(admin.ModelAdmin):
    form = LearningSettingsForm
    list_display = ("organization", "is_enabled", "updated_by", "updated_at")
    list_display_links = ("organization",)
    list_editable = ("is_enabled",)
    list_filter = ("is_enabled",)
    search_fields = ("organization__name", "organization__code")
    list_select_related = ("organization", "updated_by")
    readonly_fields = ("updated_by", "updated_at")
    autocomplete_fields = ()
    ordering = ("organization__name",)

    def has_module_permission(self, request):
        return request.user.is_active and request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_active and request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_active and request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_active and request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        # Turning the switch off keeps an auditable settings record.
        return False

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
