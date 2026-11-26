import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PractitionerDto, ServiceDto } from '@ozimai/shared';
import { api } from '../../lib/api';

/**
 * What the AI needs to book correctly: each doctor's specialty, daily break
 * and days off, and each service's length (a 90-minute implant blocks 90
 * minutes in the calendar).
 */
export function ClinicSetupCard() {
  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: 18 }}>
      <h2 className="type-h2" style={{ margin: '0 0 4px' }}>
        Врачи и услуги
      </h2>
      <p className="type-small" style={{ margin: '0 0 14px' }}>
        Айым подбирает врача по специальности, не записывает в перерыв и выходные и бронирует столько времени, сколько длится услуга.
      </p>
      <PractitionersList />
      <ServicesList />
    </section>
  );
}

function PractitionersList() {
  const { data: practitioners } = useQuery({
    queryKey: ['practitioners'],
    queryFn: () => api.get<PractitionerDto[]>('/organizations/practitioners'),
  });
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="field-label">Врачи</div>
      {!practitioners?.length && <div className="type-small">Врачи ещё не добавлены.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(practitioners ?? []).map((p) => (
          <PractitionerRow key={p.id} practitioner={p} />
        ))}
      </div>
    </div>
  );
}

function PractitionerRow({ practitioner }: { practitioner: PractitionerDto }) {
  const queryClient = useQueryClient();
  const [specialty, setSpecialty] = useState(practitioner.specialty ?? '');
  const [breakFrom, setBreakFrom] = useState(practitioner.breakTime?.[0] ?? '');
  const [breakTo, setBreakTo] = useState(practitioner.breakTime?.[1] ?? '');
  const [daysOff, setDaysOff] = useState<string[]>(practitioner.daysOff ?? []);
  const [newDay, setNewDay] = useState('');

  const save = useMutation({
    mutationFn: () =>
      api.patch<PractitionerDto>(`/organizations/practitioners/${practitioner.id}`, {
        specialty,
        breakTime: breakFrom && breakTo ? [breakFrom, breakTo] : null,
        daysOff,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioners'] }),
  });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = daysOff.filter((d) => d >= today);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 600 }}>{practitioner.name}</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="field-input"
          style={{ flex: '1 1 200px', height: 34 }}
          placeholder="Специальность: терапевт, ортодонт…"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
        />
        <span className="type-small">Перерыв</span>
        <input className="field-input" type="time" style={{ width: 110, height: 34 }} value={breakFrom} onChange={(e) => setBreakFrom(e.target.value)} />
        <span className="type-small">–</span>
        <input className="field-input" type="time" style={{ width: 110, height: 34 }} value={breakTo} onChange={(e) => setBreakTo(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="type-small">Выходные дни:</span>
        {upcoming.length === 0 && <span className="type-small">нет</span>}
        {upcoming.map((d) => (
          <button key={d} className="btn btn-secondary btn-sm" title="Убрать" onClick={() => setDaysOff(daysOff.filter((x) => x !== d))}>
            {new Date(`${d}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ×
          </button>
        ))}
        <input className="field-input" type="date" min={today} style={{ width: 150, height: 34 }} value={newDay} onChange={(e) => setNewDay(e.target.value)} />
        <button
          className="btn btn-ghost btn-sm"
          disabled={!newDay}
          onClick={() => {
            if (newDay && !daysOff.includes(newDay)) setDaysOff([...daysOff, newDay].sort());
            setNewDay('');
          }}
        >
          Добавить
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isSuccess && !save.isPending ? 'Сохранено' : 'Сохранить'}
        </button>
      </div>
      {save.error && <div className="field-error">⚠ {(save.error as Error).message}</div>}
    </div>
  );
}

function ServicesList() {
  const queryClient = useQueryClient();
  const { data: services } = useQuery({ queryKey: ['services'], queryFn: () => api.get<ServiceDto[]>('/organizations/services') });
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('30');

  const add = useMutation({
    mutationFn: () => api.post<ServiceDto>('/organizations/services', { name, price: Number(price) || 0, durationMin: Number(duration) || 30 }),
    onSuccess: () => {
      setName('');
      setPrice('');
      setDuration('30');
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  return (
    <div>
      <div className="field-label">Услуги (длительность приёма)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {(services ?? []).map((s) => (
          <ServiceRow key={s.id} service={s} />
        ))}
        {!services?.length && <div className="type-small">Услуги не добавлены — Айым записывает на стандартные 30 минут.</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="field-input" style={{ flex: '1 1 180px', height: 34 }} placeholder="Новая услуга" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="field-input" style={{ width: 110, height: 34 }} placeholder="Цена, ₸" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
        <input className="field-input" style={{ width: 80, height: 34 }} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))} />
        <span className="type-small">мин</span>
        <button className="btn btn-secondary btn-sm" disabled={!name || add.isPending} onClick={() => add.mutate()}>
          Добавить
        </button>
      </div>
      {add.error && <div className="field-error">⚠ {(add.error as Error).message}</div>}
    </div>
  );
}

function ServiceRow({ service }: { service: ServiceDto }) {
  const queryClient = useQueryClient();
  const [price, setPrice] = useState(String(service.price));
  const [duration, setDuration] = useState(String(service.durationMin));
  const dirty = price !== String(service.price) || duration !== String(service.durationMin);

  const save = useMutation({
    mutationFn: () => api.patch<ServiceDto>(`/organizations/services/${service.id}`, { price: Number(price) || 0, durationMin: Number(duration) || 30 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ flex: '1 1 180px' }}>{service.name}</span>
      <input className="field-input" style={{ width: 110, height: 32 }} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
      <span className="type-small">₸</span>
      <input className="field-input" style={{ width: 80, height: 32 }} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))} />
      <span className="type-small">мин</span>
      <button className="btn btn-ghost btn-sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
        Сохранить
      </button>
      {save.error && <span className="field-error">⚠ {(save.error as Error).message}</span>}
    </div>
  );
}
