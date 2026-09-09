import {
  AlertOctagon, AlertTriangle, CalendarClock, CalendarX, CheckCircle2, Circle,
  CircleDashed, Clock, HelpCircle, MinusCircle, PauseCircle, Send, ShieldCheck, Undo2,
} from 'lucide-react';
import type { DeliveryStep, Flag, Health, RegisterStatus } from '@/types';
import { flagTone, healthTone, statusTone, submissionTone } from '@/lib/derive';
import { Pill } from '@/components/ui/primitives';

const FLAG_ICONS: Record<string, React.ElementType> = {
  Complete: CheckCircle2,
  'Awaiting acknowledgement': Clock,
  Blocked: AlertOctagon,
  'On hold': PauseCircle,
  'No date': CalendarX,
  Overdue: AlertTriangle,
  'Due soon': CalendarClock,
  'On track': Circle,
};

export function FlagPill({ flag, size = 'md' }: { flag: Flag; size?: 'sm' | 'md' }) {
  if (!flag) {
    return <span className="text-xs text-ink-faint" aria-label="No flag: this row has no action text">—</span>;
  }
  return <Pill tone={flagTone(flag)} icon={FLAG_ICONS[flag]} size={size}>{flag}</Pill>;
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  'Not started': CircleDashed,
  'In progress': Clock,
  Completed: CheckCircle2,
  'On hold': PauseCircle,
  Blocked: AlertOctagon,
  'Not applicable': MinusCircle,
};

export function StatusPill({ status, size = 'md' }: { status: DeliveryStep['status']; size?: 'sm' | 'md' }) {
  return <Pill tone={statusTone(status)} icon={STATUS_ICONS[status]} size={size}>{status}</Pill>;
}

const SUBMISSION_ICONS: Record<string, React.ElementType> = {
  'Not required': MinusCircle,
  'Not yet due': CircleDashed,
  Prepared: Circle,
  Submitted: Send,
  Acknowledged: ShieldCheck,
  'Returned for correction': Undo2,
  'Not started': CircleDashed,
  'Not applicable': MinusCircle,
};

export function SubmissionPill({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  return (
    <Pill tone={submissionTone(status)} icon={SUBMISSION_ICONS[status] ?? HelpCircle} size={size}>
      {status}
    </Pill>
  );
}

export function RegisterStatusPill({ status, size = 'md' }: { status: RegisterStatus; size?: 'sm' | 'md' }) {
  return <SubmissionPill status={status} size={size} />;
}

const HEALTH_ICONS: Record<Health, React.ElementType> = {
  'On track': CheckCircle2,
  'Behind schedule': Clock,
  'At risk': AlertTriangle,
};

export function HealthPill({ health, size = 'md' }: { health: Health; size?: 'sm' | 'md' }) {
  return <Pill tone={healthTone(health)} icon={HEALTH_ICONS[health]} size={size}>{health}</Pill>;
}

export function AcknowledgedPill({ value }: { value: DeliveryStep['acknowledged'] }) {
  const tone = value === 'Yes' ? 'success' : value === 'No' ? 'warning' : 'neutral';
  const icon = value === 'Yes' ? ShieldCheck : value === 'No' ? Clock : MinusCircle;
  return <Pill tone={tone} icon={icon} size="sm">{value}</Pill>;
}
