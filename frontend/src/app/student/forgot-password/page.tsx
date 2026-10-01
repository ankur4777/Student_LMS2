import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <ForgotPasswordForm
      role="student"
      portalName="Student"
      loginPath="/student/login"
    />
  );
}
