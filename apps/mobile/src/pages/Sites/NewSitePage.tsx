import React from 'react';
import { SiteFormModal } from '../../components/sites/SiteFormModal';
import { siteForm } from '../../forms';
import { Snapshot } from '../../types';

export interface NewSitePageProps {
  data?: Snapshot;
  busy: boolean;
  error: string;
  onBack: () => void;
  onSave: (values: Record<string, string>) => void;
}

/**
 * Dedicated Page for `/sites/new`
 * Replaces the modal popup with a full-screen, dedicated create site experience.
 */
export function NewSitePage({
  busy,
  error,
  onBack,
  onSave,
}: NewSitePageProps) {
  const spec = siteForm();

  return (
    <SiteFormModal
      spec={spec}
      busy={busy}
      error={error}
      onClose={onBack}
      onSave={onSave}
      asPage
    />
  );
}
