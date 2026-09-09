import { useState } from 'react';
import { ListChecks, Plus, Send, Trash2, UserPlus, Users } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Button, Card, CardBody, CardHeader, IconButton, InlineMessage, Pill, SegmentedControl, Skeleton,
} from '@/components/ui/primitives';
import { ConfirmDialog, DeleteDialog, Modal } from '@/components/ui/Modal';
import { Field, Select, TextInput, Toggle } from '@/components/ui/form';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { DELIVERY_PLAN_TEMPLATE, SUBMISSIONS_TEMPLATE } from '@/data/templates';
import {
  DOC_STATUS, DOC_TYPE, INVOICE_STATUS, PHASES, PRIORITY, RESPONSIBLE, STATUS,
  STORAGE_LOCATION, SUBMISSION_STATUS, YES_NO,
} from '@/data/reference';
import type { Person, Responsible } from '@/types';
import { uid } from '@/data/factory';
import { useInitialLoad } from '@/lib/useLoading';

type Tab = 'people' | 'templates' | 'lists';

export default function Settings() {
  const { state, dispatch, toast } = useApp();
  const loading = useInitialLoad();
  const [tab, setTab] = useState<Tab>('people');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Person | null>(null);
  const [toggling, setToggling] = useState<Person | null>(null);

  if (loading) {
    return (
      <>
        <div className="mb-5"><Skeleton className="h-7 w-32" /></div>
        <Card className="p-5"><Skeleton className="h-4 w-40" /><Skeleton className="mt-5 h-40 w-full rounded-xl" /></Card>
      </>
    );
  }

  const columns: Array<Column<Person>> = [
    {
      key: 'name', header: 'Name', mobile: 'title', sortValue: (p) => p.name,
      cell: (p) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo text-[11px] font-bold text-white" aria-hidden>
            {p.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-indigo">{p.name}</p>
            <p className="truncate text-[12.5px] text-ink-muted">{p.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', mobile: 'meta', width: '200px', sortValue: (p) => p.role, cell: (p) => <Pill tone="neutral" size="sm">{p.role}</Pill> },
    {
      key: 'projects', header: 'On projects', mobile: 'field', width: '130px',
      cell: (p) => {
        const n = state.projects.filter((x) => x.projectManagerId === p.id || x.projectLeadId === p.id).length;
        return <span className="text-[13px] tabular-nums">{n}</span>;
      },
    },
    {
      key: 'active', header: 'Status', mobile: 'meta', width: '130px',
      cell: (p) => <Pill tone={p.active ? 'success' : 'neutral'} size="sm">{p.active ? 'Active' : 'Inactive'}</Pill>,
    },
    {
      key: 'actions', header: '', mobile: 'field', width: '160px',
      cell: (p) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => setToggling(p)}>{p.active ? 'Deactivate' : 'Reactivate'}</Button>
          <IconButton label={`Delete ${p.name}`} icon={Trash2} size="sm" onClick={() => setDeleting(p)} className="hover:bg-danger-bg hover:text-danger" />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="People and roles, the standard template every project is created from, and the controlled lists behind every drop-down."
        action={tab === 'people' ? <Button variant="primary" icon={UserPlus} onClick={() => setAdding(true)}>Add a person</Button> : undefined}
      />

      <div className="mb-5">
        <SegmentedControl
          label="Settings section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'people', label: 'People and roles', icon: Users },
            { value: 'templates', label: 'Standard template', icon: ListChecks },
            { value: 'lists', label: 'Lists', icon: Send },
          ]}
        />
      </div>

      {tab === 'people' ? (
        <Card>
          <CardHeader title="People and roles" subtitle={`${state.people.filter((p) => p.active).length} active of ${state.people.length}.`} />
          <CardBody className="pt-4">
            <DataTable caption="People and their roles" columns={columns} rows={state.people} rowKey={(p) => p.id} />
          </CardBody>
        </Card>
      ) : null}

      {tab === 'templates' ? (
        <div className="space-y-5">
          <InlineMessage tone="neutral" icon={ListChecks}>
            This is the standard template. Every new project is created with exactly these{' '}
            <span className="font-semibold text-indigo">{DELIVERY_PLAN_TEMPLATE.length} delivery plan steps</span> and{' '}
            <span className="font-semibold text-indigo">{SUBMISSIONS_TEMPLATE.length} register entries</span>, in this order,
            with status “Not started” and dates blank. A project's own copy is edited on its Delivery Plan tab; changing that
            copy does not change this template.
          </InlineMessage>

          <Card>
            <CardHeader title="Delivery plan template" subtitle={`${DELIVERY_PLAN_TEMPLATE.length} steps across ${PHASES.length} phases.`} />
            <CardBody className="pt-4">
              {PHASES.map((phase) => {
                const rows = DELIVERY_PLAN_TEMPLATE.filter((r) => r.phase === phase);
                return (
                  <section key={phase} className="border-t border-line pt-4 first:border-t-0 first:pt-0 [&:not(:first-child)]:mt-4">
                    <h3 className="text-[13px] font-bold text-indigo">
                      {phase} <span className="ml-1 font-medium text-ink-faint">· {rows.length} steps</span>
                    </h3>
                    <ul className="mt-2.5 space-y-1.5">
                      {rows.map((r) => (
                        <li key={`${r.phase}-${r.step}`} className="flex gap-3 rounded-lg border border-line p-2.5">
                          <span className="w-10 shrink-0 text-[12.5px] font-bold tabular-nums text-cyan-link">{r.step}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] leading-snug text-ink">{r.action}</p>
                            <p className="mt-1 text-[12px] text-ink-muted">{r.deliverable}</p>
                          </div>
                          <div className="hidden w-40 shrink-0 sm:block">
                            <Pill tone="neutral" size="sm">{r.responsible}</Pill>
                          </div>
                          <div className="hidden w-28 shrink-0 lg:block">
                            <Pill tone={r.submission === 'Not required' ? 'neutral' : 'warning'} size="sm">{r.submission}</Pill>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Submissions register template" subtitle={`${SUBMISSIONS_TEMPLATE.length} entries.`} />
            <CardBody className="pt-4">
              <ul className="space-y-1.5">
                {SUBMISSIONS_TEMPLATE.map((r, i) => (
                  <li key={i} className="flex gap-3 rounded-lg border border-line p-2.5">
                    <span className="w-7 shrink-0 text-[12.5px] font-bold tabular-nums text-ink-faint">{i + 1}</span>
                    <span className="w-16 shrink-0 text-[12.5px] font-semibold text-cyan-link">Phase {r.phase}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-snug text-ink">{r.submission}</p>
                      <p className="mt-1 text-[12px] text-ink-muted">{r.template} · signed by {r.signedBy}</p>
                    </div>
                    <div className="hidden w-40 shrink-0 sm:block">
                      <Pill tone="neutral" size="sm">{r.owner}</Pill>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'lists' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <ListCard title="Phases" items={PHASES} />
          <ListCard title="Status" items={STATUS} />
          <ListCard title="Responsible party" items={RESPONSIBLE} />
          <ListCard title="Submission to client" items={SUBMISSION_STATUS} />
          <ListCard title="Acknowledged" items={YES_NO} />
          <ListCard title="Priority" items={PRIORITY} />
          <ListCard title="Document type" items={DOC_TYPE} />
          <ListCard title="Document status" items={DOC_STATUS} />
          <ListCard title="Storage location" items={STORAGE_LOCATION} />
          <ListCard title="Invoice status" items={INVOICE_STATUS} />
        </div>
      ) : null}

      <AddPersonDialog
        open={adding}
        onClose={() => setAdding(false)}
        existingEmails={state.people.map((p) => p.email.toLowerCase())}
        onSave={(p) => {
          dispatch({ type: 'person/add', person: p });
          toast({ tone: 'success', title: `${p.name} added` });
          setAdding(false);
        }}
      />

      <ConfirmDialog
        open={!!toggling}
        onClose={() => setToggling(null)}
        onConfirm={() => {
          if (!toggling) return;
          dispatch({ type: 'person/update', id: toggling.id, patch: { active: !toggling.active } });
          toast({ tone: 'success', title: `${toggling.name} ${toggling.active ? 'deactivated' : 'reactivated'}` });
          setToggling(null);
        }}
        title={toggling?.active ? `Deactivate ${toggling.name}?` : `Reactivate ${toggling?.name}?`}
        confirmLabel={toggling?.active ? 'Deactivate' : 'Reactivate'}
        description={toggling?.active
          ? 'They stay on the projects and steps already assigned to them, but they will not appear in the drop-downs for new work.'
          : 'They will appear in the drop-downs again.'}
      />

      <DeleteDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          dispatch({ type: 'person/delete', id: deleting.id });
          toast({ tone: 'success', title: `${deleting.name} deleted` });
          setDeleting(null);
        }}
        title={`Delete ${deleting?.name ?? ''}?`}
        confirmLabel="Delete person"
        whatIsLost={
          <ul className="list-inside list-disc space-y-1">
            <li>Their record, including their email address and role</li>
            <li>
              Their name on{' '}
              {state.projects.filter((p) => p.projectManagerId === deleting?.id || p.projectLeadId === deleting?.id).length}{' '}
              project(s) and on every step assigned to them, which will show as unassigned
            </li>
            <li>Deactivating them instead keeps the history intact</li>
          </ul>
        }
      />
    </>
  );
}

function ListCard({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={`${items.length} values. These drive every drop-down in the system.`} />
      <CardBody className="pt-4">
        <ul className="flex flex-wrap gap-1.5">
          {items.map((i) => (
            <li key={i}>
              <span className="inline-flex rounded-lg border border-line bg-canvas px-2.5 py-1 text-[12.5px] font-medium text-ink">{i}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function AddPersonDialog({
  open, onClose, onSave, existingEmails,
}: { open: boolean; onClose: () => void; onSave: (p: Person) => void; existingEmails: string[] }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Responsible>('Project manager');
  const [active, setActive] = useState(true);

  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = 'Enter their full name.';
  if (!email.trim()) errors.email = 'Enter their email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'That is not a valid email address.';
  else if (existingEmails.includes(email.trim().toLowerCase())) errors.email = 'Someone already has that email address.';
  const valid = Object.keys(errors).length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a person"
      description="They will appear in the responsible party and assignment drop-downs."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon={Plus}
            disabled={!valid}
            onClick={() => {
              if (!valid) return;
              onSave({ id: uid('u'), name: name.trim(), email: email.trim(), role, active });
              setName(''); setEmail(''); setRole('Project manager'); setActive(true);
            }}
          >
            Add person
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Full name" required error={errors.name} htmlFor="p-name">
          <TextInput id="p-name" value={name} invalid={!!errors.name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email address" required error={errors.email} htmlFor="p-email">
          <TextInput id="p-email" type="email" value={email} invalid={!!errors.email} onChange={(e) => setEmail(e.target.value)} placeholder="name@rewatu.co.za" />
        </Field>
        <Field label="Role" htmlFor="p-role">
          <Select id="p-role" options={RESPONSIBLE} value={role} onChange={(e) => setRole(e.target.value as Responsible)} />
        </Field>
        <Toggle checked={active} onChange={setActive} label="Active" description="Inactive people stay on past work but drop out of the drop-downs." />
      </div>
    </Modal>
  );
}
