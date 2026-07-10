import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppointmentDto, FreeSlot, PatientDto, PractitionerDto, ServiceDto } from '@ozimai/shared';
import { api } from '../../lib/api';
import { useToast } from '../../design-system/Toast';
import { Button } from '../../design-system/Button';
import { ConfirmDialog } from '../../design-system/Dialog';
import { Input, Select } from '../../design-system/Field';

function dayRange(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  const from = d.toISOString();
  const to = new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1000).toISOString();
  return { from, to };
}

interface SlotRow {
  time: string;
  iso: string;
  occupied: boolean;
  appointment?: AppointmentDto;
}

export function CalendarScreen() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [dayOffset, setDayOffset] = useState(1); // demo data is seeded for "tomorrow"
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [createSlot, setCreateSlot] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppointmentDto | null>(null);

  const { data: practitioners } = useQuery({
    queryKey: ['practitioners'],
    queryFn: () => api.get<PractitionerDto[]>('/organizations/practitioners'),
  });
  const activeDoctor = doctorId ?? practitioners?.[0]?.id ?? null;
  const { from, to } = dayRange(dayOffset);

  const { data: freeSlots } = useQuery({
    queryKey: ['free-slots', activeDoctor, from, to],
    queryFn: () => api.get<FreeSlot[]>(`/appointments/free-slots?practitionerId=${activeDoctor}&from=${from}&to=${to}`),
    enabled: Boolean(activeDoctor),
  });
  const { data: appointments } = useQuery({
    queryKey: ['appointments', activeDoctor, from, to],
    queryFn: () => api.get<AppointmentDto[]>(`/appointments?practitionerId=${activeDoctor}&from=${from}&to=${to}`),
    enabled: Boolean(activeDoctor),
  });
  const { data: patients } = useQuery({ queryKey: ['patients'], queryFn: () => api.get<PatientDto[]>('/patients') });
  const patientName = (id: string) => patients?.find((p) => p.id === id)?.name ?? patients?.find((p) => p.id === id)?.phone ?? 'Пациент';

  const rows = useMemo<SlotRow[]>(() => {
    const occupied = (appointments ?? []).filter((a) => ['booked', 'confirmed', 'held'].includes(a.status));
    const map = new Map<string, SlotRow>();
    for (const s of freeSlots ?? []) {
      map.set(s.slotStart, { time: fmtTime(s.slotStart), iso: s.slotStart, occupied: false });
    }
    for (const a of occupied) {
      map.set(a.slotStart, { time: fmtTime(a.slotStart), iso: a.slotStart, occupied: true, appointment: a });
    }
    return [...map.values()].sort((a, b) => a.iso.localeCompare(b.iso));
  }, [freeSlots, appointments]);

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/appointments/${id}/cancel`),
    onSuccess: () => {
      toast('Запись отменена');
      setCancelTarget(null);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['free-slots'] });
    },
  });

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 className="type-h1" style={{ margin: '0 0 16px' }}>
        Календарь
      </h1>
      <div style={{ display: 'flex', gap: 16, marginBottom: 18, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(practitioners ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => setDoctorId(p.id)}
              className="pill"
              style={
                p.id === activeDoctor
                  ? { background: 'var(--accent-050)', color: 'var(--accent-700)', border: '1px solid rgba(var(--accent-rgb),.4)' }
                  : {}
              }
            >
              {p.name}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`pill ${dayOffset === 0 ? 'active' : ''}`} onClick={() => setDayOffset(0)}>
            Сегодня
          </button>
          <button className={`pill ${dayOffset === 1 ? 'active' : ''}`} onClick={() => setDayOffset(1)}>
            Завтра
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 420, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
        {rows.length === 0 && (
          <div className="type-small" style={{ padding: 16 }}>
            Нет доступных слотов на этот день.
          </div>
        )}
        {rows.map((row) => (
          <div
            key={row.iso}
            className="calendar-slot-row"
            data-iso={row.iso}
            onClick={() => (row.occupied ? setCancelTarget(row.appointment!) : setCreateSlot(row.iso))}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid var(--bg-sunken)',
              cursor: 'pointer',
            }}
          >
            <span style={{ font: '500 13px var(--font-mono)', color: 'var(--text-muted)', width: 56 }}>{row.time}</span>
            <span className={`chip ${row.occupied ? 'chip-accent' : 'chip-neutral'}`}>
              {row.occupied ? patientName(row.appointment!.patientId) : 'Свободно'}
            </span>
          </div>
        ))}
      </div>
      <p className="type-small" style={{ marginTop: 14 }}>
        Клик по свободному слоту — создать запись; по занятому — отменить. В проде запись чаще создаёт Айым.
      </p>

      {createSlot && activeDoctor && (
        <CreateAppointmentModal
          practitionerId={activeDoctor}
          slotIso={createSlot}
          onClose={() => setCreateSlot(null)}
          onCreated={() => {
            setCreateSlot(null);
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.invalidateQueries({ queryKey: ['free-slots'] });
            queryClient.invalidateQueries({ queryKey: ['patients'] });
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Отменить запись?"
        description={cancelTarget ? `${patientName(cancelTarget.patientId)}, ${fmtTime(cancelTarget.slotStart)}. Пациент получит уведомление.` : ''}
        confirmLabel="Отменить запись"
        confirmVariant="danger"
        busy={cancelMutation.isPending}
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function CreateAppointmentModal({
  practitionerId,
  slotIso,
  onClose,
  onCreated,
}: {
  practitionerId: string;
  slotIso: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const { data: services } = useQuery({ queryKey: ['services'], queryFn: () => api.get<ServiceDto[]>('/organizations/services') });

  const mutation = useMutation({
    mutationFn: async () => {
      const patient = await api.post<PatientDto>('/patients', { phone, name: name || undefined });
      return api.post('/appointments/book-direct', { practitionerId, patientId: patient.id, slotStart: slotIso, serviceId: serviceId || undefined });
    },
    onSuccess: onCreated,
    onError: (err: any) => toast(err.message ?? 'Не удалось создать запись'),
  });

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <div className="type-h2" style={{ marginBottom: 12 }}>
          Новая запись · {fmtTime(slotIso)}
        </div>
        <form
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Input label="Телефон пациента" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 700 000 0000" />
          <Input label="Имя" value={name} onChange={(e) => setName(e.target.value)} placeholder="Необязательно" />
          <Select label="Услуга" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">Без указания услуги</option>
            {(services ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.price.toLocaleString('ru-RU')} ₸
              </option>
            ))}
          </Select>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              Записать
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
