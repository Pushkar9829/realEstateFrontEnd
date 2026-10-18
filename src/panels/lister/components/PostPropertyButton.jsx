// "Post a property": creates a draft and opens the listing wizard at step 1
// (one click from anywhere, audit L2), like the button on My listings.
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button, useToast } from '@/shared/ui';
import { useCreateDraft } from '@/modules/listings/api';
import { useT } from '@/shared/i18n';

export default function PostPropertyButton({ children, ...rest }) {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateDraft();
  const start = async () => {
    try { const d = await create.mutateAsync(); navigate(`/lister/listings/${d._id}/edit?step=1`); } catch (e) { toast.error(e.message); }
  };
  return <Button icon={Plus} loading={create.isPending} onClick={start} {...rest}>{children || t('lister.common.postProperty')}</Button>;
}
