import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays, ChevronLeft, ChevronRight, List, LayoutGrid, UserRound,
} from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Button, Card, CardBody, CardHeader, cx, EmptyState, Pill, SegmentedControl, Skeleton, toneDot,
} from '@/components/ui/primitives';
import {
  EVENT_KINDS, buildCalendar, groupByDate, isWeekend, monthGrid, shiftMonth, upcoming, WEEKDAYS,
  type CalendarEvent, type EventKind,
} from '@/lib/calendar';
import { formatDate, formatMonthKey, monthKey, today } from '@/lib/dates';
import { visibleProjects } from '@/lib/permissions';
import { useInitialLoad } from '@/lib/useLoading';

const KIND_TONE: Record<EventKind, string> = {
  'Step due': 'Delivery plan steps reaching their planned end',
  'Step starts': 'Steps planned to begin',
  'Submission due': 'Register entries due with the client',
  Invoice: 'Invoices raised',
  'Monthly report': 'Support-period reports',
  'Project starts': 'Contract start dates',
  'Project ends': 'Contracted completion dates',
};

export default function CalendarPage() {
  const { state, currentUser } = useApp();
  const navigate = useNavigate();
  const loading = useInitialLoad();

  const [view, setView] = useState<'month' | 'agenda'>('month');
  const [month, setMonth] = useState(monthKey(today()));
  const [selected, setSelected] = useState<string>(today());
  const [projectFilter, setProjectFilter] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('');
  const [mineOnly, setMineOnly] = useState(false);
  const [hideDone, setHideDone] = useState(false);

  const all = useMemo(() => buildCalendar(state, currentUser), [state, currentUser]);
  const projects = useMemo(() => visibleProjects(state, currentUser), [state, currentUser]);

  const events = useMemo(() => all.filter((e) => {
    if (projectFilter && e.projectId !== projectFilter) return false;
    if (kindFilter && e.kind !== kindFilter) return false;
    if (mineOnly && e.assigneeId !== currentUser.id) return false;
    if (hideDone && e.done) return false;
    return true;
  }), [all, projectFilter, kindFilter, mineOnly, hideDone, currentUser.id]);

  const grid = useMemo(() => monthGrid(month, events), [month, events]);
  const agenda = useMemo(() => groupByDate(upcoming(events, 45)), [events]);
  const selectedDay = grid.find((d) => d.date === selected);

  if (loading) {
    return (
      <>
        <div className="mb-5"><Skeleton className="h-7 w-36" /><Skeleton className="mt-2 h-4 w-80" /></div>
        <Card className="p-5"><Skeleton className="h-4 w-32" /><Skeleton className="mt-4 h-[520px] w-full rounded-xl" /></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Everything dated across the business, in one place. Nothing here is scheduled separately — move a date on the record and it moves here."
        action={
          <SegmentedControl
            label="Calendar view"
            value={view}
            onChange={setView}
            options={[
              { value: 'month', label: 'Month', icon: LayoutGrid },
              { value: 'agenda', label: 'Agenda', icon: List },
            ]}
          />
        }
      />

      <Card className="mb-5">
        <CardBody className="flex flex-wrap items-center gap-2 py-4">
          <label className="sr-only" htmlFor="cal-project">Filter by project</label>
          <select
            id="cal-project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className={cx('h-9 max-w-[16rem] cursor-pointer rounded-lg border bg-surface px-2.5 text-[13px] font-medium hover:border-[#CFD8E1]',
              projectFilter ? 'border-cyan-600 text-indigo' : 'border-line text-ink-muted')}
          >
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <label className="sr-only" htmlFor="cal-kind">Filter by type</label>
          <select
            id="cal-kind"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className={cx('h-9 cursor-pointer rounded-lg border bg-surface px-2.5 text-[13px] font-medium hover:border-[#CFD8E1]',
              kindFilter ? 'border-cyan-600 text-indigo' : 'border-line text-ink-muted')}
          >
            <option value="">Everything</option>
            {EVENT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>

          <Button size="sm" variant={mineOnly ? 'secondary' : 'ghost'} icon={UserRound} onClick={() => setMineOnly((v) => !v)}>
            {mineOnly ? 'Only mine' : 'Everyone'}
          </Button>
          <Button size="sm" variant={hideDone ? 'secondary' : 'ghost'} onClick={() => setHideDone((v) => !v)}>
            {hideDone ? 'Outstanding only' : 'Including done'}
          </Button>

          <span className="ml-auto text-[12.5px] tabular-nums text-ink-muted">
            {events.length} of {all.length} entries
          </span>
        </CardBody>
      </Card>

      {view === 'month' ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
          <Card>
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <h2 className="text-[15px] font-semibold text-indigo">{formatMonthKey(month)}</h2>
              <div className="flex items-center gap-1.5">
                <Button size="sm" onClick={() => { setMonth(monthKey(today())); setSelected(today()); }}>Today</Button>
                <Button size="sm" variant="ghost" icon={ChevronLeft} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
                  <span className="sr-only">Previous month</span>
                </Button>
                <Button size="sm" variant="ghost" icon={ChevronRight} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
                  <span className="sr-only">Next month</span>
                </Button>
              </div>
            </div>

            <div className="border-t border-line p-3">
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="pb-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                    <span className="hidden sm:inline">{d}</span>
                    <span className="sm:hidden">{d[0]}</span>
                  </div>
                ))}
                {grid.map((day) => {
                  const isSelected = day.date === selected;
                  const shown = day.events.slice(0, 3);
                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setSelected(day.date)}
                      aria-current={day.isToday ? 'date' : undefined}
                      aria-label={`${formatDate(day.date)}, ${day.events.length} entries`}
                      className={cx(
                        'flex min-h-[74px] flex-col rounded-lg border p-1.5 text-left transition-colors sm:min-h-[92px]',
                        isSelected ? 'border-cyan-600 bg-cyan-50'
                          : day.isToday ? 'border-cyan-600/40 bg-cyan-50/40'
                          : day.inMonth ? 'border-line bg-surface hover:bg-canvas'
                          // Days spilling in from the neighbouring months recede
                          // through the surface, not through opacity — fading the
                          // whole cell takes the text below the contrast floor.
                          : 'border-transparent bg-[#EDF1F5]',
                        isWeekend(day.date) && day.inMonth && !isSelected && 'bg-canvas/70',
                      )}
                    >
                      <span className={cx(
                        'mb-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold tabular-nums',
                        day.isToday ? 'bg-cyan-600 text-white' : day.inMonth ? 'text-indigo' : 'text-ink-faint',
                      )}>
                        {Number(day.date.slice(-2))}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        {shown.map((e) => (
                          <span key={e.id} className="flex items-center gap-1 truncate text-[10.5px] leading-tight text-ink-muted">
                            <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', toneDot(e.tone))} aria-hidden />
                            <span className="truncate">{e.title}</span>
                          </span>
                        ))}
                        {day.events.length > shown.length ? (
                          <span className="text-[10.5px] font-semibold text-ink-faint">
                            +{day.events.length - shown.length} more
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card className="self-start">
            <CardHeader
              title={formatDate(selected)}
              subtitle={selectedDay && selectedDay.events.length
                ? `${selectedDay.events.length} entr${selectedDay.events.length === 1 ? 'y' : 'ies'}`
                : 'Nothing on this day'}
            />
            <CardBody className="pt-4">
              {selectedDay && selectedDay.events.length > 0 ? (
                <ul className="space-y-2.5">
                  {selectedDay.events.map((e) => (
                    <li key={e.id}><EventRow event={e} onOpen={() => navigate(e.href)} /></li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-[13px] text-ink-muted">
                  Pick another day, or widen the filters above.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader title="Next 45 days" subtitle="Everything coming up, in date order." />
          <CardBody className="pt-4">
            {agenda.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Nothing in the next 45 days"
                body="Either the filters are too narrow, or the dates on the plans and registers have not been set yet."
                action={<Button onClick={() => { setProjectFilter(''); setKindFilter(''); setMineOnly(false); setHideDone(false); }}>Clear filters</Button>}
              />
            ) : (
              <ol className="space-y-5">
                {agenda.map((g) => (
                  <li key={g.date}>
                    <div className="mb-2.5 flex items-baseline gap-2.5 border-b border-line pb-1.5">
                      <h3 className={cx('text-[13px] font-bold', g.date === today() ? 'text-cyan-link' : 'text-indigo')}>
                        {formatDate(g.date)}
                      </h3>
                      {g.date === today() ? <Pill tone="neutral" size="sm">Today</Pill> : null}
                      <span className="ml-auto text-[12px] tabular-nums text-ink-faint">{g.events.length}</span>
                    </div>
                    <ul className="space-y-2.5">
                      {g.events.map((e) => (
                        <li key={e.id}><EventRow event={e} onOpen={() => navigate(e.href)} showProject /></li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      )}

      <Card className="mt-5">
        <CardHeader title="What is on this calendar" subtitle="Each entry comes from a date already recorded on a project." />
        <CardBody className="pt-4">
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {EVENT_KINDS.map((k) => (
              <li key={k} className="rounded-lg border border-line p-3">
                <p className="text-[13px] font-semibold text-indigo">{k}</p>
                <p className="mt-1 text-[12px] leading-snug text-ink-muted">{KIND_TONE[k]}</p>
                <p className="mt-1.5 text-[12px] font-semibold tabular-nums text-ink-faint">
                  {all.filter((e) => e.kind === k).length} entries
                </p>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </>
  );
}

function EventRow({
  event, onOpen, showProject,
}: { event: CalendarEvent; onOpen: () => void; showProject?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full gap-2.5 rounded-lg border border-line p-2.5 text-left transition-colors hover:border-cyan-600/40 hover:bg-cyan-50/40"
    >
      <span className={cx('mt-1 h-2 w-2 shrink-0 rounded-full', toneDot(event.tone))} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cx('block text-[13px] font-medium leading-snug', event.done ? 'text-ink-muted line-through' : 'text-indigo')}>
          {event.title}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-ink-muted">{event.detail}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-faint">
          <span>{event.kind}</span>
          {showProject ? <><span aria-hidden>·</span><span className="truncate">{event.projectName}</span></> : null}
        </span>
      </span>
    </button>
  );
}
