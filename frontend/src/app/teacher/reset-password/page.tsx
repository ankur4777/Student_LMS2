import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <ResetPasswordForm
      role="teacher"
      loginPath="/teacher/login"
    />
  );
}
