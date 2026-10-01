import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <ForgotPasswordForm
      role="parent"
      portalName="Parent"
      loginPath="/parent/login"
    />
  );
}
