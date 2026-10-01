import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <ResetPasswordForm
      role="college_admin"
      loginPath="/college-admin/login"
    />
  );
}
