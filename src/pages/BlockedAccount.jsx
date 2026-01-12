import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import BlockedAccountComponent from '@/components/BlockedAccount';

export default function BlockedAccountPage() {
  const [reason, setReason] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reasonParam = urlParams.get('reason');
    if (reasonParam) {
      setReason(decodeURIComponent(reasonParam));
    }
  }, []);

  return <BlockedAccountComponent reason={reason} />;
}