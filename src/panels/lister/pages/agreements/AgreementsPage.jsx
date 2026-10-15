import { useParams } from 'react-router-dom';
import { AgreementDetail, AgreementList } from '@/modules/approvals/components/AgreementViews';

// Lister: own commission agreements (list and detail).
export default function AgreementsPage() {
  const { id } = useParams();
  return id ? <AgreementDetail scope="lister" id={id} backTo="/lister/agreements" /> : <AgreementList scope="lister" basePath="/lister/agreements" />;
}
