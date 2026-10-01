import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <ForgotPasswordForm
      role="teacher"
      portalName="Teacher"
      loginPath="/teacher/login"
    />
  );
}
