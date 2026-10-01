import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <ForgotPasswordForm
      role="college_admin"
      portalName="College Admin"
      loginPath="/college-admin/login"
    />
  );
}
