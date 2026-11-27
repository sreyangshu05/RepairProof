import { useParams } from 'react-router-dom';
import { CustomerAuthorizationPage } from '../pages/public/CustomerAuthorizationPage';
import { VerifyCertificatePage } from '../pages/public/VerifyCertificatePage';

export default function PublicScreens({ type }: { type: 'authorization' | 'verification' }) {
  const params = useParams();
  return type === 'authorization' ? (
    <CustomerAuthorizationPage />
  ) : (
    <VerifyCertificatePage key={params.certificateNumber ?? 'verify'} />
  );
}
