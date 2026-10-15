import { useParams } from 'react-router-dom';
import { useAuth } from '@/modules/auth';
import { AgreementDetail, AgreementList } from '@/modules/approvals/components/AgreementViews';

// Admin: agreement registry (agreements.view) with registry actions (agreements.manage).
export default function AgreementRegistryPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  return id ? <AgreementDetail scope="admin" id={id} backTo="/admin/agreements" canManage={hasPermission('agreements.manage')} /> : <AgreementList scope="admin" basePath="/admin/agreements" />;
}
