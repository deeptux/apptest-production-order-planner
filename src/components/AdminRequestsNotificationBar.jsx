import { useState, useCallback, useEffect } from 'react';
import { useOverrideRequests } from '../context/OverrideRequestsContext';
import { OPEN_ADMIN_SUPERVISOR_REVIEW_EVENT } from '../constants/supervisorRequests';
import AdminRequestReviewModal from './AdminRequestReviewModal';

/**
 * Hosts the admin review modal and listens for bell-menu opens.
 * Pending requests are listed only in the header notification bell (no amber strip).
 */
export default function AdminRequestsNotificationBar() {
  const { refresh } = useOverrideRequests();
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const openReview = useCallback((req) => {
    setSelected(req);
    setModalOpen(true);
  }, []);

  useEffect(() => {
    const onOpenFromBell = (e) => {
      const r = e?.detail?.request;
      if (r) openReview(r);
    };
    window.addEventListener(OPEN_ADMIN_SUPERVISOR_REVIEW_EVENT, onOpenFromBell);
    return () => window.removeEventListener(OPEN_ADMIN_SUPERVISOR_REVIEW_EVENT, onOpenFromBell);
  }, [openReview]);

  return (
    <AdminRequestReviewModal
      open={modalOpen}
      onOpenChange={(o) => {
        setModalOpen(o);
        if (!o) setSelected(null);
      }}
      request={selected}
      onDecided={refresh}
    />
  );
}
