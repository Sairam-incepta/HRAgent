import { redirect } from 'next/navigation';

export default function SignUpPage() {
  // Redirect to sign-in since sign-up is disabled
  redirect('/sign-in');
}