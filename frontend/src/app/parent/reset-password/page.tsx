import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <ResetPasswordForm
      role="parent"
      loginPath="/parent/login"
    />
  );
}
