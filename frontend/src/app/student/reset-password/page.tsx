import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <ResetPasswordForm
      role="student"
      loginPath="/student/login"
    />
  );
}
