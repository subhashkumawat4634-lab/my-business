import React from 'react';
import { WorkerFormModal } from '../../components/workers/WorkerFormModal';
import { workerForm } from '../../forms';
import { Row, Snapshot } from '../../types';

export interface EditWorkerPageProps {
  data: Snapshot;
  worker?: Row;
  busy: boolean;
  error: string;
  onBack: () => void;
  onSave: (values: Record<string, string>) => void;
  onOpenPaymentModal?: (workerId: string) => void;
  onOpenAttendanceModal?: (workerId: string) => void;
}

/**
 * Dedicated Page / View for Editing or Creating a Worker
 */
export function EditWorkerPage({
  data,
  worker,
  busy,
  error,
  onBack,
  onSave,
  onOpenPaymentModal,
  onOpenAttendanceModal,
}: EditWorkerPageProps) {
  const spec = workerForm(worker);

  return (
    <WorkerFormModal
      spec={spec}
      data={data}
      worker={worker}
      busy={busy}
      error={error}
      onClose={onBack}
      onSave={onSave}
      onOpenPaymentModal={onOpenPaymentModal}
      onOpenAttendanceModal={onOpenAttendanceModal}
      asPage
    />
  );
}
